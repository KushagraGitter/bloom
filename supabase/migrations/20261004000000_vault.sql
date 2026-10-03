-- Bloom: end-to-end encrypted sync.
--
-- Health data lives on the phones. Each record is encrypted on the phone with
-- the household key, which never reaches the server, and stored here only so
-- the other phone (and a new phone after a loss) can fetch it. The server sees
-- which household a record belongs to, when it changed and how big it is, but
-- not what kind of record it is or what it says.
--
-- Same access model as the other tables: members of the pregnancy can read and
-- write, everyone else sees nothing. Deletes are synced as encrypted
-- tombstones, so there is no delete policy.

create sequence public.vault_records_seq;

create table public.vault_records (
  -- Chosen by the phone, so a record keeps its id before it is ever synced.
  id uuid primary key,
  pregnancy_id uuid not null references public.pregnancies (id) on delete cascade,
  -- Which household key encrypted it; goes up when a partner is removed.
  key_version smallint not null default 1 check (key_version >= 1),
  -- XChaCha20-Poly1305: a 24-byte nonce and the sealed record, both base64.
  nonce text not null check (char_length(nonce) = 32),
  ciphertext text not null check (char_length(ciphertext) between 24 and 2000000),
  -- When the phone made the change. The newest edit of a record wins.
  client_updated_at timestamptz not null,
  -- Set by the trigger below on every write; phones pull everything above
  -- what they have already seen.
  seq bigint not null,
  created_at timestamptz not null default now()
);

create index vault_records_pregnancy_seq_idx on public.vault_records (pregnancy_id, seq);

-- Every write gets a fresh seq, whatever the client sent. An update that is
-- older than what is stored is dropped (returning null skips the row), so a
-- phone that was offline cannot overwrite a newer edit from the other phone.
create function public.vault_records_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.pregnancy_id <> old.pregnancy_id then
      raise exception 'A record cannot move to another pregnancy' using errcode = '42501';
    end if;
    if new.client_updated_at < old.client_updated_at then
      return null;
    end if;
    new.created_at := old.created_at;
  end if;
  new.seq := nextval('public.vault_records_seq');
  return new;
end;
$$;

revoke execute on function public.vault_records_stamp() from public, anon, authenticated;

create trigger vault_records_stamp
  before insert or update on public.vault_records
  for each row execute function public.vault_records_stamp();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.vault_records enable row level security;

create policy "vault_records: members read" on public.vault_records
  for select to authenticated
  using (public.is_member(pregnancy_id));

create policy "vault_records: members add" on public.vault_records
  for insert to authenticated
  with check (public.is_member(pregnancy_id));

create policy "vault_records: members edit" on public.vault_records
  for update to authenticated
  using (public.is_member(pregnancy_id))
  with check (public.is_member(pregnancy_id));

-- ---------------------------------------------------------------------------
-- Realtime: tells the other phone there is something new to pull
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.vault_records;
  end if;
end;
$$;
