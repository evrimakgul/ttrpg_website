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
