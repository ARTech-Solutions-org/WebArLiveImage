#!/usr/bin/env python3
"""
Ingest a source image into a complete WebAR target bundle.

Usage:
  python ingest.py --image path.jpg --id target_001
  python ingest.py --image path.jpg --id target_001 --output ../assets/targets
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from lib.bundle import default_meta, save_source_jpeg, write_meta
from lib.depth import estimate_depth, save_depth
from lib.masks import feather_mask, to_uint8_mask
from lib.mindar_compile import compile_mind_target
from lib.segmentation import segment_foreground
from lib.trackability import score_trackability

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "assets" / "targets"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a WebAR target asset bundle.")
    parser.add_argument("--image", required=True, help="Path to source image")
    parser.add_argument("--id", required=True, dest="target_id", help="Target identifier")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_ROOT), help="Output root directory")
    parser.add_argument("--depth-model", choices=["small", "base", "large"], default="small")
    parser.add_argument(
        "--segmentation",
        choices=["auto", "selfie", "rembg"],
        default="auto",
        help="Foreground segmentation strategy",
    )
    parser.add_argument("--min-features", type=int, default=80, help="Minimum feature points")
    parser.add_argument("--min-grid-cells", type=int, default=10, help="Minimum occupied 4x4 grid cells")
    parser.add_argument(
        "--reject-low-features",
        action="store_true",
        help="Exit non-zero if trackability pre-check fails",
    )
    parser.add_argument("--fg-strength", type=float, default=0.45, help="Foreground displacement strength")
    parser.add_argument("--bg-strength", type=float, default=0.15, help="Background displacement strength")
    parser.add_argument("--feather-px", type=float, default=6.0, help="Mask edge feather radius in pixels")
    parser.add_argument(
        "--skip-mind-compile",
        action="store_true",
        help="Skip target.mind compilation (for ML-only testing)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    image_path = Path(args.image).resolve()
    if not image_path.exists():
        print(f"Error: image not found: {image_path}", file=sys.stderr)
        return 1

    bundle_dir = Path(args.output).resolve() / args.target_id
    bundle_dir.mkdir(parents=True, exist_ok=True)

    print(f"[1/6] Loading {image_path}")
    image = Image.open(image_path)
    width, height = image.size

    gray = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2GRAY)
    precheck = score_trackability(gray, args.min_features, args.min_grid_cells)
    print(
        f"[2/6] Trackability pre-check: {precheck.feature_count} features, "
        f"{precheck.grid_occupancy}/16 cells ({precheck.distribution_score:.2f})"
    )
    if not precheck.acceptable:
        print(f"Warning: {precheck.reason}", file=sys.stderr)
        if args.reject_low_features:
            return 2

    print(f"[3/6] Depth estimation ({args.depth_model})")
    depth = estimate_depth(image, model_key=args.depth_model)
    save_depth(depth, bundle_dir / "depth.png")

    print(f"[4/6] Segmentation ({args.segmentation})")
    fg_mask = segment_foreground(image, mode=args.segmentation)
    fg_mask = feather_mask(fg_mask, radius_px=args.feather_px)
    bg_mask = feather_mask(1.0 - fg_mask, radius_px=args.feather_px)

    Image.fromarray(to_uint8_mask(fg_mask), mode="L").save(bundle_dir / "mask_fg.png")
    Image.fromarray(to_uint8_mask(bg_mask), mode="L").save(bundle_dir / "mask_bg.png")

    source_out = bundle_dir / "source.jpg"
    save_source_jpeg(image, source_out)

    mind_stats = {
        "precheckFeatureCount": precheck.feature_count,
        "precheckGridOccupancy": precheck.grid_occupancy,
        "precheckDistributionScore": round(precheck.distribution_score, 3),
        "compiledFeatureCount": None,
        "compiledGridOccupancy": None,
        "compiledDistributionScore": None,
        "trackable": precheck.acceptable,
    }

    if args.skip_mind_compile:
        print("[5/6] Skipping MindAR compile (--skip-mind-compile)")
    else:
        print("[5/6] Compiling MindAR target.mind")
        compile_result = compile_mind_target(source_out, bundle_dir / "target.mind", REPO_ROOT)
        if not compile_result.ok:
            print(f"Error: MindAR compile failed: {compile_result.error}", file=sys.stderr)
            print(
                "Tip: On Windows, install canvas build deps or run compile on WSL/Linux. "
                "Use --skip-mind-compile to generate other assets only.",
                file=sys.stderr,
            )
            return 3

        mind_stats["compiledFeatureCount"] = compile_result.feature_count
        mind_stats["compiledGridOccupancy"] = compile_result.grid_occupancy
        mind_stats["compiledDistributionScore"] = round(compile_result.distribution_score, 3)
        mind_stats["trackable"] = compile_result.feature_count >= args.min_features

    meta = default_meta(
        target_id=args.target_id,
        width=width,
        height=height,
        tracking=mind_stats,
        segmentation_mode=args.segmentation,
        depth_model=args.depth_model,
        fg_strength=args.fg_strength,
        bg_strength=args.bg_strength,
    )
    write_meta(bundle_dir / "meta.json", meta)

    print(f"[6/6] Bundle written to {bundle_dir}")
    print("Files:")
    for path in sorted(bundle_dir.iterdir()):
        print(f"  - {path.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
