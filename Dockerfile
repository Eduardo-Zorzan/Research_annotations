FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY frontend/ ./frontend/
RUN npm ci || npm install
RUN npx tsc

FROM rust:1-slim-bookworm AS rust-builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev build-essential ca-certificates && rm -rf /var/lib/apt/lists/*
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/
COPY public/ ./public/
COPY --from=frontend-builder /app/public/js/ ./public/js/
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=rust-builder /app/target/release/Project_tables /app/Project_tables
COPY --from=rust-builder /app/target/release/new_users /app/new_users
RUN mkdir -p /app/uploads /app/backups
EXPOSE 3000
CMD ["/app/Project_tables"]
