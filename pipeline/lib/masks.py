from __future__ import annotations

import numpy as np
from scipy.ndimage import gaussian_filter


def feather_mask(mask: np.ndarray, radius_px: float = 6.0) -> np.ndarray:
    """Feather binary mask edges to reduce parallax seams."""
    normalized = mask.astype(np.float32)
    if normalized.max() > 1.0:
        normalized /= 255.0

    sigma = max(radius_px / 2.0, 0.5)
    softened = gaussian_filter(normalized, sigma=sigma)
    return np.clip(softened, 0.0, 1.0)


def to_uint8_mask(mask: np.ndarray) -> np.ndarray:
    return (np.clip(mask, 0.0, 1.0) * 255.0).round().astype(np.uint8)
