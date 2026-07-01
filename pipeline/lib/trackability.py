from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class TrackabilityReport:
    feature_count: int
    grid_occupancy: int
    distribution_score: float
    acceptable: bool
    reason: str | None = None


def score_trackability(gray: np.ndarray, min_features: int = 80, min_grid_cells: int = 10) -> TrackabilityReport:
    """
    Fast OpenCV pre-check before MindAR compile.
    Uses goodFeaturesToTrack as a proxy for trackability.
    """
    height, width = gray.shape[:2]
    corners = cv2.goodFeaturesToTrack(
        gray,
        maxCorners=2000,
        qualityLevel=0.01,
        minDistance=max(4, min(width, height) // 100),
    )

    feature_count = 0 if corners is None else len(corners)
    grid = np.zeros((4, 4), dtype=np.int32)

    if corners is not None:
        for corner in corners:
            x, y = corner.ravel()
            gx = min(3, max(0, int((x / width) * 4)))
            gy = min(3, max(0, int((y / height) * 4)))
            grid[gy, gx] += 1

    occupied = int(np.count_nonzero(grid))
    distribution_score = occupied / 16.0

    acceptable = feature_count >= min_features and occupied >= min_grid_cells
    reason = None
    if feature_count < min_features:
        reason = f"Too few feature points ({feature_count} < {min_features})."
    elif occupied < min_grid_cells:
        reason = f"Poor feature distribution ({occupied}/16 grid cells occupied)."

    return TrackabilityReport(
        feature_count=feature_count,
        grid_occupancy=occupied,
        distribution_score=distribution_score,
        acceptable=acceptable,
        reason=reason,
    )
