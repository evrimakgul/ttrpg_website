# Task Tracker

Use this file to track upcoming work and known issues.

## Backlog
- [ ] Security cleanup: rotate `SUPABASE_SERVICE_ROLE_KEY` later.
  - Why: this key was shared during setup and should be replaced.
  - Acceptance: new key is generated in Supabase and updated in `server/.env` and cloud backend env vars.

- [ ] Bonus hover source breakdown (Phase 2).
  - Current behavior: Character sheet shows `Base | Bonus | Total` only.
  - Desired behavior: Hovering bonus should show itemized bonus sources (rule/relation/source attribution).
  - Acceptance: Tooltip/popover lists each bonus entry and source label for the hovered field.

- [ ] Show DM game notes to players.
  - Current behavior: DM can edit notes in `dm/game-dashboard`, but players do not have a UI section to view these notes.
  - Desired behavior: Player-facing screen should display the game notes saved by DM.
  - Suggested location: `Player Dashboard` or `Character Sheet` page for the selected game.
  - Acceptance: When DM updates notes and clicks save, player can refresh and see the updated notes.

- [ ] Bonus field link UX follow-up (post Spell Builder V1).
  - Current behavior: bonus link can only be set while creating a new number box.
  - Desired behavior: allow setting/changing/removing bonus links from existing boxes in the list/editor flow.
  - Acceptance: existing number box can be edited to change `bonusFieldId` without recreating the box.

## In Progress
- [ ] Ruleset Builder V2 rollout (hybrid editor + publish/versioning + dynamic custom sheets).
  - Scope:
    - New ruleset draft schema and published version snapshots.
    - Game linkage by `ruleset_id` + pinned version.
    - Dynamic custom sheet rendering + server-side validation on save.
  - Acceptance checkpoints:
    - `Create/Edit Custom Ruleset` supports categories, boxes, relations, and rule definitions.
    - Publish creates immutable version rows and allows linking specific version to a game.
    - `Character Sheet` renders from custom ruleset runtime when game uses custom mode.
    - Built-in ruleset flow remains functional.

- [ ] Spell Builder V1 (ruleset metadata builder).
  - Scope:
    - `Spell Builder` modal in `CreateRuleset` with tabs for spell groups and spells.
    - Persist `spellGroups` and `spells` inside ruleset schema with strict client/server validation.
    - Block unsafe deletes for spell-linked groups/fields.
  - Acceptance checkpoints:
    - Create/edit/delete spell groups and spells from modal.
    - Save draft and publish version with valid spell metadata.
    - Invalid spell metadata blocks save/publish.

## Done
- [x] Hosted multiplayer foundation (auth, shared DB storage, invite-code join, scoped dice rooms).
- [x] Persist custom rulesets and keep editing after creation (no redirect-only behavior).
