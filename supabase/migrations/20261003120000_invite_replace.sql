-- Invite codes are made only through new_invite(), which replaces any unused
-- code for the pregnancy in one transaction. Two quick taps, or two phones,
-- can no longer leave two codes that both work.

-- Keep only the newest unused code per pregnancy before enforcing one.
delete from public.invites i
where i.accepted_by is null
  and exists (
    select 1 from public.invites newer
    where newer.pregnancy_id = i.pregnancy_id
      and newer.accepted_by is null
      and (newer.created_at, newer.id) > (i.created_at, i.id)
  );

create unique index invites_one_open on public.invites (pregnancy_id) where accepted_by is null;

drop policy "invites: owner creates" on public.invites;

create function public.new_invite(p_pregnancy_id uuid)
returns public.invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
begin
  if not public.is_owner(p_pregnancy_id) then
    raise exception 'Only the owner can invite a partner' using errcode = '42501';
  end if;

  -- Calls for the same pregnancy wait for each other here.
  perform 1 from public.pregnancies p where p.id = p_pregnancy_id for update;

  delete from public.invites i where i.pregnancy_id = p_pregnancy_id and i.accepted_by is null;

  for attempt in 1..5 loop
    begin
      insert into public.invites (pregnancy_id, created_by)
      values (p_pregnancy_id, auth.uid())
      returning * into v_invite;
      return v_invite;
    exception when unique_violation then
      -- The random code is already open on another pregnancy: draw again.
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

revoke execute on function public.new_invite(uuid) from public, anon;
grant execute on function public.new_invite(uuid) to authenticated;
