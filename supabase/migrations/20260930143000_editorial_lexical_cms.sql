-- TanzimFC Editorial CMS: Supabase foundation for the Lexical article workflow.
-- Applied to the TanzimFC Supabase project before this migration file was committed.

create schema if not exists private;

create table if not exists public.editor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  bio text,
  role text not null default 'writer' check (role in ('admin','editor','writer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  excerpt text not null default '',
  description text not null default '',
  content_json jsonb not null default '{}'::jsonb,
  content_html text not null default '',
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'TanzimFC',
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','approved','scheduled','published','archived','trash')),
  category_id bigint references public.article_categories(id) on delete set null,
  tags text[] not null default '{}',
  cover_image text not null default '',
  image_alt text not null default '',
  image_caption text not null default '',
  featured boolean not null default false,
  seo_title text not null default '',
  seo_description text not null default '',
  canonical_url text not null default '',
  series text not null default '',
  reading_time integer not null default 1 check (reading_time between 1 and 180),
  published_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_saved_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_articles_status_updated on public.articles(status,updated_at desc);
create index if not exists idx_articles_author_status on public.articles(author_id,status,updated_at desc);
create index if not exists idx_articles_published_at on public.articles(published_at desc) where status='published';
create index if not exists idx_articles_category_status on public.articles(category_id,status);
create index if not exists idx_articles_tags on public.articles using gin(tags);

create table if not exists public.article_revisions (
  id bigint generated always as identity primary key,
  article_id bigint not null references public.articles(id) on delete cascade,
  revision_no integer not null,
  editor_id uuid references auth.users(id) on delete set null,
  editor_name text not null default '',
  action text not null default 'save',
  note text not null default '',
  content_json jsonb not null default '{}'::jsonb,
  content_html text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(article_id,revision_no)
);

create index if not exists idx_article_revisions_article on public.article_revisions(article_id,revision_no desc);
create table if not exists public.article_reviews (
  id bigint generated always as identity primary key,
  article_id bigint not null references public.articles(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_name text not null default '',
  status text not null check (status in ('submitted','changes_requested','approved','rejected')),
  comment text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_article_reviews_article on public.article_reviews(article_id,created_at desc);
create table if not exists public.editorial_inbox (
  id bigint generated always as identity primary key,
  recipient_id uuid references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  article_id bigint references public.articles(id) on delete cascade,
  kind text not null,
  title text not null,
  message text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_editorial_inbox_recipient on public.editorial_inbox(recipient_id,read_at,created_at desc);
create table if not exists public.article_tags (
  article_id bigint not null references public.articles(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key(article_id,tag)
);

alter table public.editor_profiles enable row level security;
alter table public.article_categories enable row level security;
alter table public.articles enable row level security;
alter table public.article_revisions enable row level security;
alter table public.article_reviews enable row level security;
alter table public.editorial_inbox enable row level security;
alter table public.article_tags enable row level security;

-- The Worker currently performs server-side authorization with its existing admin
-- session while writer authentication is being moved to Supabase Auth.
-- Public article reads are intentionally limited to published rows.
drop policy if exists editorial_public_published on public.articles;
create policy editorial_public_published on public.articles
for select to anon using (status='published');

grant select on public.articles,public.article_categories,public.article_tags to anon;
grant select,insert,update,delete on public.articles,public.article_categories,public.article_revisions,public.article_reviews,public.editorial_inbox,public.article_tags,public.editor_profiles to authenticated;
