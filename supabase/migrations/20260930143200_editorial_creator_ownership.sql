alter table public.articles add column if not exists owner_key text;
alter table public.articles add column if not exists author_key text;
alter table public.editorial_inbox add column if not exists recipient_key text;
create index if not exists idx_articles_owner_status on public.articles(owner_key,status,updated_at desc);
create index if not exists idx_editorial_inbox_recipient_key on public.editorial_inbox(recipient_key,read_at,created_at desc);
