# MinIO - S3-compatible object storage
# Base image from official MinIO
ARG MINIO_VERSION=RELEASE.2025-09-07T16-13-09Z
FROM minio/minio:${MINIO_VERSION}

COPY --chmod=755 entrypoint.sh /entrypoint.sh

ENTRYPOINT [ "/entrypoint.sh" ]
