#!/bin/bash

# Deploy script for bill-lm
# Usage: ./scripts/deploy.sh [build|push|stop|start|restart|status]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="localhost:5000"
SERVER_IMAGE="$REGISTRY/bill-lm-server"
WORKER_IMAGE="$REGISTRY/bill-lm-worker"
SERVER_CONTAINER="bill-lm-server"
WORKER_CONTAINER="bill-lm-worker"
VERSION="${VERSION:-latest}"

# Load .env if exists
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

build() {
  log_info "Building images..."

  log_info "Building Server image: $SERVER_IMAGE:$VERSION"
  docker build -f docker/Dockerfile \
    --build-arg PORT=3001 \
    --build-arg ENVIRONMENT=prod \
    --build-arg DATABASE_URL="${DATABASE_URL}" \
    --build-arg MINIO_ENDPOINT="${MINIO_ENDPOINT}" \
    --build-arg MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY}" \
    --build-arg MINIO_SECRET_KEY="${MINIO_SECRET_KEY}" \
    --build-arg MINIO_BUCKET="${MINIO_BUCKET}" \
    --build-arg GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS}" \
    --build-arg FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}" \
    --build-arg FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET}" \
    --build-arg CLERK_SECRET_KEY="${CLERK_SECRET_KEY}" \
    --build-arg VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}" \
    --build-arg VITE_FIREBASE_API_KEY="${VITE_FIREBASE_API_KEY}" \
    --build-arg VITE_FIREBASE_AUTH_DOMAIN="${VITE_FIREBASE_AUTH_DOMAIN}" \
    --build-arg VITE_FIREBASE_PROJECT_ID="${VITE_FIREBASE_PROJECT_ID}" \
    --build-arg VITE_FIREBASE_STORAGE_BUCKET="${VITE_FIREBASE_STORAGE_BUCKET}" \
    --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="${VITE_FIREBASE_MESSAGING_SENDER_ID}" \
    --build-arg VITE_FIREBASE_APP_ID="${VITE_FIREBASE_APP_ID}" \
    --build-arg LLM_PROVIDER="${LLM_PROVIDER}" \
    --build-arg LLM_MODEL="${LLM_MODEL}" \
    --build-arg LLM_API_KEY="${LLM_API_KEY}" \
    --build-arg LLM_API_URL="${LLM_API_URL}" \
    --build-arg LLM_TEMPERATURE="${LLM_TEMPERATURE}" \
    -t "$SERVER_IMAGE:$VERSION" .

  log_success "Server image built"

  log_info "Building Worker image: $WORKER_IMAGE:$VERSION"
  docker build -f docker/Dockerfile.worker \
    --build-arg DATABASE_URL="${DATABASE_URL}" \
    --build-arg GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS}" \
    --build-arg FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}" \
    --build-arg LLM_PROVIDER="${LLM_PROVIDER}" \
    --build-arg LLM_MODEL="${LLM_MODEL}" \
    --build-arg LLM_API_KEY="${LLM_API_KEY}" \
    --build-arg LLM_API_URL="${LLM_API_URL}" \
    --build-arg LLM_TEMPERATURE="${LLM_TEMPERATURE}" \
    -t "$WORKER_IMAGE:$VERSION" .

  log_success "Worker image built"
}

push() {
  log_info "Pushing images to registry..."

  docker push "$SERVER_IMAGE:$VERSION"
  log_success "Server image pushed"

  docker push "$WORKER_IMAGE:$VERSION"
  log_success "Worker image pushed"
}

stop() {
  log_info "Stopping containers..."

  if docker ps -a --format '{{.Names}}' | grep -q "^${SERVER_CONTAINER}$"; then
    docker stop "$SERVER_CONTAINER" || true
    log_success "Server container stopped"
  else
    log_warning "Server container not found"
  fi

  if docker ps -a --format '{{.Names}}' | grep -q "^${WORKER_CONTAINER}$"; then
    docker stop "$WORKER_CONTAINER" || true
    log_success "Worker container stopped"
  else
    log_warning "Worker container not found"
  fi
}

start() {
  log_info "Starting containers..."

  docker run -d \
    --name "$SERVER_CONTAINER" \
    -p 3001:3001 \
    -e DATABASE_URL="${DATABASE_URL}" \
    -e PORT=3001 \
    -e ENVIRONMENT=prod \
    -e MINIO_ENDPOINT="${MINIO_ENDPOINT}" \
    -e MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY}" \
    -e MINIO_SECRET_KEY="${MINIO_SECRET_KEY}" \
    -e MINIO_BUCKET="${MINIO_BUCKET}" \
    -e GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS}" \
    -e FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}" \
    -e FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET}" \
    -e CLERK_SECRET_KEY="${CLERK_SECRET_KEY}" \
    -e VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}" \
    -e VITE_FIREBASE_API_KEY="${VITE_FIREBASE_API_KEY}" \
    -e VITE_FIREBASE_AUTH_DOMAIN="${VITE_FIREBASE_AUTH_DOMAIN}" \
    -e VITE_FIREBASE_PROJECT_ID="${VITE_FIREBASE_PROJECT_ID}" \
    -e VITE_FIREBASE_STORAGE_BUCKET="${VITE_FIREBASE_STORAGE_BUCKET}" \
    -e VITE_FIREBASE_MESSAGING_SENDER_ID="${VITE_FIREBASE_MESSAGING_SENDER_ID}" \
    -e VITE_FIREBASE_APP_ID="${VITE_FIREBASE_APP_ID}" \
    -e LLM_PROVIDER="${LLM_PROVIDER}" \
    -e LLM_MODEL="${LLM_MODEL}" \
    -e LLM_API_KEY="${LLM_API_KEY}" \
    -e LLM_API_URL="${LLM_API_URL}" \
    -e LLM_TEMPERATURE="${LLM_TEMPERATURE}" \
    -e NODE_ENV=production \
    --restart unless-stopped \
    "$SERVER_IMAGE:$VERSION"

  log_success "Server container started"

  docker run -d \
    --name "$WORKER_CONTAINER" \
    -e DATABASE_URL="${DATABASE_URL}" \
    -e GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS}" \
    -e FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}" \
    -e LLM_PROVIDER="${LLM_PROVIDER}" \
    -e LLM_MODEL="${LLM_MODEL}" \
    -e LLM_API_KEY="${LLM_API_KEY}" \
    -e LLM_API_URL="${LLM_API_URL}" \
    -e LLM_TEMPERATURE="${LLM_TEMPERATURE}" \
    -e NODE_ENV=production \
    --restart unless-stopped \
    "$WORKER_IMAGE:$VERSION"

  log_success "Worker container started"
}

restart() {
  stop
  sleep 2
  start
}

status() {
  log_info "Container status:"
  docker ps --filter "name=$SERVER_CONTAINER" --format "table {{.Names}}\t{{.Status}}"
  docker ps --filter "name=$WORKER_CONTAINER" --format "table {{.Names}}\t{{.Status}}"

  log_info "Logs (Server):"
  docker logs "$SERVER_CONTAINER" --tail 10 2>/dev/null || log_warning "Server logs not available"

  log_info "Logs (Worker):"
  docker logs "$WORKER_CONTAINER" --tail 10 2>/dev/null || log_warning "Worker logs not available"
}

help() {
  cat <<EOF
bill-lm Deploy Script

Usage: $0 [command] [options]

Commands:
  build                Build Docker images
  push                 Push images to registry
  stop                 Stop running containers
  start                Start containers
  restart              Restart containers
  status               Show container status and logs
  help                 Show this help message

Options:
  VERSION=x.y.z        Set image version (default: latest)

Examples:
  $0 build
  $0 build push stop start
  VERSION=1.0.0 $0 build push
  $0 restart
  $0 status

Environment variables are loaded from .env.local if it exists.

EOF
}

# Main
if [ $# -eq 0 ]; then
  help
  exit 0
fi

case "$1" in
  build)
    build
    ;;
  push)
    push
    ;;
  stop)
    stop
    ;;
  start)
    start
    ;;
  restart)
    restart
    ;;
  status)
    status
    ;;
  help)
    help
    ;;
  *)
    log_error "Unknown command: $1"
    help
    exit 1
    ;;
esac

# Run additional commands if provided
shift
while [ $# -gt 0 ]; do
  case "$1" in
    build)
      build
      ;;
    push)
      push
      ;;
    stop)
      stop
      ;;
    start)
      start
      ;;
    restart)
      restart
      ;;
    status)
      status
      ;;
    *)
      log_warning "Skipping unknown command: $1"
      ;;
  esac
  shift
done

log_success "Done!"
