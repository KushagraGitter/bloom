-- Bloom: pregnancy details leave the server.
--
-- New households keep the dates, health questions and contacts from
-- onboarding only on their phones, encrypted with the household key (a
-- `pregnancy` record in vault_records). The server row then only ties the
-- owner, partner, invites and records together, so the last period date can
-- be empty, and with it the due date it generates.
--
-- Existing rows keep their values until the owner agrees to clear them, once
-- the copy in the vault is confirmed; that is a separate script.

alter table public.pregnancies alter column lmp_date drop not null;
