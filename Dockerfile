# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# Client build metadata embeds a source commit hash, but the build context
# excludes .git. Override the placeholder with the real repository commit:
#   docker build --build-arg NULU_CLIENT_COMMIT_HASH=$(git rev-parse HEAD) .
ARG NULU_CLIENT_COMMIT_HASH=0000000
ENV NULU_CLIENT_COMMIT_HASH=${NULU_CLIENT_COMMIT_HASH}
RUN pnpm run build

FROM node:24-bookworm-slim AS runtime

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NODE_ENV=production \
    NULU_HOME=/data/nulu
RUN corepack enable

WORKDIR /app
COPY --from=build /app /app

VOLUME ["/data/nulu"]
EXPOSE 3080

# The shipped web profile binds loopback only, so give the container host
# networking on Linux: docker run --network host <image>. The UI is then at
# http://127.0.0.1:3080. Without host networking the port is not reachable.
ENTRYPOINT ["pnpm", "nulu"]
CMD ["web", "--no-open"]
