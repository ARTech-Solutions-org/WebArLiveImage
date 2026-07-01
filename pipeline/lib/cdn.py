from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from pathlib import Path


@dataclass
class CdnConfig:
    endpoint_url: str
    bucket: str
    access_key_id: str
    secret_access_key: str
    public_base_url: str
    prefix: str = ""

    @classmethod
    def from_dict(cls, data: dict) -> CdnConfig:
        required = ("endpoint_url", "bucket", "access_key_id", "secret_access_key", "public_base_url")
        missing = [key for key in required if not data.get(key)]
        if missing:
            raise ValueError(f"CDN config missing fields: {', '.join(missing)}")
        return cls(
            endpoint_url=str(data["endpoint_url"]),
            bucket=str(data["bucket"]),
            access_key_id=str(data["access_key_id"]),
            secret_access_key=str(data["secret_access_key"]),
            public_base_url=str(data["public_base_url"]).rstrip("/"),
            prefix=str(data.get("prefix", "")).strip("/"),
        )


def bundle_object_prefix(config: CdnConfig, target_id: str) -> str:
    parts = [part for part in (config.prefix, target_id) if part]
    return "/".join(parts)


def upload_bundle(bundle_dir: Path, config: CdnConfig, target_id: str) -> str:
    import boto3
    from botocore.config import Config

    if not bundle_dir.is_dir():
        raise FileNotFoundError(f"Bundle directory not found: {bundle_dir}")

    client = boto3.client(
        "s3",
        endpoint_url=config.endpoint_url,
        aws_access_key_id=config.access_key_id,
        aws_secret_access_key=config.secret_access_key,
        config=Config(signature_version="s3v4"),
    )

    object_prefix = bundle_object_prefix(config, target_id)
    uploaded = 0

    for file_path in sorted(bundle_dir.iterdir()):
        if not file_path.is_file():
            continue

        key = f"{object_prefix}/{file_path.name}" if object_prefix else file_path.name
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        extra_args = {"ContentType": content_type}
        if file_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".mind", ".json"}:
            extra_args["CacheControl"] = "public, max-age=3600"

        client.upload_file(str(file_path), config.bucket, key, ExtraArgs=extra_args)
        uploaded += 1

    if uploaded == 0:
        raise RuntimeError(f"No files uploaded from {bundle_dir}")

    public_prefix = f"{config.public_base_url}/{object_prefix}" if object_prefix else config.public_base_url
    return public_prefix.rstrip("/")
