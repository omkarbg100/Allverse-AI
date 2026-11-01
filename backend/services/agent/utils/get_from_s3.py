"""
Generate a presigned S3 URL — mirrors getFromS3.js.
"""

import asyncio
from config.s3_client import get_s3
from config.settings import settings


async def get_from_s3(filename: str, expires_in: int = 600) -> str:
    """Return a presigned URL for the given S3 key, valid for expires_in seconds."""
    s3 = get_s3()
    loop = asyncio.get_event_loop()
    url = await loop.run_in_executor(
        None,
        lambda: s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.AWS_BUCKET_NAME, "Key": filename},
            ExpiresIn=expires_in,
        ),
    )
    return url

