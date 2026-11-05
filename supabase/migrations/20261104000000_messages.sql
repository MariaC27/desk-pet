-- Desk Pet messaging.
--
-- Senders sign in to the sender page (Supabase Auth) and can only see their
-- own recipients and messages (RLS). Recipients never sign in: their app pairs
-- once with a single-use code, gets a random device secret, and talks only to
-- the `pair` / `messages` Edge Functions, which check that secret's hash.
-- Plain codes and secrets are never stored.

create extension if not exists pgcrypto with schema extensions;

-- ---- tables ------------------------------------------------------------------

create table public.recipients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);
create index recipients_owner_idx on public.recipients (owner_id);

create table public.pairing_codes (
  code_hash text primary key,
  recipient_id uuid not null references public.recipients (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz
);
create index pairing_codes_recipient_idx on public.pairing_codes (recipient_id);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.recipients (id) on delete cascade,
  secret_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index devices_recipient_idx on public.devices (recipient_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.recipients (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);
create index messages_recipient_created_idx on public.messages (recipient_id, created_at);

-- ---- row level security ----------------------------------------------------------

alter table public.recipients enable row level security;
alter table public.pairing_codes enable row level security;
alter table public.devices enable row level security;
alter table public.messages enable row level security;

create function public.owns_recipient(rid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.recipients r where r.id = rid and r.owner_id = (select auth.uid())
  );
$$;

create policy "senders manage their recipients" on public.recipients
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "senders see their recipients' devices" on public.devices
  for select to authenticated using (public.owns_recipient(recipient_id));

create policy "senders unpair their recipients' devices" on public.devices
  for delete to authenticated using (public.owns_recipient(recipient_id));

create policy "senders see their messages" on public.messages
  for select to authenticated using (public.owns_recipient(recipient_id));

create policy "senders send to their recipients" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.owns_recipient(recipient_id));

create policy "senders delete their messages" on public.messages
  for delete to authenticated using (public.owns_recipient(recipient_id));

-- pairing_codes: no policies; only reachable through the functions below and
-- the Edge Functions (service role).

-- ---- grants (new tables aren't exposed automatically) ------------------------------

revoke all on public.recipients, public.pairing_codes, public.devices, public.messages from anon, authenticated;

grant select, insert, update (display_name), delete on public.recipients to authenticated;
grant select (id, recipient_id, created_at, last_seen_at), delete on public.devices to authenticated;
grant select, delete on public.messages to authenticated;
grant insert (recipient_id, body) on public.messages to authenticated;

-- ---- pairing codes ----------------------------------------------------------------

-- Hash used for both pairing codes and device secrets (hex SHA-256).
create function public.sha256_hex(value text) returns text
language sql immutable set search_path = ''
as $$ select encode(extensions.digest(value, 'sha256'), 'hex'); $$;

-- New single-use code for one of the caller's recipients, e.g. "PLANT-7Q4K-M2XD".
-- Replaces any unused codes for that recipient. The hash covers only the 8
-- random characters; the app strips "PLANT", dashes and spaces before hashing.
create function public.create_pairing_code(rid uuid) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- no 0/O, 1/I/L
  bytes bytea := extensions.gen_random_bytes(8);
  raw text := '';
begin
  if not public.owns_recipient(rid) then
    raise exception 'recipient not found' using errcode = '42501';
  end if;

  for i in 0..7 loop
    raw := raw || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;

  delete from public.pairing_codes where recipient_id = rid and used_at is null;
  insert into public.pairing_codes (code_hash, recipient_id) values (public.sha256_hex(raw), rid);

  return 'PLANT-' || substr(raw, 1, 4) || '-' || substr(raw, 5, 4);
end;
$$;

revoke execute on function public.create_pairing_code(uuid) from public, anon;
grant execute on function public.create_pairing_code(uuid) to authenticated;
revoke execute on function public.owns_recipient(uuid) from public, anon;
grant execute on function public.owns_recipient(uuid) to authenticated;
