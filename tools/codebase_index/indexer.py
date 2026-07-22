"""
Codebase Indexer — SQLite FTS5 full-text search for the seo-app codebase.

Allows agents to search for relevant code before answering questions or
implementing tasks. Uses SQLite's built-in FTS5 extension (no extra deps).

Now supports AST-aware chunking, file hashing, symbol tables, import graphs,
and hybrid search — all backward compatible with the original FTS5 index.

Usage:
    # Build/rebuild the index:
    python langgraph_agents/indexer.py --build

    # Search from CLI:
    python langgraph_agents/indexer.py --search "Make.com webhook analytics"

    # Symbol-level search:
    python langgraph_agents/indexer.py --search-symbols "queue_post"

    # Find a symbol by name:
    python langgraph_agents/indexer.py --find "SchemaRegistry"

    # Find files that import a symbol:
    python tools/codebase_index/indexer.py --importers "SchemaRegistry"

    # Show call graph for a file:
    python langgraph_agents/indexer.py --call-graph "lib/schema_registry.py"

    # From Python (used by chat mode and agents):
    from tools.codebase_index.indexer import CodebaseIndexer
    idx = CodebaseIndexer()
    results = idx.search("pinterest analytics webhook", limit=5)
    for r in results:
        print(r['path'], r['snippet'])
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Ensure the project root is on sys.path so that 'tools.codebase_index' is importable
# when this file is run directly.
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Root of the seo-app directory
SEO_APP_ROOT = _PROJECT_ROOT

# Index database location
INDEX_DB_PATH = SEO_APP_ROOT / "data" / "codebase_index.db"

# File patterns to index
INDEXED_EXTENSIONS = {".py", ".md", ".yaml", ".yml", ".json"}

# Directories to skip entirely
SKIP_DIRS = {
    "__pycache__", ".venv", "venv", ".git", "node_modules",
    ".mypy_cache", ".pytest_cache", "dist", "build", "eggs",
    "generated_images", "logs", "archived", "archived_docs",
}

# Max file size to index (bytes) — skip huge files
MAX_FILE_SIZE = 200_000  # 200 KB

# Scoped search paths per mini-supervisor — used for context-aware search
AGENT_SEARCH_SCOPES: dict[str, list[str]] = {
    "SEO-pinterest": [
        "workflows/social_media/pinterest",
        "scripts/pinterest_daily_post.py",
        "scripts/pinterest_sync_analytics.py",
        "scripts/pinterest_delete_pins.py",
        "agents/prompts/SEO-pinterest.md",
        "agents/prompts/SEO-pinterest-tasks.md",
        "data/pinterest",
    ],
    "SEO-pinterest-analytics": [
        "workflows/social_media/pinterest/analytics_client.py",
        "scripts/pinterest_sync_analytics.py",
        "agents/prompts/SEO-pinterest-tasks.md",
    ],
    "SEO-social-scheduling": [
        "scripts/setup_pinterest_scheduler_this_machine.ps1",
        "automation/task_scheduler.py",
        "automation/task_scheduler_utils.py",
    ],
    "SEO-wordpress": [
        "workflows/shared/adapters/publish_to_wordpress.py",
        "agents/wordpress.py",
    ],
    "SEO-entity-schema": [
        "agents/schema.py",
        "data/entity_seo",
    ],
    "SEO-scheduling": [
        "automation/task_scheduler.py",
        "automation/task_queue_db.py",
        "data/task_queue.db",
    ],
    "SEO-reporting": [
        "agents/reporting.py",
        "analytics",
    ],
}


# ---------------------------------------------------------------------------
# CodebaseIndexer
# ---------------------------------------------------------------------------

class CodebaseIndexer:
    """
    SQLite FTS5-based full-text search index for the seo-app codebase.

    Indexes all .py, .md, .yaml, .json files under seo-app/.
    Supports scoped search per agent (only searches files owned by that agent).

    Now with AST-aware chunking: .py files are parsed into individual
    symbols (functions, classes, methods) for fine-grained search.
    Import graphs and file hashing enable incremental rebuilds.

    Example:
        idx = CodebaseIndexer()
        idx.build()  # or idx.build_if_stale()
        results = idx.search("Make.com webhook analytics", limit=5)
    """

    def __init__(self, db_path: Path | str | None = None):
        self.db_path = Path(db_path) if db_path else INDEX_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Schema
    # ------------------------------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_schema(self, conn: sqlite3.Connection) -> None:
        """Create all tables if they don't exist. Idempotent."""
        # ── Existing core tables (backward compatible) ──
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS index_meta (
                key   TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS code_fts USING fts5(
                path,
                content,
                tokenize = 'porter unicode61'
            );

            CREATE TABLE IF NOT EXISTS code_files (
                path         TEXT PRIMARY KEY,
                size_bytes   INTEGER,
                indexed_at   TEXT,
                line_count   INTEGER
            );
        """)

        # ── Migrate code_files: add file_hash and last_modified if missing ──
        self._migrate_code_files(conn)

        # ── New tables: symbol-level FTS, metadata, import graph ──
        conn.executescript("""
            CREATE VIRTUAL TABLE IF NOT EXISTS symbol_fts USING fts5(
                file_path,
                symbol_name,
                symbol_type,
                signature,
                docstring,
                source,
                content_weight,
                tokenize = 'porter unicode61'
            );

            CREATE TABLE IF NOT EXISTS code_symbols (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                symbol_name TEXT NOT NULL,
                symbol_type TEXT NOT NULL,
                signature TEXT,
                docstring TEXT,
                line_start INTEGER,
                line_end INTEGER,
                parent_class TEXT,
                decorators TEXT,
                FOREIGN KEY (file_path) REFERENCES code_files(path)
            );

            CREATE TABLE IF NOT EXISTS code_imports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_file TEXT NOT NULL,
                module TEXT,
                imported_name TEXT,
                import_type TEXT,
                line_number INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_symbols_file ON code_symbols(file_path);
            CREATE INDEX IF NOT EXISTS idx_symbols_name ON code_symbols(symbol_name);
            CREATE INDEX IF NOT EXISTS idx_imports_source ON code_imports(source_file);
            CREATE INDEX IF NOT EXISTS idx_imports_name ON code_imports(imported_name);
        """)

        conn.commit()

    def _migrate_code_files(self, conn: sqlite3.Connection) -> None:
        """Add file_hash and last_modified columns to code_files if missing."""
        existing_cols = {
            row[1] for row in conn.execute("PRAGMA table_info(code_files)").fetchall()
        }
        if "file_hash" not in existing_cols:
            conn.execute("ALTER TABLE code_files ADD COLUMN file_hash TEXT")
            logger.info("Migrated code_files: added file_hash column")
        if "last_modified" not in existing_cols:
            conn.execute("ALTER TABLE code_files ADD COLUMN last_modified TEXT")
            logger.info("Migrated code_files: added last_modified column")
        conn.commit()

    # ------------------------------------------------------------------
    # Build / rebuild
    # ------------------------------------------------------------------

    def build(self, *, force: bool = False, verbose: bool = False) -> dict[str, int]:
        """
        Build (or rebuild) the full-text search index.

        Uses SHA256 file hashing for incremental rebuilds — only re-indexes
        files whose content has changed. For .py files, uses AST-aware chunking
        to insert per-symbol entries. Non-.py files are indexed whole-file.

        Args:
            force:   If True, drop and rebuild from scratch.
            verbose: Print progress.

        Returns:
            Stats dict: {indexed, skipped, errors, total_files}
        """
        conn = self._connect()
        self._ensure_schema(conn)

        if force:
            conn.execute("DELETE FROM code_fts")
            conn.execute("DELETE FROM code_files")
            conn.execute("DELETE FROM index_meta")
            conn.execute("DELETE FROM symbol_fts")
            conn.execute("DELETE FROM code_symbols")
            conn.execute("DELETE FROM code_imports")
            conn.commit()
            if verbose:
                print("  Cleared existing index.")

        # Get existing file hashes for incremental skip
        existing_hashes: dict[str, str] = {}
        if not force:
            rows = conn.execute(
                "SELECT path, file_hash FROM code_files WHERE file_hash IS NOT NULL"
            ).fetchall()
            existing_hashes = {row["path"]: row["file_hash"] for row in rows}

        # Track indexed paths for cleanup of stale entries
        indexed_paths: set[str] = set()

        stats = {"indexed": 0, "skipped": 0, "errors": 0, "total_files": 0}

        # Import ASTChunker lazily so the module loads even if ast_chunker is broken
        ast_chunker = None
        try:
            from tools.codebase_index.ast_chunker import ASTChunker
            ast_chunker = ASTChunker()
        except Exception as e:
            logger.warning("ASTChunker not available, falling back to whole-file indexing: %s", e)

        for file_path in self._iter_files():
            stats["total_files"] += 1
            rel_path = str(file_path.relative_to(SEO_APP_ROOT)).replace("\\", "/")

            try:
                content = file_path.read_text(encoding="utf-8", errors="replace")
            except Exception as e:
                logger.warning("Cannot read %s: %s", rel_path, e)
                stats["errors"] += 1
                continue

            # Compute hash and check if file changed
            file_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            if not force and rel_path in existing_hashes and existing_hashes[rel_path] == file_hash:
                stats["skipped"] += 1
                indexed_paths.add(rel_path)
                if verbose and stats["total_files"] % 100 == 0:
                    print(f"  Scanned {stats['total_files']} files...")
                continue

            line_count = content.count("\n") + 1
            file_mtime = datetime.fromtimestamp(
                file_path.stat().st_mtime, tz=timezone.utc
            ).isoformat()

            # Remove old entries for this file before inserting new ones
            conn.execute("DELETE FROM code_fts WHERE path = ?", (rel_path,))
            conn.execute("DELETE FROM code_files WHERE path = ?", (rel_path,))
            conn.execute("DELETE FROM symbol_fts WHERE file_path = ?", (rel_path,))
            conn.execute("DELETE FROM code_symbols WHERE file_path = ?", (rel_path,))
            conn.execute("DELETE FROM code_imports WHERE source_file = ?", (rel_path,))

            try:
                is_py = file_path.suffix.lower() == ".py"
                used_ast = False

                if is_py and ast_chunker is not None:
                    try:
                        chunks = ast_chunker.chunk_file(file_path)
                        imports = ast_chunker.extract_imports(content, rel_path)

                        # Insert module-level chunk into code_fts for backward compat
                        # (the first chunk from chunk_file is always the module chunk)
                        module_chunk = chunks[0] if chunks else None
                        if module_chunk and module_chunk.symbol_type == "module":
                            conn.execute(
                                "INSERT INTO code_fts (path, content) VALUES (?, ?)",
                                (rel_path, module_chunk.source),
                            )

                        # Insert per-symbol chunks into symbol_fts and code_symbols
                        for chunk in chunks:
                            if chunk.symbol_type == "module":
                                continue  # Already in code_fts above

                            conn.execute(
                                "INSERT INTO symbol_fts "
                                "(file_path, symbol_name, symbol_type, signature, "
                                "docstring, source, content_weight) "
                                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                                (
                                    rel_path,
                                    chunk.symbol_name,
                                    chunk.symbol_type,
                                    chunk.signature,
                                    chunk.docstring,
                                    chunk.source,
                                    "source",
                                ),
                            )
                            conn.execute(
                                "INSERT INTO code_symbols "
                                "(file_path, symbol_name, symbol_type, signature, "
                                "docstring, line_start, line_end, parent_class, decorators) "
                                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                (
                                    rel_path,
                                    chunk.symbol_name,
                                    chunk.symbol_type,
                                    chunk.signature,
                                    chunk.docstring,
                                    chunk.line_start,
                                    chunk.line_end,
                                    chunk.parent_class,
                                    json.dumps(chunk.decorators) if chunk.decorators else None,
                                ),
                            )

                        # Insert imports
                        for imp in imports:
                            imported_names = imp.get("imported_names", [])
                            if not imported_names:
                                # Bare import: use module name as imported_name
                                imported_names = [imp["module"]]
                            for name in imported_names:
                                conn.execute(
                                    "INSERT INTO code_imports "
                                    "(source_file, module, imported_name, import_type, line_number) "
                                    "VALUES (?, ?, ?, ?, ?)",
                                    (
                                        rel_path,
                                        imp["module"],
                                        name,
                                        imp["import_type"],
                                        imp["line"],
                                    ),
                                )

                        used_ast = True

                    except Exception as e:
                        logger.warning(
                            "AST chunking failed for %s: %s — falling back to whole-file", rel_path, e
                        )

                if not used_ast:
                    # Whole-file indexing (non-.py files or AST fallback)
                    conn.execute(
                        "INSERT INTO code_fts (path, content) VALUES (?, ?)",
                        (rel_path, content),
                    )

                # Insert/update code_files metadata
                conn.execute(
                    "INSERT INTO code_files "
                    "(path, size_bytes, indexed_at, line_count, file_hash, last_modified) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        rel_path,
                        file_path.stat().st_size,
                        datetime.now(timezone.utc).isoformat(),
                        line_count,
                        file_hash,
                        file_mtime,
                    ),
                )

                stats["indexed"] += 1
                indexed_paths.add(rel_path)

                if verbose and stats["indexed"] % 50 == 0:
                    print(f"  Indexed {stats['indexed']} files...")

            except Exception as e:
                logger.warning("Failed to index %s: %s", rel_path, e)
                stats["errors"] += 1

        # ── Clean up stale entries (files that were removed) ──
        if not force:
            all_stored = {
                row["path"]
                for row in conn.execute("SELECT path FROM code_files").fetchall()
            }
            stale = all_stored - indexed_paths
            if stale:
                for stale_path in stale:
                    conn.execute("DELETE FROM code_fts WHERE path = ?", (stale_path,))
                    conn.execute("DELETE FROM code_files WHERE path = ?", (stale_path,))
                    conn.execute("DELETE FROM symbol_fts WHERE file_path = ?", (stale_path,))
                    conn.execute("DELETE FROM code_symbols WHERE file_path = ?", (stale_path,))
                    conn.execute("DELETE FROM code_imports WHERE source_file = ?", (stale_path,))
                logger.info("Cleaned up %d stale entries", len(stale))
                if verbose:
                    print(f"  Cleaned up {len(stale)} stale entries (files removed from disk).")

        # ── Update metadata ──
        total_stored = conn.execute("SELECT COUNT(*) as cnt FROM code_files").fetchone()["cnt"]
        conn.execute(
            "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('built_at', ?)",
            (datetime.now(timezone.utc).isoformat(),),
        )
        conn.execute(
            "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('total_files', ?)",
            (str(total_stored),),
        )
        conn.commit()
        conn.close()

        if verbose:
            print(f"\n  Index built: {stats['indexed']} new, "
                  f"{stats['skipped']} skipped, {stats['errors']} errors")

        return stats

    def build_if_stale(self, max_age_hours: int = 24) -> bool:
        """
        Build the index only if it's older than max_age_hours or doesn't exist.

        Returns True if a build was triggered.
        """
        if not self.db_path.exists():
            self.build()
            return True

        conn = self._connect()
        self._ensure_schema(conn)
        row = conn.execute(
            "SELECT value FROM index_meta WHERE key = 'built_at'"
        ).fetchone()
        conn.close()

        if not row:
            self.build()
            return True

        built_at = datetime.fromisoformat(row["value"])
        age_hours = (datetime.now(timezone.utc) - built_at).total_seconds() / 3600
        if age_hours > max_age_hours:
            self.build()
            return True

        return False

    # ------------------------------------------------------------------
    # Search (backward compatible)
    # ------------------------------------------------------------------

    def search(
        self,
        query: str,
        *,
        limit: int = 10,
        agent_scope: str | None = None,
        path_filter: str | None = None,
        snippet_tokens: int = 64,
    ) -> list[dict[str, Any]]:
        """
        Search the codebase index via whole-file FTS.

        Args:
            query:         Full-text search query (FTS5 syntax supported)
            limit:         Max results to return
            agent_scope:   If set, restrict to files owned by this agent
                           (uses AGENT_SEARCH_SCOPES mapping)
            path_filter:   If set, restrict to paths containing this string
            snippet_tokens: Number of tokens in the snippet

        Returns:
            List of dicts: {path, snippet, rank, line_count, full_path}
        """
        if not self.db_path.exists():
            logger.warning("Index not built yet. Run build() first.")
            return []

        conn = self._connect()
        self._ensure_schema(conn)

        # Build scope filter
        scope_paths: list[str] = []
        if agent_scope and agent_scope in AGENT_SEARCH_SCOPES:
            scope_paths = AGENT_SEARCH_SCOPES[agent_scope]

        try:
            # Escape FTS5 special chars in query
            safe_query = self._escape_fts_query(query)

            if scope_paths:
                # Scoped search — filter by agent's owned paths
                placeholders = " OR ".join(
                    f"path LIKE ?" for _ in scope_paths
                )
                params = [f"%{p}%" for p in scope_paths]
                sql = f"""
                    SELECT
                        path,
                        snippet(code_fts, 1, '[', ']', '...', {snippet_tokens}) AS snippet,
                        rank
                    FROM code_fts
                    WHERE code_fts MATCH ?
                      AND ({placeholders})
                    ORDER BY rank
                    LIMIT ?
                """
                rows = conn.execute(sql, [safe_query] + params + [limit]).fetchall()
            elif path_filter:
                sql = f"""
                    SELECT
                        path,
                        snippet(code_fts, 1, '[', ']', '...', {snippet_tokens}) AS snippet,
                        rank
                    FROM code_fts
                    WHERE code_fts MATCH ?
                      AND path LIKE ?
                    ORDER BY rank
                    LIMIT ?
                """
                rows = conn.execute(sql, [safe_query, f"%{path_filter}%", limit]).fetchall()
            else:
                sql = f"""
                    SELECT
                        path,
                        snippet(code_fts, 1, '[', ']', '...', {snippet_tokens}) AS snippet,
                        rank
                    FROM code_fts
                    WHERE code_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                """
                rows = conn.execute(sql, [safe_query, limit]).fetchall()

            results = []
            for row in rows:
                # Get line count from metadata table
                meta = conn.execute(
                    "SELECT line_count FROM code_files WHERE path = ?",
                    (row["path"],)
                ).fetchone()
                results.append({
                    "path": row["path"],
                    "snippet": row["snippet"],
                    "rank": row["rank"],
                    "line_count": meta["line_count"] if meta else 0,
                    "full_path": str(SEO_APP_ROOT / row["path"]),
                })

            return results

        except sqlite3.OperationalError as e:
            logger.error("FTS search error: %s", e)
            return []
        finally:
            conn.close()

    def search_for_agent(self, query: str, agent_name: str, limit: int = 5) -> str:
        """
        Search the codebase scoped to an agent's files and return a formatted string.
        Suitable for injecting into LLM context.

        Args:
            query:      What to search for
            agent_name: Agent ID (e.g. 'SEO-pinterest')
            limit:      Max results

        Returns:
            Formatted string with search results for LLM context injection.
        """
        results = self.search(query, limit=limit, agent_scope=agent_name)
        if not results:
            # Fall back to global search
            results = self.search(query, limit=limit)

        if not results:
            return f"No code found for query: '{query}'"

        lines = [f"Code search results for '{query}':"]
        for i, r in enumerate(results, 1):
            lines.append(f"\n[{i}] {r['path']} ({r['line_count']} lines)")
            lines.append(f"    {r['snippet']}")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Symbol-level search (new)
    # ------------------------------------------------------------------

    def search_symbols(
        self,
        query: str,
        *,
        symbol_type: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Search at symbol granularity (functions, classes, methods).

        Args:
            query:       Full-text search query
            symbol_type: Optional filter: 'function', 'method', 'class', 'module'
            limit:       Max results

        Returns:
            List of dicts with: file_path, symbol_name, symbol_type, signature,
            docstring, line_start, line_end, parent_class, snippet, rank
        """
        if not self.db_path.exists():
            logger.warning("Index not built yet. Run build() first.")
            return []

        conn = self._connect()
        self._ensure_schema(conn)

        try:
            safe_query = self._escape_fts_query(query)

            if symbol_type:
                sql = """
                    SELECT
                        file_path,
                        symbol_name,
                        symbol_type,
                        signature,
                        docstring,
                        snippet(symbol_fts, 5, '[', ']', '...', 64) AS snippet,
                        rank
                    FROM symbol_fts
                    WHERE symbol_fts MATCH ?
                      AND symbol_type = ?
                    ORDER BY rank
                    LIMIT ?
                """
                rows = conn.execute(sql, [safe_query, symbol_type, limit]).fetchall()
            else:
                sql = """
                    SELECT
                        file_path,
                        symbol_name,
                        symbol_type,
                        signature,
                        docstring,
                        snippet(symbol_fts, 5, '[', ']', '...', 64) AS snippet,
                        rank
                    FROM symbol_fts
                    WHERE symbol_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                """
                rows = conn.execute(sql, [safe_query, limit]).fetchall()

            results = []
            for row in rows:
                # Get additional metadata from code_symbols
                meta = conn.execute(
                    "SELECT line_start, line_end, parent_class "
                    "FROM code_symbols "
                    "WHERE file_path = ? AND symbol_name = ?",
                    (row["file_path"], row["symbol_name"]),
                ).fetchone()

                results.append({
                    "file_path": row["file_path"],
                    "symbol_name": row["symbol_name"],
                    "symbol_type": row["symbol_type"],
                    "signature": row["signature"],
                    "docstring": row["docstring"],
                    "snippet": row["snippet"],
                    "rank": row["rank"],
                    "line_start": meta["line_start"] if meta else None,
                    "line_end": meta["line_end"] if meta else None,
                    "parent_class": meta["parent_class"] if meta else "",
                })

            return results

        except sqlite3.OperationalError as e:
            logger.error("Symbol FTS search error: %s", e)
            return []
        finally:
            conn.close()

    def find_symbol(self, name: str) -> list[dict[str, Any]]:
        """
        Find a symbol by exact name.

        Args:
            name: Exact symbol name to find (case-sensitive)

        Returns:
            List of dicts with full symbol info: file_path, symbol_name,
            symbol_type, signature, docstring, line_start, line_end,
            parent_class, decorators
        """
        if not self.db_path.exists():
            return []

        conn = self._connect()
        self._ensure_schema(conn)

        try:
            rows = conn.execute(
                "SELECT * FROM code_symbols WHERE symbol_name = ? ORDER BY file_path",
                (name,),
            ).fetchall()

            results = []
            for row in rows:
                decorators = None
                if row["decorators"]:
                    try:
                        decorators = json.loads(row["decorators"])
                    except json.JSONDecodeError:
                        decorators = row["decorators"]

                results.append({
                    "file_path": row["file_path"],
                    "symbol_name": row["symbol_name"],
                    "symbol_type": row["symbol_type"],
                    "signature": row["signature"],
                    "docstring": row["docstring"],
                    "line_start": row["line_start"],
                    "line_end": row["line_end"],
                    "parent_class": row["parent_class"],
                    "decorators": decorators,
                })

            return results

        except sqlite3.OperationalError as e:
            logger.error("find_symbol error: %s", e)
            return []
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Import graph queries (new)
    # ------------------------------------------------------------------

    def find_importers(self, symbol_name: str) -> list[dict[str, Any]]:
        """
        Find all files that import a given symbol name.

        Args:
            symbol_name: The name being imported (e.g., 'SchemaRegistry')

        Returns:
            List of dicts with: source_file, module, line_number
        """
        if not self.db_path.exists():
            return []

        conn = self._connect()
        self._ensure_schema(conn)

        try:
            rows = conn.execute(
                "SELECT source_file, module, line_number "
                "FROM code_imports "
                "WHERE imported_name = ? "
                "ORDER BY source_file",
                (symbol_name,),
            ).fetchall()

            return [
                {
                    "source_file": row["source_file"],
                    "module": row["module"],
                    "line_number": row["line_number"],
                }
                for row in rows
            ]

        except sqlite3.OperationalError as e:
            logger.error("find_importers error: %s", e)
            return []
        finally:
            conn.close()

    def find_imports(self, file_path: str) -> list[dict[str, Any]]:
        """
        Get all imports for a given file.

        Args:
            file_path: Relative path to the file

        Returns:
            List of dicts with: module, imported_name, import_type, line_number
        """
        if not self.db_path.exists():
            return []

        conn = self._connect()
        self._ensure_schema(conn)

        try:
            rows = conn.execute(
                "SELECT module, imported_name, import_type, line_number "
                "FROM code_imports "
                "WHERE source_file = ? "
                "ORDER BY line_number",
                (file_path,),
            ).fetchall()

            return [
                {
                    "module": row["module"],
                    "imported_name": row["imported_name"],
                    "import_type": row["import_type"],
                    "line_number": row["line_number"],
                }
                for row in rows
            ]

        except sqlite3.OperationalError as e:
            logger.error("find_imports error: %s", e)
            return []
        finally:
            conn.close()

    def get_call_graph(self, file_path: str) -> dict[str, Any]:
        """
        Get the import graph for a file.

        Args:
            file_path: Relative path to the file

        Returns:
            {"imports": [...], "imported_by": [...]}
        """
        imports = self.find_imports(file_path)

        # Find files that import this file's module or symbols
        if not self.db_path.exists():
            return {"imports": imports, "imported_by": []}

        conn = self._connect()
        self._ensure_schema(conn)

        try:
            # Get symbols defined in this file
            symbol_rows = conn.execute(
                "SELECT symbol_name FROM code_symbols WHERE file_path = ?",
                (file_path,),
            ).fetchall()
            exported_symbols = {row["symbol_name"] for row in symbol_rows}

            # Find importers by module path pattern or by symbol name
            imported_by: list[dict[str, Any]] = []
            seen: set[str] = set()

            # 1. Files that import the module path
            # Convert file path to module-like pattern
            module_path = file_path.replace("/", ".").replace(".py", "").lstrip(".")
            for pattern in (module_path, file_path):
                rows = conn.execute(
                    "SELECT DISTINCT source_file, module, imported_name "
                    "FROM code_imports "
                    "WHERE module = ? OR module LIKE ? OR imported_name LIKE ?",
                    (pattern, f"{pattern}.%", f"%{pattern}%"),
                ).fetchall()
                for row in rows:
                    key = f"{row['source_file']}|{row['imported_name']}"
                    if key not in seen and row["source_file"] != file_path:
                        seen.add(key)
                        imported_by.append({
                            "source_file": row["source_file"],
                            "module": row["module"],
                            "imported_name": row["imported_name"],
                        })

            # 2. Files that import symbols defined in this file
            for sym_name in exported_symbols:
                rows = conn.execute(
                    "SELECT DISTINCT source_file, module, imported_name "
                    "FROM code_imports "
                    "WHERE imported_name = ? AND source_file != ?",
                    (sym_name, file_path),
                ).fetchall()
                for row in rows:
                    key = f"{row['source_file']}|{row['imported_name']}"
                    if key not in seen:
                        seen.add(key)
                        imported_by.append({
                            "source_file": row["source_file"],
                            "module": row["module"],
                            "imported_name": row["imported_name"],
                        })

            return {"imports": imports, "imported_by": imported_by}

        except sqlite3.OperationalError as e:
            logger.error("get_call_graph error: %s", e)
            return {"imports": imports, "imported_by": []}
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Hybrid search (new)
    # ------------------------------------------------------------------

    def search_hybrid(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        """
        Hybrid search: combine file-level FTS + symbol-level FTS.

        Returns merged results ranked by relevance.

        Args:
            query: Full-text search query
            limit: Max total results

        Returns:
            List of dicts. File-level results have type 'file', symbol-level
            have type 'symbol'. Both include rank for sorting.
        """
        # Get file-level results
        file_results = self.search(query, limit=limit)

        # Get symbol-level results
        symbol_results = self.search_symbols(query, limit=limit)

        # Normalize and merge
        merged: list[dict[str, Any]] = []

        for r in file_results:
            merged.append({
                "type": "file",
                "path": r["path"],
                "snippet": r["snippet"],
                "rank": r["rank"],
            })

        for r in symbol_results:
            merged.append({
                "type": "symbol",
                "file_path": r["file_path"],
                "symbol_name": r["symbol_name"],
                "symbol_type": r["symbol_type"],
                "signature": r["signature"],
                "snippet": r["snippet"],
                "rank": r["rank"],
                "line_start": r["line_start"],
                "line_end": r["line_end"],
                "parent_class": r["parent_class"],
            })

        # Sort by rank (lower is better in FTS5)
        merged.sort(key=lambda x: x["rank"])

        return merged[:limit]

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def get_stats(self) -> dict[str, Any]:
        """Return index statistics."""
        if not self.db_path.exists():
            return {"status": "not_built"}

        conn = self._connect()
        self._ensure_schema(conn)

        total = conn.execute("SELECT COUNT(*) as cnt FROM code_files").fetchone()["cnt"]
        built_at_row = conn.execute(
            "SELECT value FROM index_meta WHERE key = 'built_at'"
        ).fetchone()
        built_at = built_at_row["value"] if built_at_row else "unknown"

        # Extension breakdown
        ext_rows = conn.execute("""
            SELECT
                CASE
                    WHEN path LIKE '%.py' THEN '.py'
                    WHEN path LIKE '%.md' THEN '.md'
                    WHEN path LIKE '%.yaml' OR path LIKE '%.yml' THEN '.yaml'
                    WHEN path LIKE '%.json' THEN '.json'
                    ELSE 'other'
                END as ext,
                COUNT(*) as cnt
            FROM code_files
            GROUP BY ext
            ORDER BY cnt DESC
        """).fetchall()

        # Symbol stats
        symbol_count = 0
        symbol_type_breakdown: dict[str, int] = {}
        try:
            sym_rows = conn.execute(
                "SELECT symbol_type, COUNT(*) as cnt "
                "FROM code_symbols "
                "GROUP BY symbol_type "
                "ORDER BY cnt DESC"
            ).fetchall()
            for sr in sym_rows:
                symbol_type_breakdown[sr["symbol_type"]] = sr["cnt"]
                symbol_count += sr["cnt"]
        except sqlite3.OperationalError:
            pass  # Table might not exist yet

        # Import stats
        import_count = 0
        try:
            imp_row = conn.execute("SELECT COUNT(*) as cnt FROM code_imports").fetchone()
            import_count = imp_row["cnt"] if imp_row else 0
        except sqlite3.OperationalError:
            pass

        conn.close()

        return {
            "status": "built",
            "total_files": total,
            "built_at": built_at,
            "db_path": str(self.db_path),
            "db_size_kb": round(self.db_path.stat().st_size / 1024, 1),
            "by_extension": {row["ext"]: row["cnt"] for row in ext_rows},
            "total_symbols": symbol_count,
            "by_symbol_type": symbol_type_breakdown,
            "total_imports": import_count,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _iter_files(self):
        """Yield all indexable files under SEO_APP_ROOT."""
        for root, dirs, files in os.walk(SEO_APP_ROOT):
            # Prune skip dirs in-place
            dirs[:] = [
                d for d in dirs
                if d not in SKIP_DIRS and not d.startswith(".")
            ]

            for fname in files:
                fpath = Path(root) / fname
                if fpath.suffix.lower() not in INDEXED_EXTENSIONS:
                    continue
                try:
                    if fpath.stat().st_size > MAX_FILE_SIZE:
                        continue
                except OSError:
                    continue
                yield fpath

    # Characters that are special in FTS5 syntax and must be stripped
    # from user queries to prevent parse errors:
    #   :  -> column:term syntax (causes "no such column" errors)
    #   *  -> prefix search operator
    #   ^  -> boost operator
    #   "  -> phrase delimiter
    #   (  -> grouping
    #   )  -> grouping
    #   +  -> required term (some FTS variants)
    #   -  -> excluded term
    #   ~  -> NEAR distance
    #   {  -> column filter syntax
    #   }  -> column filter syntax
    # NOTE: - must be at the end of the character class to be literal.
    _FTS5_SPECIAL_RE = re.compile(r'[:*^"()+{}~-]')

    # FTS5 boolean operators — must match as whole words only
    _FTS5_OPERATOR_RE = re.compile(r'\b(AND|OR|NOT|NEAR)\b')

    @staticmethod
    def _escape_fts_query(query: str) -> str:
        """
        Make a user query safe for FTS5.

        Strips all FTS5 special characters (colons, parens, quotes, etc.)
        and wraps each remaining word in double quotes so FTS5 treats them
        as literal tokens.  Never passes raw user input through.
        """
        query = query.strip()
        if not query:
            return '""'

        # 1. Remove FTS5 special characters that cause parse errors
        cleaned = CodebaseIndexer._FTS5_SPECIAL_RE.sub(" ", query)

        # 2. Remove FTS5 boolean operators used as bare words
        #    (e.g. "NOT" in "do NOT delete") — they confuse the parser
        cleaned = CodebaseIndexer._FTS5_OPERATOR_RE.sub(" ", cleaned)

        # 3. Collapse whitespace and split into tokens
        words = cleaned.split()
        if not words:
            return '""'

        # 4. Quote each word individually (implicit AND in FTS5)
        return " ".join(f'"{w}"' for w in words)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Codebase indexer — build and search the seo-app FTS index",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Build the index:
  python langgraph_agents/indexer.py --build

  # Force rebuild:
  python langgraph_agents/indexer.py --build --force

  # Search globally:
  python langgraph_agents/indexer.py --search "Make.com webhook analytics"

  # Search scoped to Pinterest agent:
  python langgraph_agents/indexer.py --search "analytics sync" --agent SEO-pinterest

  # Symbol-level search:
  python langgraph_agents/indexer.py --search-symbols "queue_post"

  # Find a symbol by name:
  python langgraph_agents/indexer.py --find "SchemaRegistry"

  # Find files that import a symbol:
  python langgraph_agents/indexer.py --importers "SchemaRegistry"

  # Show call graph for a file:
  python langgraph_agents/indexer.py --call-graph "lib/schema_registry.py"

  # Hybrid search:
  python langgraph_agents/indexer.py --hybrid "webhook analytics"

  # Show index stats:
  python langgraph_agents/indexer.py --stats
        """,
    )
    parser.add_argument("--build", action="store_true", help="Build/update the index")
    parser.add_argument("--force", action="store_true", help="Force full rebuild")
    parser.add_argument("--search", type=str, metavar="QUERY", help="Search the index (whole-file)")
    parser.add_argument("--search-symbols", type=str, metavar="QUERY",
                        help="Search at symbol granularity")
    parser.add_argument("--hybrid", type=str, metavar="QUERY",
                        help="Hybrid search (file + symbol)")
    parser.add_argument("--find", type=str, metavar="SYMBOL",
                        help="Find a symbol by exact name")
    parser.add_argument("--importers", type=str, metavar="NAME",
                        help="Find files that import a given symbol")
    parser.add_argument("--call-graph", type=str, metavar="FILE",
                        help="Show import graph for a file")
    parser.add_argument("--agent", type=str, metavar="AGENT_ID",
                        help="Scope search to agent (e.g. SEO-pinterest)")
    parser.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--stats", action="store_true", help="Show index statistics")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    idx = CodebaseIndexer()

    if args.build:
        print(f"\n[BUILD] Building codebase index...")
        print(f"    Root: {SEO_APP_ROOT}")
        print(f"    DB:   {idx.db_path}\n")
        stats = idx.build(force=args.force, verbose=True)
        print(f"\n[DONE] {stats['indexed']} indexed, "
              f"{stats['skipped']} skipped, {stats['errors']} errors")
        return

    if args.stats:
        s = idx.get_stats()
        if s["status"] == "not_built":
            print("Index not built yet. Run --build first.")
        else:
            print(f"\n[STATS] Codebase Index")
            print(f"    Status:         {s['status']}")
            print(f"    Total files:    {s['total_files']}")
            print(f"    Total symbols:  {s.get('total_symbols', 0)}")
            print(f"    Total imports:  {s.get('total_imports', 0)}")
            print(f"    Built at:       {s['built_at']}")
            print(f"    DB size:        {s['db_size_kb']} KB")
            print(f"    DB path:        {s['db_path']}")
            print(f"    By extension:")
            for ext, cnt in s["by_extension"].items():
                print(f"      {ext:8s}: {cnt}")
            if s.get("by_symbol_type"):
                print(f"    By symbol type:")
                for st, cnt in s["by_symbol_type"].items():
                    print(f"      {st:8s}: {cnt}")
        return

    def _ensure_index_exists() -> None:
        if not idx.db_path.exists():
            print("Index not built yet. Run --build first.")
            sys.exit(1)

    if args.search:
        _ensure_index_exists()
        scope_note = f" (scoped to {args.agent})" if args.agent else ""
        print(f"\n[SEARCH] '{args.search}'{scope_note}")
        results = idx.search(
            args.search,
            limit=args.limit,
            agent_scope=args.agent,
        )

        if not results:
            print("  No results found.")
        else:
            print(f"  {len(results)} result(s):\n")
            for i, r in enumerate(results, 1):
                print(f"  [{i}] {r['path']}  ({r['line_count']} lines)")
                snippet = r['snippet'].encode(
                    sys.stdout.encoding or 'utf-8', errors='replace'
                ).decode(sys.stdout.encoding or 'utf-8', errors='replace')
                print(f"       {snippet}")
                print()
        return

    if args.search_symbols:
        _ensure_index_exists()
        print(f"\n[SEARCH-SYMBOLS] '{args.search_symbols}'")
        results = idx.search_symbols(args.search_symbols, limit=args.limit)

        if not results:
            print("  No symbols found.")
        else:
            print(f"  {len(results)} symbol(s):\n")
            for i, r in enumerate(results, 1):
                print(f"  [{i}] {r['symbol_type']:8s} {r['symbol_name']}")
                print(f"       File:  {r['file_path']}  (lines {r['line_start']}-{r['line_end']})")
                if r['signature']:
                    print(f"       Sig:   {r['signature']}")
                if r['docstring']:
                    doc = r['docstring'].split('\n')[0][:100]
                    print(f"       Doc:   {doc}")
                snippet = r['snippet'].encode(
                    sys.stdout.encoding or 'utf-8', errors='replace'
                ).decode(sys.stdout.encoding or 'utf-8', errors='replace')
                print(f"       Src:   {snippet}")
                print()
        return

    if args.hybrid:
        _ensure_index_exists()
        print(f"\n[HYBRID] '{args.hybrid}'")
        results = idx.search_hybrid(args.hybrid, limit=args.limit)

        if not results:
            print("  No results found.")
        else:
            print(f"  {len(results)} result(s):\n")
            for i, r in enumerate(results, 1):
                if r["type"] == "file":
                    print(f"  [{i}] [FILE]   {r['path']}")
                else:
                    print(f"  [{i}] [SYMBOL] {r['symbol_type']:8s} {r['symbol_name']}  ({r['file_path']})")
                snippet = r['snippet'].encode(
                    sys.stdout.encoding or 'utf-8', errors='replace'
                ).decode(sys.stdout.encoding or 'utf-8', errors='replace')
                print(f"         {snippet}")
                print()
        return

    if args.find:
        _ensure_index_exists()
        print(f"\n[FIND] Symbol: '{args.find}'")
        results = idx.find_symbol(args.find)

        if not results:
            print("  Symbol not found.")
        else:
            print(f"  Found in {len(results)} location(s):\n")
            for i, r in enumerate(results, 1):
                print(f"  [{i}] {r['file_path']}")
                print(f"       Type:    {r['symbol_type']}")
                print(f"       Lines:   {r['line_start']}-{r['line_end']}")
                if r['signature']:
                    print(f"       Sig:     {r['signature']}")
                if r['parent_class']:
                    print(f"       Parent:  {r['parent_class']}")
                if r['decorators']:
                    print(f"       Decor:   {r['decorators']}")
                if r['docstring']:
                    doc = r['docstring'].split('\n')[0][:120]
                    print(f"       Doc:     {doc}")
                print()
        return

    if args.importers:
        _ensure_index_exists()
        print(f"\n[IMPORTERS] Who imports '{args.importers}'?")
        results = idx.find_importers(args.importers)

        if not results:
            print("  No importers found.")
        else:
            print(f"  {len(results)} importer(s):\n")
            for i, r in enumerate(results, 1):
                mod_info = f" (from {r['module']})" if r['module'] else ""
                print(f"  [{i}] {r['source_file']}  line {r['line_number']}{mod_info}")
        return

    if args.call_graph:
        _ensure_index_exists()
        print(f"\n[CALL-GRAPH] File: '{args.call_graph}'")
        graph = idx.get_call_graph(args.call_graph)

        if graph["imports"]:
            print(f"\n  Imports ({len(graph['imports'])}):")
            for imp in graph["imports"]:
                mod = imp["module"] or "(bare)"
                name = imp["imported_name"] or mod
                print(f"    line {imp['line_number']:3d}  {imp['import_type']:6s}  {name:40s}  (module: {mod})")
        else:
            print("\n  Imports: none")

        if graph["imported_by"]:
            print(f"\n  Imported by ({len(graph['imported_by'])}):")
            for ib in graph["imported_by"]:
                mod = ib["module"] or ""
                name = ib["imported_name"] or ""
                print(f"    {ib['source_file']:50s}  imports {name}  (from {mod})")
        else:
            print("\n  Imported by: none")
        return

    parser.print_help()


if __name__ == "__main__":
    main()
