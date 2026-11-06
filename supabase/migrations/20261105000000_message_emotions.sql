-- Messages can carry an emotion the plant acts out, with or without text.
-- Keep this list in sync with app/src/lib/emotions.ts and sender/src/emotions.ts.

alter table public.messages
  add column mood text check (mood in ('love', 'proud', 'luck', 'break', 'celebrate', 'angry'));

alter table public.messages drop constraint messages_body_check;
alter table public.messages alter column body set default '';
alter table public.messages
  add constraint messages_content_check
  check (char_length(body) <= 500 and (char_length(btrim(body)) > 0 or mood is not null));

grant insert (mood) on public.messages to authenticated;
