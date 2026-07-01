#!/usr/bin/env python3
"""
Kiosk job: ingest a captured photo, optionally upload to CDN, then show preview on screen.

No printing — opens a browser preview with the photo, QR code, and AR link.

Usage:
  python run_job.py --image path/to/photo.jpg
  python run_job.py --image photo.jpg --id guest_20260701_001
  python run_job.py --image photo.jpg --skip-upload
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PIPELINE_DIR = REPO_ROOT / "pipeline"
DEFAULT_CONFIG = Path(__file__).resolve().parent / "config.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run full kiosk ingest + preview flow.")
    parser.add_argument("--image", required=True, help="Captured photo path")
    parser.add_argument("--id", dest="target_id", help="Target id (auto-generated if omitted)")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Kiosk config JSON")
    parser.add_argument("--skip-upload", action="store_true", help="Skip CDN upload")
    parser.add_argument("--skip-ingest", action="store_true", help="Skip ingest (bundle must already exist)")
    parser.add_argument("--no-open", action="store_true", help="Do not open browser preview")
    parser.add_argument("--skip-preview", action="store_true", help="Skip preview sheet (API jobs)")
    parser.add_argument("--segmentation", choices=["auto", "selfie", "rembg"], default="auto")
    return parser.parse_args()


def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        example = config_path.with_name("config.example.json")
        print(f"Warning: config not found at {config_path}", file=sys.stderr)
        if example.exists():
            print(f"Copy {example} to {config_path} for CDN upload.", file=sys.stderr)
        return {}
    return json.loads(config_path.read_text(encoding="utf-8"))


def make_target_id(explicit_id: str | None) -> str:
    if explicit_id:
        return explicit_id
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"guest_{stamp}"


def run_step(command: list[str], cwd: Path) -> int:
    print("$", " ".join(command))
    completed = subprocess.run(command, cwd=str(cwd))
    return completed.returncode


def main() -> int:
    args = parse_args()
    config_path = Path(args.config).resolve()
    config = load_config(config_path)

    image_path = Path(args.image).resolve()
    if not image_path.exists():
        print(f"Error: image not found: {image_path}", file=sys.stderr)
        return 1

    target_id = make_target_id(args.target_id)
    bundle_root = Path(config.get("bundle_root", REPO_ROOT / "assets" / "targets")).resolve()
    if not bundle_root.is_absolute():
        bundle_root = (config_path.parent / bundle_root).resolve()

    app_url = str(config.get("app_url", "http://localhost:5173")).rstrip("/")

    print(f"Target ID: {target_id}")
    print(f"Bundle root: {bundle_root}")

    if not args.skip_ingest:
        ingest_cmd = [
            sys.executable,
            str(PIPELINE_DIR / "ingest.py"),
            "--image",
            str(image_path),
            "--id",
            target_id,
            "--output",
            str(bundle_root),
            "--segmentation",
            args.segmentation,
        ]
        code = run_step(ingest_cmd, PIPELINE_DIR)
        if code != 0:
            return code

    bundle_dir = bundle_root / target_id

    if not args.skip_upload and config.get("cdn"):
        upload_cmd = [
            sys.executable,
            str(PIPELINE_DIR / "upload_bundle.py"),
            "--id",
            target_id,
            "--bundle",
            str(bundle_dir),
            "--config",
            str(config_path),
        ]
        code = run_step(upload_cmd, PIPELINE_DIR)
        if code != 0:
            print("Error: CDN upload failed. Phones will not find this guest target.", file=sys.stderr)
            return code

    if args.skip_preview:
        print("\nKiosk job complete (ingest + upload).")
        print(f"Booth screen: {app_url}/kiosk?target={target_id}")
        print(f"Guest AR link: {app_url}/?target={target_id}")
        print(f"Local bundle path: {bundle_dir}")
        return 0

    preview_cmd = [
        sys.executable,
        str(PIPELINE_DIR / "preview_sheet.py"),
        "--id",
        target_id,
        "--bundle",
        str(bundle_dir),
        "--app-url",
        app_url,
        "--config",
        str(config_path),
    ]
    if app_url.startswith("http://localhost") or app_url.startswith("https://"):
        preview_cmd.append("--open-kiosk-url")
    if args.no_open:
        preview_cmd.append("--no-open")

    code = run_step(preview_cmd, PIPELINE_DIR)
    if code != 0:
        return code

    print("\nKiosk job complete.")
    print(f"1. Booth screen: {app_url}/kiosk?target={target_id}")
    print(f"2. Guest AR link: {app_url}/?target={target_id}")
    print("3. Point the phone at the photo on the kiosk screen (or a print of source.jpg).")
    print(f"4. Local bundle path: {bundle_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
