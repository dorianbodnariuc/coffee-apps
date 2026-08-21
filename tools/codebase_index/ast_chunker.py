"""
AST-Aware Python Code Chunker — parses .py files into structured code symbols.

Extracts classes, functions, methods with line ranges, docstrings, signatures,
decorators, and imports. Uses only Python's stdlib (ast, dataclasses, pathlib).

Usage::

    from tools.codebase_index.ast_chunker import ASTChunker

    chunker = ASTChunker()
    chunks = chunker.chunk_file(Path("lib/schema_registry.py"))
    for c in chunks:
        print(f"{c.symbol_type:8s} {c.symbol_name:40s} lines {c.line_start}-{c.line_end}")

    imports = chunker.extract_imports(source, "lib/schema_registry.py")
"""

from __future__ import annotations

import ast
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────
# Data model
# ──────────────────────────────────────────────────────────────────────


@dataclass
class CodeChunk:
    """A single indexable code symbol extracted from a .py file."""

    file_path: str
    """Relative path to the source file (e.g. ``"lib/schema_registry.py"``)."""

    symbol_name: str
    """Qualified name of the symbol (e.g. ``"SchemaRegistry.queue_post"``)."""

    symbol_type: str
    """One of ``"class"``, ``"function"``, ``"method"``, ``"module"``."""

    signature: str
    """Function/method/class signature line (e.g. ``"def queue_post(self, ...)"``)."""

    docstring: str
    """Extracted docstring, or empty string if none."""

    line_start: int
    """First line number (1-indexed)."""

    line_end: int
    """Last line number (1-indexed)."""

    source: str
    """Full source code of this symbol."""

    decorators: list[str] = field(default_factory=list)
    """Decorator names (e.g. ``["@staticmethod", "@property"]``)."""

    parent_class: str = ""
    """Parent class name if this is a method/nested class, otherwise empty string."""


# ──────────────────────────────────────────────────────────────────────
# ASTChunker
# ──────────────────────────────────────────────────────────────────────


class ASTChunker:
    """Parse .py files into structured :class:`CodeChunk` objects.

    Handles all Python constructs: module-level functions, classes,
    methods, nested classes, async functions, and decorators.  Always
    includes a ``"module"``-typed chunk for backward compatibility with
    full-text indexers.

    Gracefully handles syntax errors by returning an empty list.
    """

    def chunk_file(self, file_path: Path) -> list[CodeChunk]:
        """Parse a ``.py`` file and return a list of :class:`CodeChunk` objects.

        Args:
            file_path: Absolute or relative path to a ``.py`` file.

        Returns:
            List of code chunks.  Returns an empty list if the file cannot
            be read or parsed.
        """
        try:
            source = file_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            logger.warning("Cannot read %s: %s", file_path, exc)
            return []

        rel_path = str(file_path)
        # Try to make it relative to CWD for cleaner display
        try:
            rel_path = str(file_path.resolve().relative_to(Path.cwd()))
        except ValueError:
            pass

        return self.chunk_python_source(source, rel_path)

    def chunk_python_source(
        self, source: str, file_path: str
    ) -> list[CodeChunk]:
        """Parse a Python source string and return chunks.

        Args:
            source: Raw Python source code as a string.
            file_path: Logical path for the file (used in ``CodeChunk.file_path``).

        Returns:
            List of :class:`CodeChunk` objects.
        """
        # Always include a module-level chunk for backward compat
        module_docstring = ""
        line_count = len(source.splitlines()) or 1
        if source.strip():
            try:
                module_tree = ast.parse(source)
                module_docstring = ast.get_docstring(module_tree) or ""
            except SyntaxError:
                pass
        chunks: list[CodeChunk] = [
            CodeChunk(
                file_path=file_path,
                symbol_name=file_path,
                symbol_type="module",
                signature="",
                docstring=module_docstring,
                line_start=1,
                line_end=line_count,
                source=source,
            )
        ]

        if not source.strip():
            return chunks

        try:
            tree = ast.parse(source)
        except SyntaxError as exc:
            logger.warning("Syntax error in %s: %s", file_path, exc)
            return chunks

        # Walk top-level nodes
        for node in ast.iter_child_nodes(tree):
            extracted = self._extract_symbol(
                node, source, file_path, parent_class=""
            )
            if extracted is not None:
                if isinstance(extracted, list):
                    chunks.extend(extracted)
                else:
                    chunks.append(extracted)

        return chunks

    def extract_imports(
        self, source: str, file_path: str
    ) -> list[dict[str, Any]]:
        """Extract all imports from a ``.py`` file.

        Args:
            source: Raw Python source code as a string.
            file_path: Logical path for the file (used in the ``source`` key
                       of returned dicts).

        Returns:
            List of import dicts.  Each dict has keys: ``source``, ``module``,
            ``imported_names``, ``import_type``, ``line``.

            - ``"source"``: the file path
            - ``"module"``: the module being imported (e.g. ``"lib.schema_delivery_bridge"``)
            - ``"imported_names"``: list of imported names (empty for bare imports)
            - ``"import_type"``: ``"import"`` or ``"from"``
            - ``"line"``: line number (1-indexed)
        """
        imports: list[dict[str, Any]] = []

        if not source.strip():
            return imports

        try:
            tree = ast.parse(source)
        except SyntaxError as exc:
            logger.warning("Syntax error in %s: %s", file_path, exc)
            return imports

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(
                        {
                            "source": file_path,
                            "module": alias.name,
                            "imported_names": [alias.asname] if alias.asname else [],
                            "import_type": "import",
                            "line": node.lineno,
                        }
                    )
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                names: list[str] = []
                for alias in node.names:
                    if alias.name == "*":
                        names.append("*")
                    else:
                        names.append(alias.asname or alias.name)
                imports.append(
                    {
                        "source": file_path,
                        "module": module,
                        "imported_names": names,
                        "import_type": "from",
                        "line": node.lineno,
                    }
                )

        return imports

    # ──────────────────────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────────────────────

    def _extract_symbol(
        self,
        node: ast.AST,
        source: str,
        file_path: str,
        parent_class: str,
    ) -> CodeChunk | list[CodeChunk] | None:
        """Extract a CodeChunk (or list of chunks) from an AST node.

        Returns:
            A single CodeChunk, a list of CodeChunks (for a class containing
            methods), or None if the node is not a recognised symbol.
        """
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return self._extract_function(
                node, source, file_path, parent_class
            )

        if isinstance(node, ast.ClassDef):
            return self._extract_class(node, source, file_path, parent_class)

        return None

    def _extract_function(
        self,
        node: ast.FunctionDef | ast.AsyncFunctionDef,
        source: str,
        file_path: str,
        parent_class: str,
    ) -> CodeChunk:
        """Build a CodeChunk for a function or method."""
        is_async = isinstance(node, ast.AsyncFunctionDef)
        symbol_type = "method" if parent_class else "function"

        # Build qualified name
        if parent_class:
            qualified_name = f"{parent_class}.{node.name}"
        else:
            qualified_name = node.name

        # Signature
        signature = self._build_signature(node, source, is_async)

        # Docstring
        docstring = ast.get_docstring(node) or ""

        # Line range
        line_start = node.lineno
        line_end = node.end_lineno or line_start

        # Source
        try:
            src = ast.get_source_segment(source, node) or ""
        except Exception:
            src = ""

        # Decorators
        decorators = self._extract_decorators(node)

        return CodeChunk(
            file_path=file_path,
            symbol_name=qualified_name,
            symbol_type=symbol_type,
            signature=signature,
            docstring=docstring,
            line_start=line_start,
            line_end=line_end,
            source=src,
            decorators=decorators,
            parent_class=parent_class,
        )

    def _extract_class(
        self,
        node: ast.ClassDef,
        source: str,
        file_path: str,
        parent_class: str,
    ) -> list[CodeChunk]:
        """Build chunks for a class and all its methods/nested classes."""
        chunks: list[CodeChunk] = []

        if parent_class:
            qualified_name = f"{parent_class}.{node.name}"
            symbol_type_parent = parent_class
        else:
            qualified_name = node.name
            symbol_type_parent = ""

        # Signature for the class itself
        bases = [ast.unparse(b) if hasattr(ast, "unparse") else ast.dump(b) for b in node.bases]
        if bases:
            signature = f"class {node.name}({', '.join(bases)})"
        else:
            signature = f"class {node.name}"

        docstring = ast.get_docstring(node) or ""

        line_start = node.lineno
        line_end = node.end_lineno or line_start

        try:
            src = ast.get_source_segment(source, node) or ""
        except Exception:
            src = ""

        decorators = self._extract_decorators(node)

        # The class itself as a chunk
        chunks.append(
            CodeChunk(
                file_path=file_path,
                symbol_name=qualified_name,
                symbol_type="class",
                signature=signature,
                docstring=docstring,
                line_start=line_start,
                line_end=line_end,
                source=src,
                decorators=decorators,
                parent_class=symbol_type_parent,
            )
        )

        # Recurse into class body for methods and nested classes
        for child in node.body:
            extracted = self._extract_symbol(
                child, source, file_path, parent_class=qualified_name
            )
            if extracted is not None:
                if isinstance(extracted, list):
                    chunks.extend(extracted)
                else:
                    chunks.append(extracted)

        return chunks

    def _build_signature(
        self,
        node: ast.FunctionDef | ast.AsyncFunctionDef,
        source: str,
        is_async: bool,
    ) -> str:
        """Reconstruct the function/method signature from the AST node.

        Falls back to ``ast.get_source_segment`` for the first line if
        reconstruction is problematic.
        """
        prefix = "async def " if is_async else "def "

        try:
            args_str = self._format_args(node.args)
            returns_str = ""
            if node.returns:
                returns_str = f" -> {ast.unparse(node.returns)}"
            return f"{prefix}{node.name}({args_str}){returns_str}"
        except Exception:
            # Fallback: grab the first line from source
            try:
                segment = ast.get_source_segment(source, node)
                if segment:
                    return segment.split("\n")[0].strip().rstrip(":")
            except Exception:
                pass
            return f"{prefix}{node.name}(...)"

    def _format_args(self, args: ast.arguments) -> str:
        """Format the arguments of a function definition into a string."""
        parts: list[str] = []

        # Positional-only args (Python 3.8+)
        if hasattr(args, "posonlyargs"):
            for arg in args.posonlyargs:
                parts.append(self._format_arg(arg))

        # Regular args (with possible defaults)
        # args.defaults is aligned to the *last* N args (N = len(defaults))
        num_no_default = len(args.args) - len(args.defaults)
        for i, arg in enumerate(args.args):
            # Skip args that are already covered by posonlyargs
            if hasattr(args, "posonlyargs") and i < len(args.posonlyargs):
                continue
            if i >= num_no_default:
                default_idx = i - num_no_default
                if default_idx < len(args.defaults) and args.defaults[default_idx] is not None:
                    parts.append(
                        f"{self._format_arg(arg)}={ast.unparse(args.defaults[default_idx])}"
                    )
                else:
                    parts.append(self._format_arg(arg))
            else:
                parts.append(self._format_arg(arg))

        # *args
        if args.vararg:
            parts.append(self._format_arg(args.vararg, prefix="*"))

        # Keyword-only args (after *)
        kwonly_count = len(args.kwonlyargs)
        if kwonly_count > 0 and not args.vararg:
            parts.append("*")
        for i, arg in enumerate(args.kwonlyargs):
            first_default_idx = len(args.kwonlyargs) - len(args.kw_defaults)
            default_idx = i - first_default_idx
            if (
                default_idx >= 0
                and default_idx < len(args.kw_defaults)
                and args.kw_defaults[default_idx] is not None
            ):
                default_expr: ast.expr = args.kw_defaults[default_idx]  # type: ignore[assignment]
                parts.append(
                    f"{self._format_arg(arg)}={ast.unparse(default_expr)}"
                )
            else:
                parts.append(self._format_arg(arg))

        # **kwargs
        if args.kwarg:
            parts.append(self._format_arg(args.kwarg, prefix="**"))

        return ", ".join(parts)

    @staticmethod
    def _format_arg(arg: ast.arg, prefix: str = "") -> str:
        """Format a single argument with optional annotation."""
        result = f"{prefix}{arg.arg}"
        if arg.annotation:
            result += f": {ast.unparse(arg.annotation)}"
        return result

    @staticmethod
    def _extract_decorators(
        node: ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef,
    ) -> list[str]:
        """Extract decorator names from a node."""
        decorators: list[str] = []
        for dec in node.decorator_list:
            if isinstance(dec, ast.Name):
                decorators.append(f"@{dec.id}")
            elif isinstance(dec, ast.Attribute):
                decorators.append(
                    f"@{ast.unparse(dec)}"
                )
            elif isinstance(dec, ast.Call):
                if isinstance(dec.func, ast.Name):
                    decorators.append(f"@{dec.func.id}(...)")
                elif isinstance(dec.func, ast.Attribute):
                    decorators.append(f"@{ast.unparse(dec.func)}(...)")
                else:
                    decorators.append(f"@<call>")
            else:
                decorators.append("@<unknown>")
        return decorators


# ──────────────────────────────────────────────────────────────────────
# Quick smoke-test (run directly)
# ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    chunker = ASTChunker()
    test_files = [
        Path(__file__).resolve().parent.parent / "lib" / "schema_registry.py",
        Path(__file__).resolve().parent.parent / "lib" / "schema_improvement.py",
        Path(__file__).resolve().parent.parent / "lib" / "schema_delivery_bridge.py",
    ]

    for tf in test_files:
        print(f"\n{'=' * 70}")
        print(f"File: {tf.name}")
        print(f"{'=' * 70}")

        chunks = chunker.chunk_file(tf)
        print(f"Chunks extracted: {len(chunks)}")
        print()
        for c in chunks:
            print(
                f"  [{c.symbol_type:8s}] {c.symbol_name:50s} "
                f"lines {c.line_start:4d}-{c.line_end:<4d}"
            )
            if c.decorators:
                print(f"            decorators: {c.decorators}")
            if c.parent_class:
                print(f"            parent_class: {c.parent_class}")

        # Imports
        try:
            source = tf.read_text(encoding="utf-8")
            imports = chunker.extract_imports(source, str(tf.name))
            print(f"\n  Imports extracted: {len(imports)}")
            for imp in imports[:10]:  # First 10 only
                names = ", ".join(imp["imported_names"]) if imp["imported_names"] else "(bare)"
                print(
                    f"    line {imp['line']:3d}  {imp['import_type']:6s}  "
                    f"{imp['module']:45s}  → {names}"
                )
            if len(imports) > 10:
                print(f"    ... and {len(imports) - 10} more")
        except Exception as exc:
            print(f"\n  Import extraction failed: {exc}")
