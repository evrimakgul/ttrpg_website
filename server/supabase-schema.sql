create table if not exists profiles (
  id uuid primary key,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists games (
  id uuid primary key,
  owner_user_id uuid not null,
  name text not null,
  notes text not null default '',
  ruleset_name text,
  ruleset_type text not null default 'builtin' check (ruleset_type in ('builtin', 'custom')),
  ruleset_id uuid,
  ruleset_version integer,
  invite_code text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists game_members (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('dm', 'player')),
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create table if not exists characters (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  archetype text not null default '',
  background text not null default '',
  age text not null default '',
  race text not null default '',
  gender text not null default '',
  affiliation text not null default '',
  notes text not null default '',
  sheet_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create table if not exists rulesets (
  id uuid primary key,
  owner_user_id uuid not null,
  name text not null,
  draft_schema jsonb not null default '{}'::jsonb,
  latest_published_version integer not null default 0,
  attributes jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, name)
);

create table if not exists ruleset_versions (
  id uuid primary key,
  ruleset_id uuid not null references rulesets(id) on delete cascade,
  version integer not null check (version > 0),
  schema_json jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (ruleset_id, version)
);

alter table games
  add column if not exists ruleset_type text not null default 'builtin';
alter table games
  add column if not exists ruleset_id uuid null references rulesets(id) on delete set null;
alter table games
  add column if not exists ruleset_version integer null;
alter table games
  drop constraint if exists games_ruleset_type_check;
alter table games
  add constraint games_ruleset_type_check check (ruleset_type in ('builtin', 'custom'));

alter table rulesets
  add column if not exists draft_schema jsonb not null default '{}'::jsonb;
alter table rulesets
  add column if not exists latest_published_version integer not null default 0;

create index if not exists idx_games_ruleset_id on games (ruleset_id);
create index if not exists idx_ruleset_versions_ruleset_id_version on ruleset_versions (ruleset_id, version);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_games_updated_at on games;
create trigger trg_games_updated_at
before update on games
for each row
execute function set_updated_at();

drop trigger if exists trg_characters_updated_at on characters;
create trigger trg_characters_updated_at
before update on characters
for each row
execute function set_updated_at();

drop trigger if exists trg_rulesets_updated_at on rulesets;
create trigger trg_rulesets_updated_at
before update on rulesets
for each row
execute function set_updated_at();
