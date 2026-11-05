-- New tables aren't exposed to the Data API roles automatically, and that
-- includes service_role, which the pair/messages Edge Functions use.
grant select, insert, update, delete
  on public.recipients, public.pairing_codes, public.devices, public.messages
  to service_role;
