"""Rendering settings (kept separate from the shared worker Settings).

| Env | Default |
|---|---|
| `TYPST_TEMPLATES_DIR` | repo `templates/typst` (Docker: `/app/templates/typst`) |
| `RENDER_MAX_PDF_BYTES` | 2 000 000 |
| `RENDER_MAX_PAGES` | 6 |
| `RENDER_PHOTO_MAX_BYTES` | 5 000 000 |
| `PREVIEW_CONCURRENCY` | 2 |
| `PREVIEW_WIDTH` | 900 (px, page-1 PNG) |
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_templates_dir() -> Path:
    here = Path(__file__).resolve()
    # worker/orbithire_worker/rendering/config.py -> repo root is parents[3];
    # in the Docker image the package lives at /app/orbithire_worker -> parents[2].
    for base in (here.parents[3], here.parents[2]):
        cand = base / "templates" / "typst"
        if (cand / "_lib").is_dir():
            return cand
    return here.parents[3] / "templates" / "typst"


class RenderSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False)

    typst_templates_dir: Path | None = None
    render_max_pdf_bytes: int = 2_000_000
    render_max_pages: int = 6
    render_photo_max_bytes: int = 5_000_000
    preview_concurrency: int = 2
    preview_width: int = 900

    @property
    def templates_dir(self) -> Path:
        return (self.typst_templates_dir or _default_templates_dir()).resolve()


@lru_cache
def get_render_settings() -> RenderSettings:
    return RenderSettings()
