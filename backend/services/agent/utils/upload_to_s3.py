"""
Upload file buffer to S3 — mirrors uploadToS3.js.
"""

import asyncio
from config.s3_client import get_s3
from config.settings import settings


async def upload_to_s3(filename: str, buffer: bytes, content_type: str) -> str:
    """Upload bytes to S3 bucket and return the filename (key)."""
    s3 = get_s3()
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

