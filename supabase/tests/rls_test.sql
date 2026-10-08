-- Row Level Security checks for the phase 1 and 2 tables.
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
select i.code from public.new_invite((select pregnancy_id from ids)) i;

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
  perform public.new_invite((select pregnancy_id from ids));
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

do $$
begin
  perform public.new_invite((select pregnancy_id from ids));
  raise exception 'FAILED: partner created an invite';
exception when insufficient_privilege then
  raise notice 'ok: partner cannot create invites';
end;
$$;

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
select i.code from public.new_invite((select pregnancy_id from ids)) i;
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

-- A new code replaces the unused one -------------------------------------------
create temp table invite3 as
select i.code from public.new_invite((select pregnancy_id from ids)) i;
create temp table invite4 as
select i.code from public.new_invite((select pregnancy_id from ids)) i;
select pg_temp.check(
  (select count(*) = 1 from public.invites where accepted_by is null),
  'only one unused code exists at a time'
);
select pg_temp.check(
  (select code from public.invites where accepted_by is null) = (select code from invite4),
  'the newest code is the one kept'
);

do $$
begin
  insert into public.invites (pregnancy_id) select pregnancy_id from ids;
  raise exception 'FAILED: owner inserted an invite directly';
exception when insufficient_privilege then
  raise notice 'ok: invites are only made through new_invite()';
end;
$$;

-- Vitamins ---------------------------------------------------------------------
-- Either of them can add medicines and tick doses; a stranger sees and changes nothing.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

-- Runs a statement and checks it fails with the given SQLSTATE.
create function pg_temp.rejects(stmt text, expected text, what text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAILED: % was accepted', what;
exception when others then
  if sqlstate = expected then
    raise notice 'ok: % is rejected', what;
  else
    raise;
  end if;
end;
$$;

create temp table med as
with m as (
  insert into public.medications (pregnancy_id, name, dose, time_of_day, start_date)
  select pregnancy_id, 'Iron', '1 tablet after lunch', 'afternoon', '2026-10-01' from ids
  returning id
)
select id as medication_id from m;

select pg_temp.check((select count(*) = 1 from public.medications), 'owner adds a medication');
select pg_temp.rejects(
  $q$insert into public.medications (pregnancy_id, name, start_date, end_date) select pregnancy_id, 'Calcium', '2026-10-01', '2026-09-30' from ids$q$,
  '23514', 'a medication ending before it starts');
select pg_temp.rejects(
  $q$insert into public.medications (pregnancy_id, name) select pregnancy_id, '  ' from ids$q$,
  '23514', 'a blank medication name');
select pg_temp.rejects(
  $q$insert into public.medications (pregnancy_id, name, time_of_day) select pregnancy_id, 'Calcium', 'midnight' from ids$q$,
  '23514', 'an unknown time of day');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 1 from public.medications), 'partner sees her medications');

insert into public.medications (pregnancy_id, name) select pregnancy_id, 'Folic acid' from ids;
select pg_temp.check((select count(*) = 2 from public.medications), 'partner can add a medication');

insert into public.med_doses (medication_id, pregnancy_id, day)
select medication_id, (select pregnancy_id from ids), '2026-10-02' from med;
select pg_temp.check((select logged_by = auth.uid() from public.med_doses), 'a dose is stamped with who ticked it');
select pg_temp.rejects(
  $q$insert into public.med_doses (medication_id, pregnancy_id, day) select medication_id, (select pregnancy_id from ids), '2026-10-02' from med$q$,
  '23505', 'a second dose for the same day');
select pg_temp.rejects(
  $q$insert into public.med_doses (medication_id, pregnancy_id, day, logged_by) select medication_id, (select pregnancy_id from ids), '2026-10-03', '00000000-0000-0000-0000-00000000000a' from med$q$,
  '42501', 'a dose ticked as someone else');

-- What the app sends when a second phone ticks the same dose.
insert into public.med_doses (medication_id, pregnancy_id, day)
select medication_id, (select pregnancy_id from ids), '2026-10-02' from med
on conflict (medication_id, day) do nothing;
select pg_temp.check((select count(*) = 1 from public.med_doses), 'ticking the same dose twice leaves one row');

update public.med_doses set day = '2026-10-09';
select pg_temp.check((select day = '2026-10-02' from public.med_doses), 'a dose cannot be edited, only taken away');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 1 from public.med_doses), 'owner sees the dose her partner ticked');

update public.medications set dose = '2 tablets' where name = 'Folic acid';
select pg_temp.check((select dose = '2 tablets' from public.medications where name = 'Folic acid'), 'either of them can edit a medication');

delete from public.med_doses where day = '2026-10-02';
select pg_temp.check((select count(*) = 0 from public.med_doses), 'a dose can be un-ticked');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) = 0 from public.medications), 'stranger sees no medications');
select pg_temp.check((select count(*) = 0 from public.med_doses), 'stranger sees no doses');
select pg_temp.rejects(
  $q$insert into public.medications (pregnancy_id, name) select pregnancy_id, 'Sneaky' from ids$q$,
  '42501', 'a stranger adding a medication');
select pg_temp.rejects(
  $q$insert into public.med_doses (medication_id, pregnancy_id, day) select medication_id, (select pregnancy_id from ids), '2026-10-02' from med$q$,
  '42501', 'a stranger ticking a dose');
update public.medications set name = 'hacked';
delete from public.medications;

-- Even with a pregnancy of their own, a dose cannot point at her medication.
create temp table strangers_pregnancy as
with p as (insert into public.pregnancies (lmp_date) values ('2026-06-01') returning id)
select id as pregnancy_id from p;
select pg_temp.rejects(
  $q$insert into public.med_doses (medication_id, pregnancy_id, day) select medication_id, (select pregnancy_id from strangers_pregnancy), '2026-10-02' from med$q$,
  '23503', 'a dose for someone else''s medication');
delete from public.pregnancies where id = (select pregnancy_id from strangers_pregnancy);

-- A household set up since the details moved to the vault has none on the server.
create temp table empty_pregnancy as
with p as (insert into public.pregnancies default values returning id, lmp_date, due_date)
select * from p;
select pg_temp.check((select lmp_date is null and due_date is null from empty_pregnancy), 'a pregnancy can be created with no details');
select pg_temp.check(
  (select count(*) = 1 from public.members m join empty_pregnancy e on e.id = m.pregnancy_id where m.user_id = auth.uid() and m.role = 'owner'),
  'its creator still becomes the owner');
delete from public.pregnancies where id = (select id from empty_pregnancy);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(
  (select count(*) = 2 and bool_and(name <> 'hacked') from public.medications),
  'a stranger cannot change or delete her medications');

insert into public.med_doses (medication_id, pregnancy_id, day)
select medication_id, (select pregnancy_id from ids), '2026-10-02' from med;
delete from public.medications where id = (select medication_id from med);
select pg_temp.check((select count(*) = 0 from public.med_doses), 'removing a medication removes its doses');
select pg_temp.check((select count(*) = 1 from public.medications), 'the owner can remove a medication');

-- Appointments ----------------------------------------------------------------
insert into public.appointments (pregnancy_id, title, appt_date, appt_time, place)
select pregnancy_id, 'Glucose tolerance test', '2026-10-14', '09:00', 'City Clinic' from ids;
select pg_temp.check((select count(*) = 1 from public.appointments), 'owner books an appointment');
select pg_temp.check((select appt_time = time '09:00' from public.appointments), 'its time is kept as it was typed');

insert into public.appointments (pregnancy_id, title, appt_date)
select pregnancy_id, 'Dentist', '2026-10-20' from ids;
select pg_temp.check(
  (select appt_time is null and place is null from public.appointments where title = 'Dentist'),
  'time and place are optional');

select pg_temp.rejects(
  $q$insert into public.appointments (pregnancy_id, title, appt_date) select pregnancy_id, '   ', '2026-10-21' from ids$q$,
  '23514', 'a blank appointment title');
select pg_temp.rejects(
  $q$insert into public.appointments (pregnancy_id, title, appt_date) select pregnancy_id, repeat('x', 81), '2026-10-21' from ids$q$,
  '23514', 'an appointment title over 80 characters');
select pg_temp.rejects(
  $q$insert into public.appointments (pregnancy_id, title, appt_date, place) select pregnancy_id, 'Scan', '2026-10-21', repeat('x', 121) from ids$q$,
  '23514', 'a place over 120 characters');
select pg_temp.rejects(
  $q$insert into public.appointments (pregnancy_id, title) select pregnancy_id, 'Scan' from ids$q$,
  '23502', 'an appointment with no date');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 2 from public.appointments), 'partner sees her appointments');

insert into public.appointments (pregnancy_id, title, appt_date, appt_time)
select pregnancy_id, 'Growth scan', '2026-11-11', '10:00' from ids;
select pg_temp.check((select count(*) = 3 from public.appointments), 'partner can book an appointment');

update public.appointments set appt_time = '10:30' where title = 'Growth scan';
select pg_temp.check(
  (select appt_time = time '10:30' from public.appointments where title = 'Growth scan'),
  'either of them can change an appointment');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 3 from public.appointments), 'owner sees what her partner booked');

delete from public.appointments where title = 'Dentist';
select pg_temp.check((select count(*) = 2 from public.appointments), 'either of them can cancel an appointment');

-- Even a member cannot move one into a pregnancy they do not belong to.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
create temp table other_pregnancy as
with p as (insert into public.pregnancies (lmp_date) values ('2026-06-01') returning id)
select id as pregnancy_id from p;

select pg_temp.check((select count(*) = 0 from public.appointments), 'stranger sees no appointments');
select pg_temp.rejects(
  $q$insert into public.appointments (pregnancy_id, title, appt_date) select pregnancy_id, 'Sneaky', '2026-10-21' from ids$q$,
  '42501', 'a stranger booking an appointment');
update public.appointments set title = 'hacked';
delete from public.appointments;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(
  (select count(*) = 2 and bool_and(title <> 'hacked') from public.appointments),
  'a stranger cannot change or cancel her appointments');
select pg_temp.rejects(
  $q$update public.appointments set pregnancy_id = (select pregnancy_id from other_pregnancy)$q$,
  '42501', 'moving an appointment into another pregnancy');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
delete from public.pregnancies where id = (select pregnancy_id from other_pregnancy);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

-- Encrypted records -------------------------------------------------------------
-- The server only ever holds sealed blobs; these checks are about who may
-- write them and which edit wins.
insert into public.vault_records (id, pregnancy_id, nonce, ciphertext, client_updated_at, seq)
select '10000000-0000-0000-0000-000000000001', pregnancy_id, repeat('n', 32), repeat('c', 40), '2026-10-04 10:00+00', 999999 from ids;
select pg_temp.check((select count(*) = 1 from public.vault_records), 'owner stores an encrypted record');
select pg_temp.check((select seq < 999999 from public.vault_records), 'the server picks the seq, not the phone');

select pg_temp.rejects(
  $q$insert into public.vault_records (id, pregnancy_id, nonce, ciphertext, client_updated_at) select gen_random_uuid(), pregnancy_id, 'short', repeat('c', 40), now() from ids$q$,
  '23514', 'a record with a malformed nonce');

create temp table first_seq as select seq from public.vault_records;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 1 from public.vault_records), 'partner sees her encrypted records');

insert into public.vault_records (id, pregnancy_id, nonce, ciphertext, client_updated_at)
select '10000000-0000-0000-0000-000000000001', pregnancy_id, repeat('m', 32), repeat('d', 40), '2026-10-04 11:00+00' from ids
on conflict (id) do update set nonce = excluded.nonce, ciphertext = excluded.ciphertext, client_updated_at = excluded.client_updated_at;
select pg_temp.check(
  (select ciphertext = repeat('d', 40) and seq > (select seq from first_seq) from public.vault_records),
  'a newer edit replaces the record and gets a new seq');

insert into public.vault_records (id, pregnancy_id, nonce, ciphertext, client_updated_at)
select '10000000-0000-0000-0000-000000000001', pregnancy_id, repeat('o', 32), repeat('e', 40), '2026-10-04 10:30+00' from ids
on conflict (id) do update set nonce = excluded.nonce, ciphertext = excluded.ciphertext, client_updated_at = excluded.client_updated_at;
select pg_temp.check(
  (select ciphertext = repeat('d', 40) from public.vault_records),
  'an older edit from a phone that was offline does not overwrite a newer one');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
create temp table vault_other as
with p as (insert into public.pregnancies (lmp_date) values ('2026-06-01') returning id)
select id as pregnancy_id from p;

select pg_temp.check((select count(*) = 0 from public.vault_records), 'stranger sees no encrypted records');
select pg_temp.rejects(
  $q$insert into public.vault_records (id, pregnancy_id, nonce, ciphertext, client_updated_at) select gen_random_uuid(), pregnancy_id, repeat('n', 32), repeat('c', 40), now() from ids$q$,
  '42501', 'a stranger storing a record in her household');
update public.vault_records set ciphertext = repeat('x', 40), client_updated_at = '2030-01-01';
delete from public.vault_records;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(
  (select count(*) = 1 and bool_and(ciphertext = repeat('d', 40)) from public.vault_records),
  'a stranger cannot change or delete her encrypted records');
delete from public.vault_records;
select pg_temp.check((select count(*) = 1 from public.vault_records), 'even members cannot delete; deletes sync as tombstones');
select pg_temp.rejects(
  $q$update public.vault_records set pregnancy_id = (select pregnancy_id from vault_other), client_updated_at = '2030-01-01'$q$,
  '42501', 'moving a record into another pregnancy');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
delete from public.pregnancies where id = (select pregnancy_id from vault_other);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

-- Daily scan allowance -------------------------------------------------------
select pg_temp.check((select public.claim_scan((select pregnancy_id from ids), 2)), 'owner takes a scan from the allowance');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select public.claim_scan((select pregnancy_id from ids), 2)), 'partner takes the second scan');
select pg_temp.check((select not public.claim_scan((select pregnancy_id from ids), 2)), 'a third scan is refused once the allowance is used');
select pg_temp.check((select not public.claim_scan((select pregnancy_id from ids), 0)), 'a zero allowance refuses every scan');
select pg_temp.check((select count(*) = 0 from public.scan_usage), 'nobody reads the scan counts directly');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.rejects(
  $q$select public.claim_scan((select pregnancy_id from ids), 50)$q$,
  '42501', 'a stranger taking a scan from her allowance');
select pg_temp.rejects(
  $q$insert into public.scan_usage (pregnancy_id, day, count) select pregnancy_id, current_date, 0 from ids$q$,
  '42501', 'writing scan counts directly');
reset role;
select pg_temp.check((select count = 2 from public.scan_usage), 'the refused scan was not counted');
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

-- Expired invites -------------------------------------------------------------
reset role;
delete from public.invites where accepted_by is null;
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

do $$
begin
  perform public.claim_scan(gen_random_uuid(), 50);
  raise exception 'FAILED: anon could call claim_scan';
exception when insufficient_privilege then
  raise notice 'ok: signed-out client cannot take scans';
end;
$$;

reset role;
\echo 'All RLS checks passed.'
