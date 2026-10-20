# OrbitHire worker image
#
# Needs the Typst templates as an extra build context named "templates":
#   docker build --build-context templates=../templates/typst -t orbithire-worker worker/
# (docker-compose.yml sets this up via additional_contexts.)
FROM python:3.12-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:0.11.13 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Dependencies first (cached layer)
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

# Project
COPY README.md ./
COPY orbithire_worker ./orbithire_worker
RUN uv sync --frozen --no-dev

# Typst templates + bundled fonts (no network or system fonts at compile time)
COPY --from=templates . /app/templates/typst
ENV TYPST_TEMPLATES_DIR=/app/templates/typst

RUN useradd --system --uid 10001 worker
USER worker

# Internal HTTP (/health, /preview). Bind 0.0.0.0 *inside* the container;
# docker-compose publishes it on the host's loopback only.
ENV WORKER_HTTP_HOST=0.0.0.0 \
    WORKER_HTTP_PORT=8787
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8787/health', timeout=4).status == 200 else 1)"

# exec form: python is PID 1 and receives SIGTERM directly
CMD ["worker"]
