ARG LITELLM_BASE_IMAGE=ghcr.io/berriai/litellm:main-latest
FROM ${LITELLM_BASE_IMAGE}

COPY config.template.yaml /app/config.template.yaml
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
