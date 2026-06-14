# Deployment

## First-Time Setup (on the server)

```bash
# Clone the repo
cd ~/deployments
git clone git@github-work:mikelenow/team-planner.git
cd team-planner

# Create production env
cp .env.production .env
# Edit .env with real passwords:
#   POSTGRES_PASSWORD — strong random password
#   JWT_SECRET — 64+ character random string
nano .env

# Run first deploy
bash deployment/deploy.sh
```

## GitHub Actions Secrets

Set these in the repo settings → Secrets and Variables → Actions:

| Secret | Value |
|--------|-------|
| `SSH_PRIVATE_KEY` | Private key authorized on the server |
| `SSH_HOST` | `ssh.mrnow.at` |
| `SSH_USER` | `antfarm` |
| `DEPLOY_DIR` | `/home/antfarm/deployments/team-planner` |

## Cloudflare Tunnel

Add a public hostname in the Cloudflare Zero Trust dashboard:

- **Subdomain**: `teamplanner`
- **Domain**: `mrnow.at`
- **Service**: `http://localhost:8087`

## How It Works

1. Push to `main` → GitHub Actions triggers
2. Action SSHs into server via Cloudflare tunnel
3. Server runs `deployment/deploy.sh`:
   - Pulls latest code
   - Builds production Docker images
   - Runs DB migrations (non-destructive)
   - Starts/restarts containers
   - Health check → rollback on failure

## Manual Deploy

```bash
ssh antfarm-remote
cd ~/deployments/team-planner
bash deployment/deploy.sh
```

## Rollback

```bash
ssh antfarm-remote
cd ~/deployments/team-planner
git log --oneline -5              # find the SHA to rollback to
git reset --hard <SHA>
docker compose -f docker-compose.prod.yml up -d --build
```
