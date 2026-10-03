-- Row Level Security checks for the phase 1 tables.
-- Three accounts: the owner, her partner, and a stranger who must see nothing.
-- Run with supabase/tests/run.sh.

\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com', '{"full_name": "Owner"}'),
  ('00000000-0000-0000-0000-00000000000b', 'partner@example.com', '{"full_name": "Partner"}'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@example.com', '{"full_name": "Stranger"}');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_user::text, false);
$$;

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAILED: %', what;
  end if;
  raise notice 'ok: %', what;
end;
$$;

grant execute on all functions in schema pg_temp to authenticated;

-- Profiles are created on sign-up -------------------------------------------
select pg_temp.check((select count(*) = 3 from public.profiles), 'sign-up creates a profile');
select pg_temp.check((select name = 'Owner' from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'profile takes the Google name');

set role authenticated;

-- Owner creates the pregnancy ------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

create temp table ids as
with p as (
  insert into public.pregnancies (lmp_date, nickname) values ('2026-04-15', 'Bean') returning id, due_date
)
select id as pregnancy_id, due_date from p;

select pg_temp.check((select due_date = '2027-01-20' from ids), 'due date is LMP + 280 days');
select pg_temp.check(
  (select role = 'owner' from public.members where user_id = auth.uid()),
  'creator becomes the owner member'
);

insert into public.readings (pregnancy_id, type, value_num)
select pregnancy_id, 'weight', 64.2 from ids;
insert into public.readings (pregnancy_id, type, value_num, value_num2)
select pregnancy_id, 'bp', 112, 74 from ids;

do $$
begin
  insert into public.readings (pregnancy_id, type, value_num)
  select pregnancy_id, 'bp', 112 from ids;
  raise exception 'FAILED: BP without diastolic was accepted';
exception when check_violation then
  raise notice 'ok: BP needs both numbers';
end;
$$;

create temp table invite as
with i as (insert into public.invites (pregnancy_id) select pregnancy_id from ids returning code)
select code from i;

select pg_temp.check((select code ~ '^[0-9]{6}$' from invite), 'invite gets a 6-digit code');

-- Stranger sees nothing and cannot write ------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');

select pg_temp.check((select count(*) = 0 from public.pregnancies), 'stranger sees no pregnancies');
select pg_temp.check((select count(*) = 0 from public.readings), 'stranger sees no readings');
select pg_temp.check((select count(*) = 0 from public.members), 'stranger sees no members');
select pg_temp.check((select count(*) = 0 from public.invites), 'stranger sees no invites');
select pg_temp.check((select count(*) = 1 from public.profiles), 'stranger sees only their own profile');

do $$
begin
  insert into public.readings (pregnancy_id, type, value_num) select pregnancy_id, 'kicks', 1 from ids;
  raise exception 'FAILED: stranger logged a reading';
exception when insufficient_privilege then
  raise notice 'ok: stranger cannot log a reading';
end;
$$;

do $$
begin
  insert into public.members (pregnancy_id, user_id, role) select pregnancy_id, auth.uid(), 'partner' from ids;
  raise exception 'FAILED: stranger added themselves as a member';
exception when insufficient_privilege then
  raise notice 'ok: stranger cannot add themselves as a member';
end;
$$;

do $$
begin
  insert into public.invites (pregnancy_id) select pregnancy_id from ids;
  raise exception 'FAILED: stranger created an invite';
exception when insufficient_privilege then
  raise notice 'ok: stranger cannot create invites';
end;
$$;

update public.pregnancies set nickname = 'hacked';
delete from public.readings;
select pg_temp.check((select count(*) = 0 from public.readings), 'stranger still sees nothing after update/delete attempts');

select pg_temp.check((select public.accept_invite('not-a-code') is null), 'wrong invite code is rejected');

-- Partner joins with the code ------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select pg_temp.check((select count(*) = 0 from public.pregnancies), 'partner sees nothing before joining');
select pg_temp.check(
  (select public.accept_invite((select code from invite)) = (select pregnancy_id from ids)),
  'partner joins with the invite code'
);
select pg_temp.check((select count(*) = 1 from public.pregnancies), 'partner now sees the pregnancy');
select pg_temp.check((select count(*) = 2 from public.readings), 'partner sees her readings');
select pg_temp.check((select count(*) = 2 from public.profiles), 'partner sees both profiles');

insert into public.readings (pregnancy_id, type, value_num) select pregnancy_id, 'water', 1 from ids;
select pg_temp.check(
  (select logged_by = auth.uid() from public.readings where type = 'water'),
  'partner log is stamped with who logged it'
);

do $$
begin
  insert into public.readings (pregnancy_id, type, value_num, logged_by)
  select pregnancy_id, 'kicks', 1, '00000000-0000-0000-0000-00000000000a' from ids;
  raise exception 'FAILED: partner logged as someone else';
exception when insufficient_privilege then
  raise notice 'ok: cannot log a reading as someone else';
end;
$$;

do $$
begin
  update public.readings set logged_by = '00000000-0000-0000-0000-00000000000b' where type = 'weight';
  raise exception 'FAILED: partner rewrote who logged a reading';
exception when insufficient_privilege then
  raise notice 'ok: who logged a reading cannot be changed';
end;
$$;

update public.readings set value_num = 64.4 where type = 'weight';
select pg_temp.check(
  (select value_num = 64.4 and logged_by = '00000000-0000-0000-0000-00000000000a' from public.readings where type = 'weight'),
  'partner can correct a value, and the original author stays'
);

update public.pregnancies set nickname = 'Partner edit';
select pg_temp.check((select nickname = 'Bean' from public.pregnancies), 'partner cannot edit her profile details');
select pg_temp.check((select count(*) = 0 from public.invites), 'partner cannot see invites');

insert into public.reminder_prefs (pregnancy_id, kind, enabled) select pregnancy_id, 'water', false from ids;

select pg_temp.check((select public.accept_invite((select code from invite)) is null), 'a code works only once');

-- Owner view after partner joined -------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select pg_temp.check((select count(*) = 3 from public.readings), 'owner sees the partner''s log');
select pg_temp.check((select count(*) = 2 from public.members), 'owner sees both members');
select pg_temp.check((select count(*) = 1 from public.reminder_prefs), 'owner sees the partner''s reminder settings');

update public.reminder_prefs set enabled = true;
select pg_temp.check((select enabled = false from public.reminder_prefs), 'owner cannot change the partner''s reminder settings');

-- A second invite cannot bring in a third person.
create temp table invite2 as
with i as (insert into public.invites (pregnancy_id) select pregnancy_id from ids returning code)
select code from i;
select pg_temp.check(
  (select public.accept_invite((select code from invite2)) = (select pregnancy_id from ids)),
  'owner redeeming their own code changes nothing'
);
select pg_temp.check((select count(*) = 2 from public.members), 'still two members');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select public.accept_invite((select code from invite2)) is null), 'a second partner cannot join');
select pg_temp.check((select count(*) = 0 from public.pregnancies), 'would-be second partner sees nothing');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

update public.pregnancies set nickname = 'Sprout';
select pg_temp.check((select nickname = 'Sprout' from public.pregnancies), 'owner can edit the pregnancy');

delete from public.members where role = 'owner';
select pg_temp.check((select count(*) = 2 from public.members), 'owner membership cannot be deleted');

-- Expired invites -------------------------------------------------------------
reset role;
update public.invites set accepted_by = null, accepted_at = null, expires_at = now() - interval '1 minute';
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');

select pg_temp.check((select public.accept_invite((select code from invite)) is null), 'expired code is rejected');
select pg_temp.check((select count(*) = 0 from public.pregnancies), 'stranger still sees nothing');

-- Code guessing is rate-limited ----------------------------------------------
-- Each guess is its own statement, as it would be from the app, so earlier
-- attempts stay recorded.
reset role;
delete from public.invite_attempts;
set role authenticated;
select public.accept_invite(lpad(n::text, 6, '0')) from generate_series(1, 10) n \g /dev/null

do $$
begin
  perform public.accept_invite('999999');
  raise exception 'FAILED: guessing was not rate-limited';
exception when sqlstate 'P0001' then
  if sqlerrm like 'Too many attempts%' then
    raise notice 'ok: invite guessing is rate-limited after 10 tries an hour';
  else
    raise;
  end if;
end;
$$;

-- Signed-out clients ----------------------------------------------------------
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check((select count(*) = 0 from public.pregnancies), 'signed-out client sees nothing');

do $$
begin
  perform public.accept_invite('000000');
  raise exception 'FAILED: anon could call accept_invite';
exception when insufficient_privilege then
  raise notice 'ok: signed-out client cannot redeem invites';
end;
$$;

reset role;
\echo 'All RLS checks passed.'
