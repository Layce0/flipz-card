create table profiles (
  id         uuid references auth.users primary key,
  full_name  text,
  avatar_url text,
  created_at timestamptz default now()
);

create table projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  platform    text check (platform in ('android','ios','both')),
  description text,
  status      text default 'active' check (status in ('active','archived')),
  owner_id    uuid references profiles(id),
  created_at  timestamptz default now()
);

create table project_members (
  project_id uuid references projects(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  role       text default 'member' check (role in ('admin','member','viewer')),
  joined_at  timestamptz default now(),
  primary key (project_id, user_id)
);

-- RLS: chaque user voit seulement les projets dont il est membre
alter table projects enable row level security;
create policy "Membres voient leur projet"
  on projects for select
  using (id in (select project_id from project_members where user_id = auth.uid()));

-- Trigger: créer profil automatiquement
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
