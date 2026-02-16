# TTRPG Website

A multiplayer tabletop RPG web app with:
- React + Vite frontend
- Node + Express + Socket.IO backend
- Supabase auth (email/password) and Postgres data

## What This Version Supports
- Account signup/login
- DM can create games
- Invite-code join flow for players
- Shared game + character data (no browser-only storage)
- Realtime dice events per game room

## Project Structure
- `src/`: React frontend
- `server/`: Express API + Socket.IO
- `server/supabase-schema.sql`: database schema for Supabase
- `rulesets/`: Python prototype ruleset logic (not runtime-integrated yet)
- `TASKS_TRACKER.md`: project backlog and issue tracker

## Local Setup
1. Install frontend dependencies:
```bash
npm install
```

2. Install backend dependencies:
```bash
cd server
npm install
cd ..
```

3. Create environment files:
- Frontend: copy `.env.example` to `.env`
- Backend: copy `server/.env.example` to `server/.env`

4. Create Supabase tables:
- Open Supabase SQL editor
- Run `server/supabase-schema.sql`

5. Run frontend:
```bash
npm run dev
```

6. Run backend in another terminal:
```bash
cd server
npm run dev
```

## Environment Variables
Frontend (`.env`):
- `VITE_API_BASE_URL`
- `VITE_SOCKET_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Backend (`server/.env`):
- `PORT`
- `CORS_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET` (optional in current code path)

## Deployment Targets
- Frontend: Vercel
- Backend: Render
- Database/Auth: Supabase
