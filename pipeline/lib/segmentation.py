from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
SELFIE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/"
    "selfie_segmenter/float16/latest/selfie_segmenter.tflite"
)
SELFIE_MODEL_PATH = MODELS_DIR / "selfie_segmenter.tflite"


def segment_foreground(image: Image.Image, mode: str = "auto") -> np.ndarray:
    """
    Return foreground mask in [0, 1] float32, same HxW as source.
    Modes: auto | selfie | rembg
    """
    if mode == "rembg":
        return _segment_rembg(image)
    if mode == "selfie":
        return _segment_selfie(image)

    try:
        selfie = _segment_selfie(image)
        if float(selfie.mean()) > 0.08:
            return selfie
    except Exception:
        pass
    return _segment_rembg(image)


def _ensure_selfie_model() -> Path:
    if SELFIE_MODEL_PATH.exists():
        return SELFIE_MODEL_PATH

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    import urllib.request

    urllib.request.urlretrieve(SELFIE_MODEL_URL, SELFIE_MODEL_PATH)
    return SELFIE_MODEL_PATH


def _segment_selfie(image: Image.Image) -> np.ndarray:
    import mediapipe as mp

    model_path = _ensure_selfie_model()
    rgb = np.asarray(image.convert("RGB"))

    options = mp.tasks.vision.ImageSegmenterOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        output_category_mask=True,
    )

    with mp.tasks.vision.ImageSegmenter.create_from_options(options) as segmenter:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = segmenter.segment(mp_image)

    if not result.category_mask:
        return np.ones(rgb.shape[:2], dtype=np.float32)

    mask = result.category_mask.numpy_view().astype(np.float32)
    if mask.ndim == 3:
        mask = mask[:, :, 0]
    return np.clip(mask, 0.0, 1.0)


def _segment_rembg(image: Image.Image) -> np.ndarray:
    from rembg import remove

    rgba = remove(image.convert("RGB"))
    alpha = np.asarray(rgba)[:, :, 3].astype(np.float32) / 255.0
    return alpha
