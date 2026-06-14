#!/bin/bash
# Team Planner - Deployment Script
# Runs on the target server to pull latest code and rebuild containers.
# Called by GitHub Actions via SSH, or manually.
#
# Features:
#   - Pulls latest code from main
#   - Rebuilds Docker containers
#   - Runs database migrations (non-destructive)
#   - Health check with automatic rollback on failure
#
# Environment variables (all optional, with sensible defaults):
#   DEPLOY_DIR       — where the repo lives on this server
#   COMPOSE_FILE     — compose file to use (default: docker-compose.prod.yml)
#   SKIP_MIGRATIONS  — set to "true" to skip DB migrations

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$HOME/deployments/team-planner}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE=".env"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-false}"

DC="docker compose --env-file $ENV_FILE -f $COMPOSE_FILE"

echo "=== Team Planner Deployment ==="
echo "Timestamp: $(date)"
echo "Deploy dir: $DEPLOY_DIR"

# ── Navigate to deploy directory ──
cd "$DEPLOY_DIR" || {
  echo "ERROR: Deploy directory $DEPLOY_DIR does not exist."
  echo "Run first-time setup: git clone <repo-url> $DEPLOY_DIR"
  exit 1
}

# ── Record current state for rollback ──
PREVIOUS_SHA=$(git rev-parse HEAD 2>/dev/null || echo "none")
echo "Previous deploy: $PREVIOUS_SHA"

# ── Pull latest code ──
echo "Pulling latest code..."
git fetch origin
git reset --hard origin/main
git clean -fd -e "$ENV_FILE"

CURRENT_SHA=$(git rev-parse --short HEAD)
echo "Deploying: $CURRENT_SHA ($(git log -1 --format='%s'))"

# ── Check prerequisites ──
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found in $DEPLOY_DIR"
  echo "Copy .env.production to $ENV_FILE and fill in production values."
  exit 1
fi

# ── Build and start ──
echo "Building containers..."
$DC build

echo "Ensuring database is running..."
$DC up -d db
sleep 5

# ── Run database migrations ──
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "Running database migrations..."
  $DC run --rm backend npx prisma db push --accept-data-loss=false
  echo "Migrations applied."
else
  echo "Skipping migrations (SKIP_MIGRATIONS=true)"
fi

# ── Deploy all services ──
echo "Starting services..."
$DC up -d

# ── Health check ──
HOST_PORT=$(grep -E '^HOST_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "8087")
HOST_PORT="${HOST_PORT:-8087}"

MAX_RETRIES=30
RETRY_COUNT=0

echo "Waiting for health check on port $HOST_PORT..."
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -sf "http://localhost:${HOST_PORT}/api/health" > /dev/null 2>&1; then
    echo "Health check passed!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "  Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: Health check failed after $MAX_RETRIES attempts!"
  echo ""
  echo "Container logs:"
  $DC logs --tail 30
  echo ""

  # ── Automatic rollback ──
  if [ "$PREVIOUS_SHA" != "none" ]; then
    echo "=== INITIATING ROLLBACK to $PREVIOUS_SHA ==="
    git reset --hard "$PREVIOUS_SHA"
    $DC build
    $DC up -d
    sleep 10
    if curl -sf "http://localhost:${HOST_PORT}/api/health" > /dev/null 2>&1; then
      echo "ROLLBACK SUCCESSFUL — running $PREVIOUS_SHA"
    else
      echo "ROLLBACK ALSO FAILED — manual intervention required!"
    fi
  fi
  exit 1
fi

# ── Record successful deploy ──
echo "$CURRENT_SHA" > .last-successful-deploy
echo "$(date) $CURRENT_SHA" >> .deploy-history

# ── Clean up ──
docker image prune -f > /dev/null 2>&1 || true

# ── Status ──
echo ""
echo "=== Container Status ==="
$DC ps
echo ""
echo "=== Deployment Complete ==="
echo "SHA: $CURRENT_SHA"
echo "URL: https://teamplanner.mrnow.at"
echo "Timestamp: $(date)"
