from __future__ import annotations

from urllib.parse import quote, urlencode


def build_ar_url(app_base_url: str, target_id: str, path: str = "/") -> str:
    base = app_base_url.rstrip("/")
    path = path if path.startswith("/") else f"/{path}"
    query = urlencode({"target": target_id})
    return f"{base}{path}?{query}"


def build_kiosk_url(app_base_url: str, target_id: str) -> str:
    base = app_base_url.rstrip("/")
    query = urlencode({"target": target_id})
    return f"{base}/kiosk?{query}"


def build_cdn_prefix(cdn_base_url: str, target_id: str) -> str:
    return f"{cdn_base_url.rstrip('/')}/{quote(target_id, safe='')}"
