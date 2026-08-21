#!/usr/bin/env python3
"""MCP server exposing the seo-app codebase index to Hermes agents.

Provides 7 tools:
  - search_code      – Full-text search across the codebase
  - search_symbols   – Symbol-level search (functions, classes, methods)
  - find_symbol      – Find a symbol by exact name
  - find_importers   – Who imports a given symbol?
  - get_call_graph   – Import graph for a file
  - search_hybrid    – Combined file + symbol search
  - get_stats        – Index statistics

Usage:
    python codebase_mcp_server.py
    (the server runs on stdio — pipe MCP JSON-RPC messages over stdin/out)

Environment:
    SEO_APP_ROOT – project root (default: /home/dorian/seo-app-dev)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from pathlib import Path

# ── Configure logging to stderr (stdout is the MCP transport) ───────────────
logging.basicConfig(
    level=logging.WARNING,  # only show warnings+ by default; set SEO_MCP_LOG=DEBUG for more
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stderr,
)
logger = logging.getLogger("codebase-mcp")

# Honour SEO_MCP_LOG for verbosity control
if os.environ.get("SEO_MCP_LOG", "").upper() in ("DEBUG", "VERBOSE"):
    logger.setLevel(logging.DEBUG)

# ── Add project root to path ────────────────────────────────────────────────
# This server lives inside coffee-apps/tools/codebase_index/, so its project
# root is two levels up. Override via COFFEE_APPS_ROOT env if needed.
PROJECT_ROOT = os.environ.get(
    "COFFEE_APPS_ROOT",
    str(Path(__file__).resolve().parents[2]),  # /home/dorian/coffee-apps
)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from mcp.server import Server
from mcp.server.stdio import stdio_server
import mcp.types as types

# ── Lazy indexer initialisation ─────────────────────────────────────────────
_indexer = None


def get_indexer():
    """Return the CodebaseIndexer singleton, loading it on first access."""
    global _indexer
    if _indexer is None:
        from tools.codebase_index.indexer import CodebaseIndexer

        _indexer = CodebaseIndexer()
        logger.info("CodebaseIndexer loaded (db=%s)", _indexer.db_path)
    return _indexer


# ── Helpers ─────────────────────────────────────────────────────────────────


def _json_result(obj) -> str:
    """Serialize *obj* to a JSON string, handling non-serializable types."""
    return json.dumps(obj, indent=2, ensure_ascii=False, default=str)


def _error_json(msg: str) -> str:
    """Return a JSON error envelope."""
    return json.dumps({"error": True, "message": msg}, indent=2)


# ── Server ──────────────────────────────────────────────────────────────────

server = Server("codebase-index")


@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="search_code",
            description=(
                "Full-text search across the seo-app codebase. "
                "Searches all .py, .md, .yaml, .yml, .json files. "
                "Returns matching files with code snippets."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query (FTS5 syntax supported — "
                        "special characters are automatically sanitised)",
                    },
                    "limit": {
                        "type": "integer",
                        "default": 10,
                        "description": "Maximum number of results",
                    },
                    "path_filter": {
                        "type": "string",
                        "description": "Only return results whose path contains this substring",
                    },
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="search_symbols",
            description=(
                "Symbol-level search — find functions, classes, and methods. "
                "Much more targeted than raw text search."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query (FTS5 syntax)",
                    },
                    "symbol_type": {
                        "type": "string",
                        "description": "Filter by symbol kind: 'function', 'class', or 'method'",
                        "enum": ["function", "class", "method", "module"],
                    },
                    "limit": {
                        "type": "integer",
                        "default": 10,
                        "description": "Maximum number of results",
                    },
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="find_symbol",
            description=(
                "Find a symbol by its exact name (case-sensitive). "
                "Returns definition details: file, line range, signature, docstring, decorators."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Exact symbol name to find",
                    },
                },
                "required": ["name"],
            },
        ),
        types.Tool(
            name="find_importers",
            description=(
                "Find all files that import a given symbol name. "
                "Useful for understanding dependencies and impact analysis."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol_name": {
                        "type": "string",
                        "description": "The name being imported (e.g., 'SchemaRegistry')",
                    },
                },
                "required": ["symbol_name"],
            },
        ),
        types.Tool(
            name="get_call_graph",
            description=(
                "Show the import graph for a file — what it imports and "
                "what files import its symbols."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": (
                            "Relative path to a file in the seo-app tree "
                            "(e.g., 'lib/schema_registry.py')"
                        ),
                    },
                },
                "required": ["file_path"],
            },
        ),
        types.Tool(
            name="search_hybrid",
            description=(
                "Combined file-level + symbol-level search. Returns the best "
                "matches regardless of whether they are whole files or individual symbols."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query (FTS5 syntax)",
                    },
                    "limit": {
                        "type": "integer",
                        "default": 10,
                        "description": "Maximum number of results",
                    },
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="get_stats",
            description=(
                "Return index statistics: total files, symbols, imports, "
                "breakdown by file extension and symbol type, build timestamp."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    logger.debug("Tool called: %s  args=%s", name, arguments)

    try:
        idx = get_indexer()
    except Exception as e:
        logger.exception("Failed to initialise CodebaseIndexer")
        return [types.TextContent(type="text", text=_error_json(f"Indexer init failed: {e}"))]

    try:
        if name == "search_code":
            query = arguments.get("query", "")
            if not query:
                return [types.TextContent(type="text", text=_error_json("Missing 'query'"))]
            results = idx.search(
                query,
                limit=arguments.get("limit", 10),
                path_filter=arguments.get("path_filter"),
            )
            return [types.TextContent(type="text", text=_json_result(results))]

        elif name == "search_symbols":
            query = arguments.get("query", "")
            if not query:
                return [types.TextContent(type="text", text=_error_json("Missing 'query'"))]
            results = idx.search_symbols(
                query,
                symbol_type=arguments.get("symbol_type"),
                limit=arguments.get("limit", 10),
            )
            return [types.TextContent(type="text", text=_json_result(results))]

        elif name == "find_symbol":
            sym_name = arguments.get("name", "")
            if not sym_name:
                return [types.TextContent(type="text", text=_error_json("Missing 'name'"))]
            results = idx.find_symbol(sym_name)
            return [types.TextContent(type="text", text=_json_result(results))]

        elif name == "find_importers":
            sym_name = arguments.get("symbol_name", "")
            if not sym_name:
                return [types.TextContent(type="text", text=_error_json("Missing 'symbol_name'"))]
            results = idx.find_importers(sym_name)
            return [types.TextContent(type="text", text=_json_result(results))]

        elif name == "get_call_graph":
            file_path = arguments.get("file_path", "")
            if not file_path:
                return [types.TextContent(type="text", text=_error_json("Missing 'file_path'"))]
            results = idx.get_call_graph(file_path)
            return [types.TextContent(type="text", text=_json_result(results))]

        elif name == "search_hybrid":
            query = arguments.get("query", "")
            if not query:
                return [types.TextContent(type="text", text=_error_json("Missing 'query'"))]
            results = idx.search_hybrid(
                query,
                limit=arguments.get("limit", 10),
            )
            return [types.TextContent(type="text", text=_json_result(results))]

        elif name == "get_stats":
            results = idx.get_stats()
            return [types.TextContent(type="text", text=_json_result(results))]

        else:
            return [types.TextContent(type="text", text=_error_json(f"Unknown tool: {name}"))]

    except Exception as e:
        logger.exception("Tool '%s' raised an error", name)
        return [types.TextContent(type="text", text=_error_json(str(e)))]


# ── Entry point ─────────────────────────────────────────────────────────────


async def main() -> None:
    """Run the MCP server on stdio."""
    logger.info("Starting codebase-index MCP server (project=%s)", PROJECT_ROOT)
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
