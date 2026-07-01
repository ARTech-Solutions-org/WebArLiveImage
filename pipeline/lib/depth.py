from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


DEPTH_MODELS = {
    "small": "depth-anything/Depth-Anything-V2-Small-hf",
    "base": "depth-anything/Depth-Anything-V2-Base-hf",
    "large": "depth-anything/Depth-Anything-V2-Large-hf",
}


def estimate_depth(image: Image.Image, model_key: str = "small") -> Image.Image:
    """Run Depth Anything V2; returns grayscale depth aligned to source resolution."""
    from transformers import pipeline

    model_id = DEPTH_MODELS.get(model_key, DEPTH_MODELS["small"])
    pipe = pipeline(task="depth-estimation", model=model_id)

    depth = pipe(image.convert("RGB"))["depth"]
    if depth.size != image.size:
        depth = depth.resize(image.size, Image.Resampling.BICUBIC)

    depth_np = np.asarray(depth, dtype=np.float32)
    depth_min = float(depth_np.min())
    depth_max = float(depth_np.max())
    if depth_max > depth_min:
        depth_np = (depth_np - depth_min) / (depth_max - depth_min)
    else:
        depth_np = np.zeros_like(depth_np)

    grayscale = (depth_np * 255.0).round().astype(np.uint8)
    return Image.fromarray(grayscale, mode="L")


def save_depth(depth: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    depth.save(path, format="PNG")
