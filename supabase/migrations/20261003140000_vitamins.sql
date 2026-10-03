-- Bloom phase 2, vitamins: the medicines and supplements she takes, and a row
-- for each day one is ticked off.
--
-- Same access model as phase 1: any member of the pregnancy (she or her
-- partner) can read and change them, and RLS keeps everyone else out.

-- ---------------------------------------------------------------------------
-- medications
-- ---------------------------------------------------------------------------

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references public.pregnancies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  dose text check (char_length(dose) <= 160),
  time_of_day text not null default 'morning' check (time_of_day in ('morning', 'afternoon', 'evening')),
  -- First and last day it is due. The app sends its own local dates, because
  -- the server's clock is UTC. No end date means it carries on.
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_not_before_start check (end_date is null or end_date >= start_date),
  -- Lets med_doses point at a medication and its pregnancy together.
  constraint medications_id_pregnancy_key unique (id, pregnancy_id)
);

create index medications_pregnancy_idx on public.medications (pregnancy_id);

create trigger medications_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- med_doses: one row per medication per day it was taken. The streak is
-- worked out from these. Un-ticking a dose deletes its row.
-- ---------------------------------------------------------------------------

create table public.med_doses (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null,
  pregnancy_id uuid not null,
  -- The calendar day the dose was for, as the app's local date.
  day date not null,
  taken_at timestamptz not null default now(),
  -- Who ticked it, so she can see when her partner did it for her. Kept
  -- (as null) if that person later leaves, so her history stays whole.
  logged_by uuid default auth.uid() references public.profiles (id) on delete set null,
  -- Two phones ticking the same dose at once end up with one row.
  constraint med_doses_one_per_day unique (medication_id, day),
  -- A dose can only belong to a medication of the same pregnancy.
  constraint med_doses_medication_fkey foreign key (medication_id, pregnancy_id)
    references public.medications (id, pregnancy_id) on delete cascade
);

create index med_doses_pregnancy_day_idx on public.med_doses (pregnancy_id, day desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.medications enable row level security;
alter table public.med_doses enable row level security;

create policy "medications: members read" on public.medications
  for select to authenticated
  using (public.is_member(pregnancy_id));

create policy "medications: members add" on public.medications
  for insert to authenticated
  with check (public.is_member(pregnancy_id));

create policy "medications: members edit" on public.medications
  for update to authenticated
  using (public.is_member(pregnancy_id))
  with check (public.is_member(pregnancy_id));

create policy "medications: members remove" on public.medications
  for delete to authenticated
  using (public.is_member(pregnancy_id));

-- Doses are only ever added or taken away, never edited, so there is no
-- update policy.
create policy "med_doses: members read" on public.med_doses
  for select to authenticated
  using (public.is_member(pregnancy_id));

create policy "med_doses: members tick" on public.med_doses
  for insert to authenticated
  with check (public.is_member(pregnancy_id) and logged_by = auth.uid());

create policy "med_doses: members untick" on public.med_doses
  for delete to authenticated
  using (public.is_member(pregnancy_id));

-- ---------------------------------------------------------------------------
-- Realtime: a dose ticked or a medicine added on one phone shows on the other
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.medications, public.med_doses;
  end if;
end;
$$;
