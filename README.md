# Lila Games Assignment - XoXo Multiplayer Tic-Tac-Toe

## Deliverables

- Source code repository: GitHub repository containing backend, frontend, and deployment configuration
- Deployed game URL: https://xoxo.sadiqueazmi.in
- Deployed Nakama HTTP API endpoint: https://nakama-api.sadiqueazmi.in
- Deployed Nakama Console URL: https://nakama-admin.sadiqueazmi.in

## Project overview

This project is a server-authoritative multiplayer Tic-Tac-Toe game built on Nakama.

- Backend: Go plugin loaded by Nakama (match lifecycle, validation, room logic, rematch logic, leaderboard updates)
- Frontend: React + TypeScript app that renders server state and sends player actions
- Database: PostgreSQL
- Deployment model: Docker Compose with images published to GitHub Container Registry (GHCR)

## Setup and installation

### Prerequisites

- Docker and Docker Compose plugin
- Git

### 1) Clone repository

```bash
git clone https://github.com/smazmi/lilagames-assignment.git
cd lilagames-assignment
```

### 2) Create environment file

```bash
cp .env.example .env
```

Set at least these values in `.env`:

- `NAKAMA_SERVER_KEY` (must match the key used in frontend image build)
- `NAKAMA_CONSOLE_PASSWORD`
- `NAKAMA_CORS_ALLOW_ORIGIN` (for production, set this to your frontend domain)
- `GHCR_NAMESPACE` (for this repo: `smazmi`)

### 3) Run local development stack (builds images locally)

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

Stop local stack:

```bash
docker compose -f docker-compose.dev.yml down
```

## Architecture and design decisions

### Server-authoritative game model

The backend is responsible for all game logic. The frontend never decides move validity or win conditions.

Why this was chosen:

- Prevents client-side cheating
- Keeps both players synchronized from one source of truth
- Makes reconnection and rematch behavior predictable

### Clear separation of concerns

- Backend plugin: match state machine, custom room RPCs, matchmaking integration, leaderboard writes
- Frontend context (`NakamaContext`): socket session lifecycle and opcode handling
- UI components: rendering only; no game rule logic

### Deployment strategy

- CI builds and pushes multi-arch images (`linux/amd64`, `linux/arm64`) to GHCR on merged PRs to `main`
- Production compose pulls prebuilt images
- Watchtower is used to monitor and roll to updated tags

## Deployment process documentation

### Image build and publish

Workflow file: `.github/workflows/build-and-push-images.yml`

Trigger:

- Pull request merged into `main`
- Push a git tag like `v1.2.0`
- Manual workflow dispatch

Images published:

- `ghcr.io/smazmi/lila-xoxo-backend:latest`
- `ghcr.io/smazmi/lila-xoxo-frontend:latest`
- `sha-<short-commit>` tags for traceability
- Semver tags from git tags (for example `v1.2.0`, `1.2`)

### Production deployment (manual)

1. On server, place `docker-compose.yml` and a valid `.env`
2. (Optional for public images) Authenticate to GHCR

```bash
docker login ghcr.io -u smazmi
```

If your registry access is public and unauthenticated pulls work in your environment, you can skip login.

3. Pull and start

```bash
docker compose pull
docker compose up -d
```

4. Check health

```bash
docker compose ps
docker compose logs --tail=100 nakama frontend
```

## API and server configuration details

### Public endpoints

- Game frontend: https://xoxo.sadiqueazmi.in
- Nakama API: https://nakama-api.sadiqueazmi.in
- Nakama console: https://nakama-admin.sadiqueazmi.in

### Runtime services in compose

- `postgres`
- `nakama`
- `frontend`
- `watchtower`

### Important environment variables

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `NAKAMA_SERVER_KEY`
- `NAKAMA_CONSOLE_USERNAME`, `NAKAMA_CONSOLE_PASSWORD`
- `NAKAMA_LOG_LEVEL`
- `NAKAMA_CORS_ALLOW_ORIGIN`
- `GHCR_NAMESPACE`, `IMAGE_TAG`
- `WATCHTOWER_POLL_INTERVAL`, `WATCHTOWER_DOCKER_API_VERSION`
- `FRONTEND_PORT`

### Frontend build variables (GitHub Actions Variables)

- `VITE_NAKAMA_HOST`
- `VITE_NAKAMA_PORT`
- `VITE_NAKAMA_KEY`
- `VITE_NAKAMA_SSL`

`VITE_NAKAMA_KEY` must be equal to `NAKAMA_SERVER_KEY`.

## How to test multiplayer functionality

### Test A: Matchmaking flow

1. Open the frontend in two separate browser sessions (normal + incognito)
2. Enter different nicknames and authenticate both clients
3. Join matchmaking with the same mode on both clients
4. Confirm both clients enter the same match and receive synchronized board updates
5. Play until game end and verify end state appears on both screens

### Test B: Custom room flow

1. Player A creates a custom room and copies the room code
2. Player B joins using the same code
3. Confirm both players enter the room and game starts

### Test C: Rematch flow

1. Finish a game
2. Vote rematch from one player and verify waiting state
3. Vote from second player and verify a new game starts

### Test D: Disconnect behavior

1. During/after game, close one player session abruptly
2. Verify remaining player gets disconnect/rematch unavailable behavior and can return to matchmaking

### Test E: API and service checks

```bash
docker compose ps
docker compose logs --tail=100 nakama
curl -I http://localhost:7350
```
