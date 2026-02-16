always, keep your answers short and concise.

## Project Context
- Frontend: React + Vite (`src/`)
- Backend: Node + Socket.IO (`server/`)
- Ruleset prototypes: Python (`rulesets/`), currently separate from app runtime

## Working Rules
- Make minimal, focused edits; do not change unrelated files.
- Keep route and data flow behavior stable unless explicitly asked.
- Keep socket event names consistent between client and server.
- Validate changes before finishing (`npm run build` for frontend; run server checks for backend edits).
- If a requirement is ambiguous, ask one short clarifying question before large changes.
- Track pending work and known issues in `TASKS_TRACKER.md`.

## Response Format
- Use short, direct answers.
- Summarize changes in a few bullets with touched file paths.
- State what was verified and what was not.

## Definition of Done
- Frontend edits: `npm run build` passes.
- Backend edits: server starts and relevant socket/API paths are sanity-checked.
- If tests exist for touched code, run them or state clearly why they were not run.

## Git Safety
- Never revert unrelated local changes.
- Never use destructive git commands (for example: `git reset --hard`) unless explicitly requested.
- Keep commits scoped to the task.

## Commit/PR Format
- Use a short summary line.
- List changed files.
- Include a brief verification section with commands run and outcomes.

## User Knowledge Limits
- User is comfortable with Python only.
- Assume beginner-level knowledge for web concepts (frontend, backend, API, server, endpoint, database).
- Prefer plain language over jargon.

## Teaching Style
- Keep explanations short and concise.
- Introduce at most 3 new concepts per response.
- If jargon is necessary, define it in one simple sentence.
- Teach in small steps with one concrete example when needed.
