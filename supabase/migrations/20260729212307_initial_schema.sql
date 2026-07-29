-- Misty Sitter - Cat Care Coordination App

-- Caregivers (the people who visit Misty)
create table public.caregivers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text not null default '😊',
  created_at timestamptz not null default now()
);

-- Task definitions (what needs to be done)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text not null default '✅',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Task completions (who did what and when)
create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  caregiver_id uuid not null references public.caregivers(id) on delete cascade,
  completed_at timestamptz not null default now(),
  notes text
);

-- Food pack tracking (frozen → defrosting → expired)
create table public.food_packs (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'Natural Food Pack',
  defrosted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 days'),
  placed_by uuid references public.caregivers(id),
  replaced_by uuid references public.caregivers(id),
  replaced_at timestamptz,
  status text not null default 'defrosting' check (status in ('defrosting', 'ready', 'expired', 'replaced')),
  notes text,
  created_at timestamptz not null default now()
);

-- Instructions (videos, text guides)
create table public.instructions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Visit log (check-ins)
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references public.caregivers(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  notes text
);

-- Enable RLS but allow all (public app, no auth)
alter table public.caregivers enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.food_packs enable row level security;
alter table public.instructions enable row level security;
alter table public.visits enable row level security;

-- Public access policies (anon can do everything)
create policy "Public read caregivers" on public.caregivers for select using (true);
create policy "Public insert caregivers" on public.caregivers for insert with check (true);

create policy "Public read tasks" on public.tasks for select using (true);
create policy "Public manage tasks" on public.tasks for all using (true);

create policy "Public read task_completions" on public.task_completions for select using (true);
create policy "Public insert task_completions" on public.task_completions for insert with check (true);
create policy "Public delete task_completions" on public.task_completions for delete using (true);

create policy "Public read food_packs" on public.food_packs for select using (true);
create policy "Public insert food_packs" on public.food_packs for insert with check (true);
create policy "Public update food_packs" on public.food_packs for update using (true);

create policy "Public read instructions" on public.instructions for select using (true);
create policy "Public manage instructions" on public.instructions for all using (true);

create policy "Public read visits" on public.visits for select using (true);
create policy "Public insert visits" on public.visits for insert with check (true);

-- Seed default tasks
insert into public.tasks (name, description, icon, sort_order) values
  ('Feed Misty (wet food)', 'One portion of wet food in her bowl', '🍖', 1),
  ('Feed Misty (dry food)', 'Top up dry food bowl if low', '🥣', 2),
  ('Fresh water', 'Change water in all bowls', '💧', 3),
  ('Clean litter box', 'Scoop and clean the litter box', '🧹', 4),
  ('Playtime', 'At least 10 minutes of play', '🎾', 5),
  ('Check food pack', 'Check defrost status of natural food', '🧊', 6),
  ('Cuddles & check-up', 'Make sure she seems happy and healthy', '💕', 7);

-- Seed default caregivers (placeholder names - user will update)
insert into public.caregivers (name, emoji) values
  ('Koren', '👨‍💻'),
  ('Guest 1', '🌟'),
  ('Guest 2', '✨'),
  ('Guest 3', '🌸'),
  ('Guest 4', '🦋'),
  ('Guest 5', '🌻');
