#!/usr/bin/env python3
"""
Local booth API: accept a captured JPEG, run ingest + optional CDN upload.

The kiosk web page (deployed or local) POSTs to this service on the booth PC.
ML processing stays local — not suitable for Vercel serverless.

Usage:
  python kiosk/server.py
  python kiosk/server.py --config kiosk/config.json --port 8787
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename

REPO_ROOT = Path(__file__).resolve().parents[1]
KIOSK_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG = KIOSK_DIR / "config.json"
RUN_JOB = KIOSK_DIR / "run_job.py"

JobStatus = Literal["queued", "processing", "complete", "failed"]


@dataclass
class JobRecord:
    job_id: str
    target_id: str
    status: JobStatus = "queued"
    error: str | None = None
    image_path: Path | None = None


@dataclass
class JobStore:
    jobs: dict[str, JobRecord] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock)

    def add(self, record: JobRecord) -> None:
        with self.lock:
            self.jobs[record.job_id] = record

    def get(self, job_id: str) -> JobRecord | None:
        with self.lock:
            return self.jobs.get(job_id)

    def update(self, job_id: str, **fields: object) -> None:
        with self.lock:
            record = self.jobs.get(job_id)
            if not record:
                return
            for key, value in fields.items():
                setattr(record, key, value)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Kiosk booth API server")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Kiosk config JSON")
    parser.add_argument("--host", help="Bind host (overrides config api.host)")
    parser.add_argument("--port", type=int, help="Bind port (overrides config api.port)")
    return parser.parse_args()


def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        example = config_path.with_name("config.example.json")
        print(f"Warning: config not found at {config_path}", file=sys.stderr)
        if example.exists():
            print(f"Copy {example} to {config_path}", file=sys.stderr)
        return {}
    return json.loads(config_path.read_text(encoding="utf-8"))


def make_target_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"guest_{stamp}"


def resolve_path(config_path: Path, value: str | Path, default: Path) -> Path:
    path = Path(value) if value else default
    if not path.is_absolute():
        path = (config_path.parent / path).resolve()
    return path


def build_urls(config: dict, target_id: str) -> tuple[str, str]:
    app_url = str(config.get("app_url", "http://localhost:5173")).rstrip("/")
    ar_url = f"{app_url}/?target={target_id}"
    kiosk_url = f"{app_url}/kiosk?target={target_id}"
    return ar_url, kiosk_url


def run_job_worker(
    job_id: str,
    image_path: Path,
    target_id: str,
    config_path: Path,
    config: dict,
    store: JobStore,
) -> None:
    store.update(job_id, status="processing")

    cmd = [
        sys.executable,
        str(RUN_JOB),
        "--image",
        str(image_path),
        "--id",
        target_id,
        "--config",
        str(config_path),
        "--no-open",
    ]
    if not config.get("cdn"):
        cmd.append("--skip-upload")

    try:
        completed = subprocess.run(cmd, cwd=str(REPO_ROOT), capture_output=True, text=True)
    except Exception as exc:  # noqa: BLE001
        store.update(job_id, status="failed", error=str(exc))
        return

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "ingest failed").strip()
        store.update(job_id, status="failed", error=detail[-2000:])
        return

    store.update(job_id, status="complete")


def create_app(config_path: Path, config: dict, store: JobStore) -> Flask:
    app = Flask(__name__)

    api_cfg = config.get("api", {})
    origins = api_cfg.get("allowed_origins") or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        str(config.get("app_url", "")).rstrip("/"),
    ]
    origins = [origin for origin in origins if origin]
    CORS(app, resources={r"/api/*": {"origins": origins}})

    captures_root = resolve_path(config_path, config.get("captures_root", "./captures"), KIOSK_DIR / "captures")
    captures_root.mkdir(parents=True, exist_ok=True)

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "service": "kiosk-booth-api"})

    @app.post("/api/jobs")
    def create_job():
        upload = request.files.get("photo")
        if upload is None or not upload.filename:
            return jsonify({"error": "Missing photo file (multipart field: photo)"}), 400

        target_id = request.form.get("target_id") or make_target_id()
        job_id = uuid.uuid4().hex
        safe_name = secure_filename(upload.filename) or "capture.jpg"
        image_path = captures_root / f"{job_id}_{safe_name}"
        upload.save(image_path)

        record = JobRecord(job_id=job_id, target_id=target_id, image_path=image_path)
        store.add(record)

        thread = threading.Thread(
            target=run_job_worker,
            args=(job_id, image_path, target_id, config_path, config, store),
            daemon=True,
        )
        thread.start()

        ar_url, kiosk_url = build_urls(config, target_id)
        return jsonify(
            {
                "jobId": job_id,
                "targetId": target_id,
                "status": "queued",
                "arUrl": ar_url,
                "kioskUrl": kiosk_url,
            }
        ), 202

    @app.get("/api/jobs/<job_id>")
    def get_job(job_id: str):
        record = store.get(job_id)
        if record is None:
            return jsonify({"error": "Job not found"}), 404

        ar_url, kiosk_url = build_urls(config, record.target_id)
        payload = {
            "jobId": record.job_id,
            "targetId": record.target_id,
            "status": record.status,
            "arUrl": ar_url,
            "kioskUrl": kiosk_url,
            "error": record.error,
        }
        return jsonify(payload)

    return app


def main() -> int:
    args = parse_args()
    config_path = Path(args.config).resolve()
    config = load_config(config_path)
    store = JobStore()

    api_cfg = config.get("api", {})
    host = args.host or api_cfg.get("host", "127.0.0.1")
    port = args.port or int(api_cfg.get("port", 8787))

    app = create_app(config_path, config, store)
    print(f"Kiosk API listening on http://{host}:{port}")
    print(f"Config: {config_path}")
    app.run(host=host, port=port, threaded=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
