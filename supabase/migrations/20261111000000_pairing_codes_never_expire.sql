-- Pairing codes no longer expire. They're still single-use, and making a new
-- code for a recipient cancels any unused one.
alter table public.pairing_codes alter column expires_at set default 'infinity';
update public.pairing_codes set expires_at = 'infinity' where used_at is null;
