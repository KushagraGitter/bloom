-- Bloom: a daily cap on AI scans.
--
-- The `scan` Edge Function sends a report photo or PDF straight to Claude and
-- returns what it read; nothing about the report is stored here. This table
-- only counts how many scans each household has started per day, so a bug or
-- a stuck retry loop cannot run up the Anthropic bill.
--
-- Nobody reads or writes the table directly. The function calls
-- `claim_scan(pregnancy)` with the signed-in user's own token, which checks
-- membership, takes one scan from today's allowance and says whether it was
-- allowed.

create table public.scan_usage (
  pregnancy_id uuid not null references public.pregnancies (id) on delete cascade,
  -- The UTC day the scans were started on.
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (pregnancy_id, day)
);

-- No policies: only claim_scan (security definer) touches it.
alter table public.scan_usage enable row level security;

-- Takes one scan from today's allowance for this pregnancy. Returns true when
-- the scan may go ahead, false when the day's allowance is used up. Raises
-- when the caller is not a member of the pregnancy.
create function public.claim_scan(p_pregnancy_id uuid, p_daily_limit integer default 50)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_member(p_pregnancy_id) then
    raise exception 'Not a member of this pregnancy' using errcode = '42501';
  end if;
  if coalesce(p_daily_limit, 0) < 1 then
    return false;
  end if;

  insert into public.scan_usage as u (pregnancy_id, day, count)
  values (p_pregnancy_id, (now() at time zone 'utc')::date, 1)
  on conflict (pregnancy_id, day) do update set count = u.count + 1
    where u.count < p_daily_limit
  returning u.count into v_count;

  -- The update is skipped (no row returned) once the limit is reached.
  return v_count is not null;
end;
$$;

revoke execute on function public.claim_scan(uuid, integer) from public, anon;
grant execute on function public.claim_scan(uuid, integer) to authenticated;
