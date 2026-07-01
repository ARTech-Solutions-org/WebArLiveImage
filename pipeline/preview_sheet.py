#!/usr/bin/env python3
"""
Build an on-screen kiosk preview (photo + QR + AR link) and open it in the browser.

Usage:
  python preview_sheet.py --id guest_001
  python preview_sheet.py --id guest_001 --app-url http://localhost:5173
"""

from __future__ import annotations

import argparse
import json
import sys
import webbrowser
from pathlib import Path

from lib.preview import open_preview_in_browser, render_preview_sheet, write_preview_html
from lib.qr_url import build_ar_url, build_kiosk_url

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BUNDLE_ROOT = REPO_ROOT / "assets" / "targets"
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "kiosk" / "output"
DEFAULT_CONFIG = REPO_ROOT / "kiosk" / "config.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Show kiosk preview on screen.")
    parser.add_argument("--id", required=True, dest="target_id", help="Target identifier")
    parser.add_argument("--bundle", help="Bundle directory (default: assets/targets/{id})")
    parser.add_argument("--app-url", help="Public web app base URL for QR/link")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Kiosk config JSON")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_ROOT), help="Preview output directory")
    parser.add_argument("--no-open", action="store_true", help="Do not open the browser automatically")
    parser.add_argument(
        "--open-kiosk-url",
        action="store_true",
        help="Open deployed /kiosk page instead of local preview.html",
    )
    return parser.parse_args()


def resolve_app_url(args: argparse.Namespace) -> str:
    if args.app_url:
        return args.app_url.rstrip("/")

    config_path = Path(args.config)
    if config_path.exists():
        config_data = json.loads(config_path.read_text(encoding="utf-8"))
        app_url = config_data.get("app_url")
        if app_url:
            return str(app_url).rstrip("/")

    return "http://localhost:5173"


def main() -> int:
    args = parse_args()
    bundle_dir = Path(args.bundle).resolve() if args.bundle else DEFAULT_BUNDLE_ROOT / args.target_id
    source_image = bundle_dir / "source.jpg"

    if not source_image.exists():
        print(f"Error: source.jpg not found in {bundle_dir}", file=sys.stderr)
        return 1

    app_url = resolve_app_url(args)
    ar_url = build_ar_url(app_url, args.target_id)
    kiosk_url = build_kiosk_url(app_url, args.target_id)

    output_dir = Path(args.output).resolve() / args.target_id
    preview_image = output_dir / "preview.jpg"
    preview_html = output_dir / "preview.html"

    render_preview_sheet(source_image=source_image, ar_url=ar_url, output_image=preview_image)
    write_preview_html(
        output_html=preview_html,
        preview_image=preview_image,
        ar_url=ar_url,
        target_id=args.target_id,
    )

    print(f"Preview image: {preview_image}")
    print(f"Preview page:  {preview_html}")
    print(f"AR URL:        {ar_url}")
    print(f"Kiosk URL:     {kiosk_url}")

    if not args.no_open:
        if args.open_kiosk_url:
            webbrowser.open(kiosk_url)
        else:
            open_preview_in_browser(preview_html)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
