from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass
class MindCompileResult:
    ok: bool
    feature_count: int
    grid_occupancy: int
    distribution_score: float
    error: str | None = None


def compile_mind_target(image_path: Path, output_path: Path, repo_root: Path) -> MindCompileResult:
    script = repo_root / "pipeline" / "compile_mind.mjs"
    command = ["node", str(script), str(image_path), str(output_path)]

    try:
        completed = subprocess.run(
            command,
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return MindCompileResult(
            ok=False,
            feature_count=0,
            grid_occupancy=0,
            distribution_score=0.0,
            error="Node.js not found. Install Node.js to compile target.mind files.",
        )

    stdout = (completed.stdout or "").strip()
    stderr = (completed.stderr or "").strip()

    if completed.returncode != 0:
        message = stderr or stdout or "MindAR compile failed."
        return MindCompileResult(
            ok=False,
            feature_count=0,
            grid_occupancy=0,
            distribution_score=0.0,
            error=message,
        )

    try:
        payload = json.loads(stdout.splitlines()[-1])
    except (json.JSONDecodeError, IndexError):
        return MindCompileResult(
            ok=False,
            feature_count=0,
            grid_occupancy=0,
            distribution_score=0.0,
            error=f"Unexpected compiler output: {stdout or stderr}",
        )

    return MindCompileResult(
        ok=bool(payload.get("ok")),
        feature_count=int(payload.get("featureCount", 0)),
        grid_occupancy=int(payload.get("gridOccupancy", 0)),
        distribution_score=float(payload.get("distributionScore", 0.0)),
        error=None if payload.get("ok") else str(payload.get("error", "compile failed")),
    )
