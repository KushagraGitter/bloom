-- Bloom phase 2, appointments: the scans, check-ups and tests that are booked.
--
-- Same access model as the other tables: any member of the pregnancy (she or
-- her partner) can read, add, change and remove them, and RLS keeps everyone
-- else out.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references public.pregnancies (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  -- The day and, if it is known, the clock time at the clinic, exactly as the
  -- app sends them. This is not a UTC moment: "9:00" stays 9:00 on both phones
  -- whatever their time zone, and an appointment with no time is a plain day.
  appt_date date not null,
  appt_time time,
  place text check (char_length(place) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_pregnancy_date_idx on public.appointments (pregnancy_id, appt_date);

create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.appointments enable row level security;

create policy "appointments: members read" on public.appointments
  for select to authenticated
  using (public.is_member(pregnancy_id));

create policy "appointments: members add" on public.appointments
  for insert to authenticated
  with check (public.is_member(pregnancy_id));

create policy "appointments: members edit" on public.appointments
  for update to authenticated
  using (public.is_member(pregnancy_id))
  with check (public.is_member(pregnancy_id));

create policy "appointments: members remove" on public.appointments
  for delete to authenticated
  using (public.is_member(pregnancy_id));

-- ---------------------------------------------------------------------------
-- Realtime: an appointment booked on one phone shows on the other
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.appointments;
  end if;
end;
$$;
