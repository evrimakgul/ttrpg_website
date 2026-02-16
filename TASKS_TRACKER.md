# Task Tracker

Use this file to track upcoming work and known issues.

## Backlog
- [ ] Security cleanup: rotate `SUPABASE_SERVICE_ROLE_KEY` later.
  - Why: this key was shared during setup and should be replaced.
  - Acceptance: new key is generated in Supabase and updated in `server/.env` and cloud backend env vars.

- [ ] Show DM game notes to players.
  - Current behavior: DM can edit notes in `dm/game-dashboard`, but players do not have a UI section to view these notes.
  - Desired behavior: Player-facing screen should display the game notes saved by DM.
  - Suggested location: `Player Dashboard` or `Character Sheet` page for the selected game.
  - Acceptance: When DM updates notes and clicks save, player can refresh and see the updated notes.

## In Progress
- [ ] None

## Done
- [x] Hosted multiplayer foundation (auth, shared DB storage, invite-code join, scoped dice rooms).
