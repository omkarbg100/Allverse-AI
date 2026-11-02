"""
Upload file buffer to S3 — mirrors uploadToS3.js.
"""

import asyncio
import logging

from botocore.exceptions import ClientError

from config.s3_client import get_s3
from config.settings import settings

logger = logging.getLogger(__name__)

_bucket_ready = False


def _ensure_bucket(s3) -> None:
    """Create the configured bucket when a local S3-compatible store lacks it."""
    global _bucket_ready
    if _bucket_ready:
        return

    bucket = settings.AWS_BUCKET_NAME
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if code not in {"404", "NoSuchBucket", "NoSuchBucketException"} and status != 404:
            raise
        s3.create_bucket(Bucket=bucket)
        logger.info("Created S3 bucket %s", bucket)

    _bucket_ready = True


async def upload_to_s3(filename: str, buffer: bytes, content_type: str) -> str:
    """Upload bytes to S3 bucket and return the filename (key)."""
    s3 = get_s3()
    _ensure_bucket(s3)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: s3.put_object(
            Bucket=settings.AWS_BUCKET_NAME,
            Key=filename,
            Body=buffer,
            ContentType=content_type,
        ),
    )
    return filename

