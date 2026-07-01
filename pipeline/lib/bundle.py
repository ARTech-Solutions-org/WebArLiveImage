from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


@dataclass
class BundleMeta:
    target_id: str
    version: int
    source: str
    width: int
    height: int
    depth: str
    mind_file: str
    layers: dict
    tracking: dict
    animation: dict
    pipeline: dict

    def to_json(self) -> dict:
        return asdict(self)


def write_meta(path: Path, meta: BundleMeta) -> None:
    path.write_text(json.dumps(meta.to_json(), indent=2) + "\n", encoding="utf-8")


def save_source_jpeg(image: Image.Image, path: Path, quality: int = 92) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, format="JPEG", quality=quality, optimize=True)


def default_meta(
    *,
    target_id: str,
    width: int,
    height: int,
    tracking: dict,
    segmentation_mode: str,
    depth_model: str,
    fg_strength: float,
    bg_strength: float,
) -> BundleMeta:
    return BundleMeta(
        target_id=target_id,
        version=1,
        source="source.jpg",
        width=width,
        height=height,
        depth="depth.png",
        mind_file="target.mind",
        layers={
            "background": {
                "displacementStrength": bg_strength,
                "mask": "mask_bg.png",
                "zOffset": 0.0,
            },
            "foreground": {
                "displacementStrength": fg_strength,
                "mask": "mask_fg.png",
                "zOffset": 0.02,
            },
        },
        tracking=tracking,
        animation={"enabled": False, "rig": None},
        pipeline={
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "depthModel": depth_model,
            "segmentationMode": segmentation_mode,
        },
    )
