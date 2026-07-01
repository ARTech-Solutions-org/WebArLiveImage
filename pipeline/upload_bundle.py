#!/usr/bin/env python3
"""
Upload a target bundle folder to S3-compatible storage (Cloudflare R2, AWS S3).

Usage:
  python upload_bundle.py --id guest_001 --bundle ../assets/targets/guest_001
  python upload_bundle.py --id guest_001 --config ../kiosk/config.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from lib.cdn import CdnConfig, upload_bundle

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BUNDLE_ROOT = REPO_ROOT / "assets" / "targets"
DEFAULT_CONFIG = REPO_ROOT / "kiosk" / "config.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload a WebAR bundle to CDN.")
    parser.add_argument("--id", required=True, dest="target_id", help="Target identifier")
    parser.add_argument("--bundle", help="Bundle directory (default: assets/targets/{id})")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Kiosk config JSON with CDN block")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    bundle_dir = Path(args.bundle).resolve() if args.bundle else DEFAULT_BUNDLE_ROOT / args.target_id
    config_path = Path(args.config).resolve()

    if not bundle_dir.is_dir():
        print(f"Error: bundle not found: {bundle_dir}", file=sys.stderr)
        return 1

    if not config_path.exists():
        print(f"Error: config not found: {config_path}", file=sys.stderr)
        print("Copy kiosk/config.example.json to kiosk/config.json and fill CDN credentials.", file=sys.stderr)
        return 1

    config_data = json.loads(config_path.read_text(encoding="utf-8"))
    cdn_block = config_data.get("cdn")
    if not cdn_block:
        print("Error: config.json is missing a 'cdn' section.", file=sys.stderr)
        return 1

    try:
        cdn_config = CdnConfig.from_dict(cdn_block)
        public_prefix = upload_bundle(bundle_dir, cdn_config, args.target_id)
    except Exception as error:
        print(f"Error: upload failed: {error}", file=sys.stderr)
        return 2

    print(f"Uploaded bundle for {args.target_id}")
    print(f"CDN base: {public_prefix}")
    print("Set Vercel env:")
    print(f"  VITE_BUNDLE_CDN_URL={cdn_config.public_base_url.rstrip('/')}/{cdn_config.prefix}".rstrip("/"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
