"""Typst compile engine shared by the `render_pdf` handler and `POST /preview`.

Follows the sys.inputs contract of templates/typst/render.py:
  data    JSON string
  photo   optional, compile-root-relative path with a leading "/"
  accent  optional "#RRGGBB"
  paper   optional "a4" | "letter"

`typst.Compiler` objects keep fonts and parsed sources cached between
compiles (warm preview ≈ 5–30 ms), so the engine keeps a small pool of them.
A Compiler is not safe to use from two threads at once, hence the pool.
"""

from __future__ import annotations

import json
import os
import queue
import re
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

import typst

from .config import get_render_settings

ACCENT_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
PAPERS = {"a4", "letter"}
TEMPLATE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


class RenderError(Exception):
    """Deterministic failure (bad template id, Typst error, failed checks): retrying won't help."""


@dataclass(frozen=True)
class TemplateMeta:
    id: str
    name: str
    kind: str  # resume | cover_letter
    photo: bool
    one_page: bool
    default_paper: str
    default_accent: str | None
    raw: dict[str, Any]


class TypstEngine:
    def __init__(self, templates_dir: Path | None = None, pool_size: int = 4) -> None:
        self.templates_dir = (templates_dir or get_render_settings().templates_dir).resolve()
        if not (self.templates_dir / "_lib").is_dir():
            raise RuntimeError(f"Typst templates not found at {self.templates_dir}")
        self.fonts_dir = self.templates_dir / "fonts"
        self._metas: dict[str, TemplateMeta] = {}
        self._load_metas()
        self._pool: queue.Queue[typst.Compiler] = queue.Queue()
        self._pool_size = pool_size
        self._created = 0
        self._lock = threading.Lock()

    # ------------------------------------------------------------ templates
    def _load_metas(self) -> None:
        for meta_path in sorted(self.templates_dir.glob("*/meta.json")):
            raw = json.loads(meta_path.read_text())
            tid = meta_path.parent.name
            page = raw.get("page") or {}
            accent = raw.get("accent") or {}
            self._metas[tid] = TemplateMeta(
                id=tid,
                name=raw.get("name", tid),
                kind=raw.get("kind", "resume"),
                photo=bool(raw.get("photo")),
                one_page=bool(raw.get("onePage")),
                default_paper=page.get("default", "a4"),
                default_accent=accent.get("default"),
                raw=raw,
            )

    @property
    def template_ids(self) -> list[str]:
        return sorted(self._metas)

    def meta(self, template_id: str) -> TemplateMeta:
        if not isinstance(template_id, str) or not TEMPLATE_ID_RE.match(template_id) or template_id not in self._metas:
            raise RenderError(f"unknown Typst template {template_id!r}; known: {self.template_ids}")
        return self._metas[template_id]

    def default_template(self, kind: str) -> str:
        return {"resume": "modern", "cover_letter": "cover-modern"}.get(kind, "modern")

    # ------------------------------------------------------------- compilers
    @contextmanager
    def _compiler(self) -> Iterator[typst.Compiler]:
        try:
            comp = self._pool.get_nowait()
        except queue.Empty:
            with self._lock:
                create = self._created < self._pool_size
                if create:
                    self._created += 1
            if create:
                comp = typst.Compiler(
                    root=str(self.templates_dir),
                    font_paths=[str(self.fonts_dir)],
                    ignore_system_fonts=True,
                )
            else:
                comp = self._pool.get()
        try:
            yield comp
        finally:
            self._pool.put(comp)

    def warm_up(self) -> None:
        """Compile every template once so the first preview is fast."""
        sample_dir = self.templates_dir / "samples"
        for tid, meta in self._metas.items():
            sample = sample_dir / ("resume-full.json" if meta.kind == "resume" else "cover-letter.json")
            if sample.is_file():
                try:
                    self.compile(tid, sample.read_text(), fmt="png", ppi=36)
                except Exception:  # noqa: BLE001
                    pass

    # --------------------------------------------------------------- compile
    def build_inputs(
        self,
        data: dict | str,
        *,
        photo: str | os.PathLike | None = None,
        accent: str | None = None,
        paper: str | None = None,
    ) -> tuple[dict[str, str], Path]:
        inputs = {"data": data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)}
        root = self.templates_dir
        if photo:
            photo_path = Path(photo).resolve()
            if not photo_path.is_file():
                raise FileNotFoundError(f"photo not found: {photo_path}")
            root = Path(os.path.commonpath([self.templates_dir, photo_path.parent]))
            inputs["photo"] = "/" + photo_path.relative_to(root).as_posix()
        if accent and ACCENT_RE.match(accent):
            inputs["accent"] = accent
        if paper and paper in PAPERS:
            inputs["paper"] = paper
        return inputs, root

    def compile(
        self,
        template_id: str,
        data: dict | str,
        *,
        fmt: str = "pdf",
        photo: str | os.PathLike | None = None,
        accent: str | None = None,
        paper: str | None = None,
        ppi: float | None = None,
    ) -> list[bytes]:
        """Compile and always return a list of pages (one item for PDF)."""
        self.meta(template_id)
        if fmt not in ("pdf", "png", "svg"):
            raise ValueError(f"bad format {fmt!r}")
        inputs, root = self.build_inputs(data, photo=photo, accent=accent, paper=paper)
        with self._compiler() as comp:
            try:
                out = comp.compile(
                    input=str(self.templates_dir / template_id / "main.typ"),
                    root=str(root),
                    format=fmt,
                    ppi=ppi,
                    sys_inputs=inputs,
                )
            except typst.TypstError as exc:
                diag = getattr(exc, "diagnostic", None) or str(exc)
                raise RenderError(f"Typst compile failed: {diag}") from exc
        return out if isinstance(out, list) else [out]


_engine: TypstEngine | None = None
_engine_lock = threading.Lock()


def get_engine() -> TypstEngine:
    global _engine
    with _engine_lock:
        if _engine is None:
            _engine = TypstEngine()
        return _engine
