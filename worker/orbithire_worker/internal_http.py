"""Tiny internal HTTP server (stdlib asyncio, no framework).

Binds to 127.0.0.1 by default – it is meant for the Next.js server on the same
host / compose network, never the public internet.

Routes:
  GET  /health   – db ok?, slots in use, counters (503 when db is down)
  POST /preview  – fast Typst preview; 501 until Phase 1 implements it

Register more routes with ``server.route("POST", "/path")(async_fn)``.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from http import HTTPStatus
from typing import TYPE_CHECKING, Any, Awaitable, Callable

if TYPE_CHECKING:
    from .worker import Worker

log = logging.getLogger("orbithire_worker.http")

MAX_BODY = 5 * 1024 * 1024


@dataclass
class Request:
    method: str
    path: str
    query: str
    headers: dict[str, str]
    body: bytes = b""

    def json(self) -> Any:
        return json.loads(self.body or b"null")


@dataclass
class Response:
    status: int = 200
    body: bytes = b""
    content_type: str = "application/json"
    headers: dict[str, str] = field(default_factory=dict)

    @classmethod
    def json(cls, data: Any, status: int = 200) -> "Response":
        return cls(status=status, body=json.dumps(data, default=str).encode())


Handler = Callable[[Request], Awaitable[Response]]


class HttpServer:
    def __init__(self, worker: "Worker", host: str, port: int) -> None:
        self.worker = worker
        self.host = host
        self.port = port
        self._routes: dict[tuple[str, str], Handler] = {}
        self._server: asyncio.base_events.Server | None = None
        self.route("GET", "/health")(self._health)
        self.route("POST", "/preview")(self._preview)

    def route(self, method: str, path: str) -> Callable[[Handler], Handler]:
        def deco(fn: Handler) -> Handler:
            self._routes[(method.upper(), path)] = fn
            return fn

        return deco

    async def start(self) -> None:
        self._server = await asyncio.start_server(self._handle, self.host, self.port)
        sock = self._server.sockets[0].getsockname() if self._server.sockets else (self.host, self.port)
        self.port = sock[1]
        log.info("internal HTTP on http://%s:%s", sock[0], sock[1])

    async def stop(self) -> None:
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
            self._server = None

    # ---------------------------------------------------------------- routes
    async def _health(self, req: Request) -> Response:
        data = await self.worker.health()
        return Response.json(data, status=200 if data["ok"] else 503)

    async def _preview(self, req: Request) -> Response:
        return Response.json({"error": "preview not implemented yet (Phase 1)"}, status=501)

    # -------------------------------------------------------------- protocol
    async def _handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            resp = await self._dispatch(reader)
        except asyncio.IncompleteReadError:
            writer.close()
            return
        except Exception:  # noqa: BLE001
            log.exception("http handler error")
            resp = Response.json({"error": "internal error"}, status=500)
        try:
            reason = HTTPStatus(resp.status).phrase
        except ValueError:
            reason = "Status"
        head = [
            f"HTTP/1.1 {resp.status} {reason}",
            f"Content-Type: {resp.content_type}",
            f"Content-Length: {len(resp.body)}",
            "Connection: close",
            *(f"{k}: {v}" for k, v in resp.headers.items()),
        ]
        writer.write(("\r\n".join(head) + "\r\n\r\n").encode("latin-1") + resp.body)
        try:
            await writer.drain()
        finally:
            writer.close()

    async def _dispatch(self, reader: asyncio.StreamReader) -> Response:
        request_line = (await asyncio.wait_for(reader.readline(), 10)).decode("latin-1").strip()
        if not request_line:
            return Response.json({"error": "bad request"}, status=400)
        try:
            method, target, _ = request_line.split(" ", 2)
        except ValueError:
            return Response.json({"error": "bad request"}, status=400)
        headers: dict[str, str] = {}
        while True:
            line = (await asyncio.wait_for(reader.readline(), 10)).decode("latin-1")
            if line in ("\r\n", "\n", ""):
                break
            k, _, v = line.partition(":")
            headers[k.strip().lower()] = v.strip()
        length = int(headers.get("content-length") or 0)
        if length > MAX_BODY:
            return Response.json({"error": "body too large"}, status=413)
        body = await asyncio.wait_for(reader.readexactly(length), 30) if length else b""
        path, _, query = target.partition("?")
        handler = self._routes.get((method.upper(), path))
        if handler is None:
            allowed = [m for (m, p) in self._routes if p == path]
            if allowed:
                return Response.json({"error": "method not allowed"}, status=405)
            return Response.json({"error": "not found"}, status=404)
        return await handler(Request(method.upper(), path, query, headers, body))
