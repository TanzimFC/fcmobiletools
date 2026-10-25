-- Editorial Studio v2
--
-- Goals: instant editorial workflow (drafts, review, inbox) with no site rebuild, safe concurrent
-- editing, a real publish pipeline to GitHub, and a hard cap on Supabase egress and storage.
--
-- Safe to run more than once. Existing articles keep working: doc_version 1 rows are the old
-- Lexical HTML and are converted to blocks the first time they are opened in the new editor.

/* ---------------------------------------------------------------- articles */
alter table public.articles add column if not exists doc_version integer not null default 1;
alter table public.articles add column if not exists version integer not null default 1;          -- optimistic lock
alter table public.articles add column if not exists content_hash text not null default '';
alter table public.articles add column if not exists word_count integer not null default 0;
alter table public.articles add column if not exists brief text not null default '';              -- assignment brief
alter table public.articles add column if not exists due_at timestamptz;
alter table public.articles add column if not exists assigned_by text;
alter table public.articles add column if not exists submitted_at timestamptz;
alter table public.articles add column if not exists review_note text not null default '';
alter table public.articles add column if not exists reviewed_by text;
alter table public.articles add column if not exists editing_by text;                             -- soft edit lock
alter table public.articles add column if not exists editing_at timestamptz;
alter table public.articles add column if not exists published_version integer;                   -- version that is live
alter table public.articles add column if not exists published_commit text;
alter table public.articles add column if not exists published_file_sha text;
alter table public.articles add column if not exists deploy_state text not null default 'none';
alter table public.articles add column if not exists deployed_at timestamptz;
alter table public.articles add column if not exists deploy_error text not null default '';
alter table public.articles add column if not exists last_revision_at timestamptz;

alter table public.articles drop constraint if exists articles_deploy_state_check;
alter table public.articles add constraint articles_deploy_state_check
  check (deploy_state in ('none','building','live','failed'));

-- The list screens never read the body, so keep list queries off the large columns and fast.
create index if not exists idx_articles_updated on public.articles(updated_at desc);
create index if not exists idx_articles_review_queue on public.articles(submitted_at) where status = 'in_review';
create index if not exists idx_articles_due on public.articles(due_at) where due_at is not null and status in ('draft','changes_requested');
create index if not exists idx_articles_scheduled on public.articles(scheduled_for) where status = 'scheduled';

/* -------------------------------------------------------------- revisions */
-- Autosaves no longer write a revision each time. Milestones (submit, approve, publish, restore) are kept;
-- timed autosave snapshots are pruned by the API to the newest 30 per article.
alter table public.article_revisions add column if not exists content_hash text not null default '';
create index if not exists idx_article_revisions_kind on public.article_revisions(article_id, action, id desc);

/* --------------------------------------------------------------- comments */
create table if not exists public.article_comments (
  id bigint generated always as identity primary key,
  article_id bigint not null references public.articles(id) on delete cascade,
  block_id text,
  author_key text not null,
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 2000),
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_article_comments_article on public.article_comments(article_id, created_at);
alter table public.article_comments enable row level security;

/* --------------------------------------------------------------- settings */
create table if not exists public.editorial_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.editorial_settings enable row level security;

/* ------------------------------------------------------------------ inbox */
alter table public.editorial_inbox add column if not exists recipient_key text;
create index if not exists idx_editorial_inbox_unread on public.editorial_inbox(recipient_key, created_at desc) where read_at is null;

/* --------------------------------------------------------------- security */
-- The publishable (anon) key is public: it ships in the site source. Anyone holding it could page through
-- every article body and burn the free Supabase egress allowance. The public site is now fully static
-- (articles are committed to GitHub on publish), so nothing public needs to read these tables at all.
drop policy if exists editorial_public_published on public.articles;
revoke all on public.articles from anon;
revoke all on public.article_categories from anon;
revoke all on public.article_tags from anon;

-- Everything editorial goes through the Worker with the service key. Nothing is granted to browsers.
revoke all on public.article_revisions, public.article_reviews, public.editorial_inbox, public.editor_profiles,
  public.article_comments, public.editorial_settings from anon, authenticated;
revoke all on public.articles, public.article_categories, public.article_tags from authenticated;
