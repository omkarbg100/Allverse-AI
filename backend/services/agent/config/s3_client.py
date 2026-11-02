"""
boto3 S3 client — matches s3.js config.
Supports both real AWS S3 and local S3-compatible stores (MinIO).
"""

import boto3
from .settings import settings

_s3_client = None
_public_s3_client = None


def _drop_expect_header(request, **kwargs):
    # S3Mock closes the connection when botocore sends "Expect: 100-continue".
    request.headers.pop("Expect", None)


def _build_client(endpoint_url: str | None):
    kwargs = dict(
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_KEY,
    )
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    client = boto3.client("s3", **kwargs)
    client.meta.events.register("before-send.s3.PutObject", _drop_expect_header)
    return client


def get_s3():
    """Client for internal uploads/downloads (container-network endpoint)."""
    global _s3_client
    if _s3_client is None:
        _s3_client = _build_client(settings.MINIO_ENDPOINT or None)
    return _s3_client


def get_public_s3():
    """Client used only for signing browser-facing presigned URLs."""
    global _public_s3_client
    if not settings.S3_PUBLIC_ENDPOINT:
        return get_s3()
    if _public_s3_client is None:
        _public_s3_client = _build_client(settings.S3_PUBLIC_ENDPOINT)
    return _public_s3_client

