-- Bloom phase 1: people, the pregnancy they share, daily readings and reminder settings.
--
-- Access model: everything hangs off one `pregnancies` row. Its owner and an
-- invited partner are rows in `members`, and Row Level Security only lets a
-- signed-in user touch rows whose pregnancy they are a member of.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'partner');
create type public.dating_method as enum ('lmp', 'due', 'ivf');
create type public.reading_type as enum ('weight', 'bp', 'sugar', 'sleep', 'kicks', 'water');
create type public.unit_system as enum ('metric', 'imperial');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one per login, created automatically on sign-up
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- pregnancies: the root of all shared data
-- ---------------------------------------------------------------------------

create table public.pregnancies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Gestational age is always counted from LMP; the app derives it from
  -- whichever dating method was chosen in onboarding.
  lmp_date date not null,
  due_date date generated always as (lmp_date + 280) stored,
  method public.dating_method not null default 'lmp',
  ivf_transfer_date date,
  ivf_embryo_day smallint check (ivf_embryo_day in (3, 5)),
  babies smallint not null default 1 check (babies between 1 and 4),
  first_pregnancy boolean,
  sex text check (sex in ('girl', 'boy', 'unknown')),
  nickname text,
  height_cm numeric(4, 1) check (height_cm between 100 and 250),
  pre_weight_kg numeric(5, 2) check (pre_weight_kg between 25 and 300),
  blood_group text,
  conditions text[] not null default '{}',
  allergies text,
  doctor text,
  hospital text,
  hospital_phone text,
  emergency_contact text,
  emergency_phone text,
  units public.unit_system not null default 'metric',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ivf_fields check (
    method <> 'ivf' or (ivf_transfer_date is not null and ivf_embryo_day is not null)
  )
);

create trigger pregnancies_updated_at
  before update on public.pregnancies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- members: who can see a pregnancy (drives every RLS policy)
-- ---------------------------------------------------------------------------

create table public.members (
  pregnancy_id uuid not null references public.pregnancies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (pregnancy_id, user_id)
);

create index members_user_idx on public.members (user_id);

-- Exactly one owner and at most one partner per pregnancy.
create unique index members_one_owner on public.members (pregnancy_id) where role = 'owner';
create unique index members_one_partner on public.members (pregnancy_id) where role = 'partner';

-- The creator of a pregnancy becomes its owner member.
create function public.add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.members (pregnancy_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger pregnancies_add_owner
  after insert on public.pregnancies
  for each row execute function public.add_owner_member();

-- SECURITY DEFINER so policies on `members` can call these without recursing
-- into their own RLS checks.
create function public.is_member(p_pregnancy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.pregnancy_id = p_pregnancy_id and m.user_id = auth.uid()
  );
$$;

create function public.is_owner(p_pregnancy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.pregnancy_id = p_pregnancy_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- invites: the owner shares a 6-digit code; the partner redeems it
-- ---------------------------------------------------------------------------

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references public.pregnancies (id) on delete cascade,
  code text not null default lpad((floor(random() * 1000000))::int::text, 6, '0')
    check (code ~ '^[0-9]{6}$'),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '48 hours',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- A code is unique while it can still be redeemed.
create unique index invites_open_code on public.invites (code) where accepted_by is null;

-- Every redemption attempt, to rate-limit code guessing.
create table public.invite_attempts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index invite_attempts_user_idx on public.invite_attempts (user_id, attempted_at);

-- Joins the caller to the invite's pregnancy as its partner. Returns the
-- pregnancy id, or null when the code is wrong, used or expired.
create function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.invites%rowtype;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if (
    select count(*) from public.invite_attempts a
    where a.user_id = v_user and a.attempted_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many attempts, try again later' using errcode = 'P0001';
  end if;

  insert into public.invite_attempts (user_id) values (v_user);

  select * into v_invite
  from public.invites i
  where i.code = p_code and i.accepted_by is null and i.expires_at > now()
  for update;

  -- Return null rather than raising: an exception would roll back the
  -- attempt row above and defeat the rate limit.
  if not found then
    return null;
  end if;

  -- Already a member (e.g. the owner tapping their own code): nothing to do.
  if exists (
    select 1 from public.members m
    where m.pregnancy_id = v_invite.pregnancy_id and m.user_id = v_user
  ) then
    return v_invite.pregnancy_id;
  end if;

  -- Bloom is for two people: once a partner has joined, no one else can.
  if exists (
    select 1 from public.members m
    where m.pregnancy_id = v_invite.pregnancy_id and m.role = 'partner'
  ) then
    return null;
  end if;

  insert into public.members (pregnancy_id, user_id, role)
  values (v_invite.pregnancy_id, v_user, 'partner');

  update public.invites
  set accepted_by = v_user, accepted_at = now()
  where id = v_invite.id;

  return v_invite.pregnancy_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- readings: every Today check-in (weight, BP, sugar, sleep, kicks, water)
-- ---------------------------------------------------------------------------

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references public.pregnancies (id) on delete cascade,
  type public.reading_type not null,
  -- weight kg, BP systolic, sugar mg/dL, sleep hours, kicks/water count
  value_num numeric,
  -- BP diastolic
  value_num2 numeric,
  value_text text,
  taken_at timestamptz not null default now(),
  logged_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bp_has_both check (type <> 'bp' or (value_num is not null and value_num2 is not null)),
  constraint has_value check (value_num is not null or value_text is not null)
);

create index readings_pregnancy_type_time_idx on public.readings (pregnancy_id, type, taken_at desc);

-- Who logged a reading never changes, even when someone else edits the value.
create function public.keep_reading_author()
returns trigger
language plpgsql
as $$
begin
  if new.logged_by is distinct from old.logged_by then
    raise exception 'logged_by cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger readings_keep_author
  before update on public.readings
  for each row execute function public.keep_reading_author();

-- ---------------------------------------------------------------------------
-- reminder_prefs: per person, so the partner can mute water reminders
-- ---------------------------------------------------------------------------

create table public.reminder_prefs (
  pregnancy_id uuid not null references public.pregnancies (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('vitamins', 'water', 'appointments', 'checkin', 'kicks')),
  enabled boolean not null default true,
  times time[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (pregnancy_id, user_id, kind)
);

create trigger reminder_prefs_updated_at
  before update on public.reminder_prefs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.pregnancies enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.readings enable row level security;
alter table public.reminder_prefs enable row level security;

-- profiles: see yourself and anyone you share a pregnancy with; edit only yourself.
create policy "profiles: read self and co-members" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.members theirs
      where theirs.user_id = profiles.id and public.is_member(theirs.pregnancy_id)
    )
  );

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- pregnancies: members read; only the owner creates, edits or deletes.
-- `owner_id = auth.uid()` lets `insert ... returning` see the new row before
-- the trigger's owner membership is visible.
create policy "pregnancies: members read" on public.pregnancies
  for select to authenticated
  using (owner_id = auth.uid() or public.is_member(id));

create policy "pregnancies: create as owner" on public.pregnancies
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "pregnancies: owner updates" on public.pregnancies
  for update to authenticated
  using (public.is_owner(id))
  with check (owner_id = auth.uid());

create policy "pregnancies: owner deletes" on public.pregnancies
  for delete to authenticated
  using (public.is_owner(id));

-- members: read your pregnancy's members. Rows are only added by the owner
-- trigger and accept_invite(). The owner can remove a partner, and a
-- partner can leave.
create policy "members: members read" on public.members
  for select to authenticated
  using (public.is_member(pregnancy_id));

create policy "members: remove partner" on public.members
  for delete to authenticated
  using (role = 'partner' and (user_id = auth.uid() or public.is_owner(pregnancy_id)));

-- invites: owner only. Partners redeem through accept_invite().
create policy "invites: owner reads" on public.invites
  for select to authenticated
  using (public.is_owner(pregnancy_id));

create policy "invites: owner creates" on public.invites
  for insert to authenticated
  with check (public.is_owner(pregnancy_id) and created_by = auth.uid() and accepted_by is null);

create policy "invites: owner deletes" on public.invites
  for delete to authenticated
  using (public.is_owner(pregnancy_id));

-- invite_attempts: no policies, so only accept_invite() (security definer) touches it.

-- readings: any member reads and logs; entries are stamped with who logged them.
create policy "readings: members read" on public.readings
  for select to authenticated
  using (public.is_member(pregnancy_id));

create policy "readings: members log" on public.readings
  for insert to authenticated
  with check (public.is_member(pregnancy_id) and logged_by = auth.uid());

create policy "readings: members edit" on public.readings
  for update to authenticated
  using (public.is_member(pregnancy_id))
  with check (public.is_member(pregnancy_id));

create policy "readings: members delete" on public.readings
  for delete to authenticated
  using (public.is_member(pregnancy_id));

-- reminder_prefs: members can see each other's settings; each person edits their own.
create policy "reminder_prefs: members read" on public.reminder_prefs
  for select to authenticated
  using (public.is_member(pregnancy_id));

create policy "reminder_prefs: own insert" on public.reminder_prefs
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(pregnancy_id));

create policy "reminder_prefs: own update" on public.reminder_prefs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(pregnancy_id));

create policy "reminder_prefs: own delete" on public.reminder_prefs
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Function privileges: nothing callable by signed-out clients
-- ---------------------------------------------------------------------------

revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.add_owner_member() from public, anon, authenticated;
revoke execute on function public.keep_reading_author() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: a kick or glass of water logged on one phone shows on the other
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.readings;
  end if;
end;
$$;
