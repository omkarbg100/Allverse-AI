"""
boto3 S3 client — matches s3.js config.
Supports both real AWS S3 and local S3-compatible stores (MinIO).
"""

import boto3
from .settings import settings

_s3_client = None


def get_s3():
    global _s3_client
    if _s3_client is None:
        kwargs = dict(
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_KEY,
        )
        _s3_client = boto3.client("s3", **kwargs)
    return _s3_client

