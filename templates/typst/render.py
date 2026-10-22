#!/usr/bin/env python3
"""Render an NextMilestone Typst template.

CLI:
    uv run --python 3.12 --with typst python templates/typst/render.py \
        TEMPLATE_ID DATA.json OUT.(pdf|png|svg) \
        [--photo PATH] [--accent '#RRGGBB'] [--paper a4|letter] [--ppi N | --width PX] [--all-pages]

    uv run --python 3.12 --with typst python templates/typst/render.py thumbnails [ID ...]

Library (used by the worker):
    from render import render
    pdf_bytes = render("modern", data_dict, fmt="pdf", accent="#0f766e")

Contract (what main.typ reads from `sys.inputs`, all strings):
    data    JSON string. Resume templates: JSON Resume (resumes.content_json,
            incl. meta.sectionOrder / meta.hiddenSections / meta.labels) or the
            legacy ResumeContent shape. Cover letters: {basics, recipient, date,
            subject?, salutation, paragraphs[] | content, closing, signature}.
    photo   optional; path of the image *relative to the compile root*, written
            with a leading "/" (e.g. "/tmp/job123/photo.jpg" when root="/").
            render() computes this for you from a normal filesystem path.
    accent  optional; "#RRGGBB". Invalid values fall back to the template default.
    paper   optional; "a4" (default) or "letter".

Only the bundled fonts in templates/typst/fonts are used (system fonts ignored).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import typst

HERE = Path(__file__).resolve().parent
FONTS_DIR = HERE / "fonts"


def template_ids() -> list[str]:
    return sorted(p.parent.name for p in HERE.glob("*/meta.json"))


def load_meta(template_id: str) -> dict[str, Any]:
    return json.loads((HERE / template_id / "meta.json").read_text())


def build_inputs(
    data: dict | str,
    *,
    photo: str | os.PathLike | None = None,
    accent: str | None = None,
    paper: str | None = None,
) -> tuple[dict[str, str], Path]:
    """Return (sys_inputs, compile_root)."""
    inputs = {"data": data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)}
    root = HERE
    if photo:
        photo_path = Path(photo).resolve()
        if not photo_path.is_file():
            raise FileNotFoundError(f"photo not found: {photo_path}")
        # The root must contain both the templates and the photo.
        root = Path(os.path.commonpath([HERE, photo_path.parent]))
        inputs["photo"] = "/" + photo_path.relative_to(root).as_posix()
    if accent:
        inputs["accent"] = accent
    if paper:
        inputs["paper"] = paper
    return inputs, root


def render(
    template_id: str,
    data: dict | str,
    *,
    fmt: str = "pdf",
    photo: str | os.PathLike | None = None,
    accent: str | None = None,
    paper: str | None = None,
    ppi: float | None = None,
) -> bytes | list[bytes]:
    """Compile a template. PDF -> bytes; PNG/SVG -> bytes (1 page) or list[bytes]."""
    if template_id not in template_ids():
        raise ValueError(f"unknown template {template_id!r}; known: {template_ids()}")
    inputs, root = build_inputs(data, photo=photo, accent=accent, paper=paper)
    return typst.compile(
        str(HERE / template_id / "main.typ"),
        root=str(root),
        font_paths=[str(FONTS_DIR)],
        ignore_system_fonts=True,
        format=fmt,
        ppi=ppi,
        sys_inputs=inputs,
    )


THUMBNAIL_SAMPLES = {"resume": "resume-full", "cover_letter": "cover-letter"}
THUMBNAIL_WIDTH = 600


def make_thumbnails(ids: list[str] | None = None) -> None:
    """Write <id>/thumbnail.png (page 1, ~600px wide) for each template."""
    for tid in ids or template_ids():
        meta = load_meta(tid)
        sample = "resume-eu" if meta.get("photo") else THUMBNAIL_SAMPLES[meta["kind"]]
        data = (HERE / "samples" / f"{sample}.json").read_text()
        photo = HERE / "samples" / "photo.png" if meta.get("photo") else None
        ppi = THUMBNAIL_WIDTH / (210 / 25.4)
        pages = render(tid, data, fmt="png", photo=photo, ppi=ppi)
        first = pages[0] if isinstance(pages, list) else pages
        (HERE / tid / "thumbnail.png").write_bytes(first)
        print(f"{tid}/thumbnail.png", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ["thumbnails"]:
        make_thumbnails(argv[1:] or None)
        return 0
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("template", help=f"one of: {', '.join(template_ids())}")
    ap.add_argument("data", help="path to JSON data file ('-' for stdin)")
    ap.add_argument("out", help="output path (.pdf, .png or .svg)")
    ap.add_argument("--photo")
    ap.add_argument("--accent")
    ap.add_argument("--paper", choices=["a4", "letter"])
    ap.add_argument("--ppi", type=float, default=None, help="PNG resolution (default 144)")
    ap.add_argument("--width", type=int, default=None, help="PNG target width in px (overrides --ppi)")
    ap.add_argument("--all-pages", action="store_true", help="PNG/SVG: write every page as OUT-<n>.ext")
    args = ap.parse_args(argv)

    raw = sys.stdin.read() if args.data == "-" else Path(args.data).read_text()
    out = Path(args.out)
    fmt = out.suffix.lstrip(".").lower()
    if fmt not in ("pdf", "png", "svg"):
        ap.error("output must end in .pdf, .png or .svg")
    ppi = args.ppi
    if fmt == "png" and args.width:
        page_in = 8.5 if args.paper == "letter" else 210 / 25.4
        ppi = args.width / page_in
    if fmt == "png" and ppi is None:
        ppi = 144

    try:
        result = render(args.template, raw, fmt=fmt, photo=args.photo, accent=args.accent, paper=args.paper, ppi=ppi)
    except typst.TypstError as e:
        print(getattr(e, "diagnostic", None) or e, file=sys.stderr)
        return 1
    pages = result if isinstance(result, list) else [result]
    if fmt == "pdf" or not args.all_pages:
        out.write_bytes(pages[0])
    else:
        for i, page in enumerate(pages, 1):
            out.with_name(f"{out.stem}-{i}{out.suffix}").write_bytes(page)
    print(f"{args.template}: {len(pages) if fmt != 'pdf' else 'pdf'} -> {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
