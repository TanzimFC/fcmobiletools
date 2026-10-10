-- =====================================================================
-- FC Mobile Tools — FIND A LEAGUE
-- Run ONCE in Supabase Dashboard → SQL Editor. Safe to re-run.
-- All objects are prefixed fl_ so they never clash with your other tables.
-- =====================================================================

-- ---------- ADMINS ----------------------------------------------------
create table if not exists public.fl_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.fl_admins enable row level security;

create or replace function public.fl_is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.fl_admins where user_id = auth.uid()) $$;

drop policy if exists fl_admins_self on public.fl_admins;
create policy fl_admins_self on public.fl_admins for select to authenticated
  using (user_id = auth.uid());

-- ---------- PLAYER CARDS (profiles) ----------------------------------
create table if not exists public.fl_profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  ign            text not null check (char_length(ign) between 2 and 24),
  uid            text not null check (uid ~ '^[A-Za-z0-9_-]{3,32}$'),
  discord        text not null check (char_length(discord) between 2 and 40),
  ovr            int  not null check (ovr between 1 and 200),
  region         text not null check (region in ('asia','mena','europe','africa','north_america','latin_america','oceania')),
  language       text not null check (language in ('english','arabic','spanish','portuguese','turkish','hindi','bengali','indonesian','french','other')),
  play_style     text not null default 'casual' check (play_style in ('casual','grinder','competitive')),
  status         text not null default 'looking' check (status in ('looking','in_league','owner')),
  open_to_offers boolean not null default true,
  bio            text not null default '' check (char_length(bio) <= 200),
  avatar_url     text check (avatar_url is null or avatar_url ~ '^https://i\.ibb\.co(\.com)?/[A-Za-z0-9_./~%+-]{3,250}$'),
  active_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists fl_profiles_uid_uq on public.fl_profiles (lower(uid));
create index if not exists fl_profiles_market_idx on public.fl_profiles (status, open_to_offers, active_at desc);

-- ---------- LEAGUES ---------------------------------------------------
create table if not exists public.fl_leagues (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null unique references auth.users(id) on delete cascade,
  name             text not null check (char_length(name) between 3 and 32),
  tag              text check (tag is null or char_length(tag) between 2 and 6),
  description      text not null default '' check (char_length(description) <= 600),
  logo_url         text check (logo_url   is null or logo_url   ~ '^https://i\.ibb\.co(\.com)?/[A-Za-z0-9_./~%+-]{3,250}$'),
  banner_url       text check (banner_url is null or banner_url ~ '^https://i\.ibb\.co(\.com)?/[A-Za-z0-9_./~%+-]{3,250}$'),
  discord_url      text not null check (discord_url ~ '^https://(www\.)?(discord\.gg|discord\.com/invite)/[A-Za-z0-9-]{2,40}/?$'),
  region           text not null check (region in ('asia','mena','europe','africa','north_america','latin_america','oceania')),
  language         text not null check (language in ('english','arabic','spanish','portuguese','turkish','hindi','bengali','indonesian','french','other')),
  capacity         int  not null default 30 check (capacity between 5 and 100),
  members_in_game  int  not null default 1  check (members_in_game >= 0),
  min_ovr          int  not null default 0  check (min_ovr between 0 and 200),
  tourneys_per_week int not null default 0  check (tourneys_per_week between 0 and 14),
  tourney_min_size int  not null default 4  check (tourney_min_size between 4 and 32),
  tourney_max_size int  not null default 32 check (tourney_max_size between 4 and 32),
  vibes            text[] not null default '{}'
                   check (cardinality(vibes) <= 4 and vibes <@ array['quest_grinders','daily_tourneys','competitive','chill','beginner','discord_active','f2p']::text[]),
  recruiting       boolean not null default true,
  status           text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  reject_reason    text,
  kicked_off_at    timestamptz,                 -- last Kickoff (null until first one)
  kickoff_count    int not null default 0,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (tourney_min_size <= tourney_max_size),
  check (members_in_game <= capacity)
);
create unique index if not exists fl_leagues_name_uq on public.fl_leagues (lower(name));
create index if not exists fl_leagues_rank_idx on public.fl_leagues (status, kicked_off_at desc nulls last);

-- ---------- MEMBERSHIP / APPLICATIONS / APPROACHES -------------------
create table if not exists public.fl_members (
  user_id   uuid primary key references auth.users(id) on delete cascade,   -- one league per player
  league_id uuid not null references public.fl_leagues(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now()
);
create index if not exists fl_members_league_idx on public.fl_members (league_id);

create table if not exists public.fl_applications (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.fl_leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  message    text not null default '' check (char_length(message) <= 300),
  status     text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);
create index if not exists fl_applications_user_idx on public.fl_applications (user_id, status);

create table if not exists public.fl_approaches (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.fl_leagues(id) on delete cascade,
  player_id  uuid not null references auth.users(id) on delete cascade,
  message    text not null default '' check (char_length(message) <= 300),
  status     text not null default 'sent' check (status in ('sent','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (league_id, player_id)
);
create index if not exists fl_approaches_player_idx on public.fl_approaches (player_id, status);
create index if not exists fl_approaches_day_idx on public.fl_approaches (league_id, created_at);

-- ---------- ACTIVITY LOGS --------------------------------------------
create table if not exists public.fl_kickoffs (
  id        bigint generated always as identity primary key,
  league_id uuid not null references public.fl_leagues(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  at        timestamptz not null default now()
);
create index if not exists fl_kickoffs_league_idx on public.fl_kickoffs (league_id, at desc);

create table if not exists public.fl_checkins (          -- "Pulse": member says league is active (1 / 24h)
  user_id   uuid primary key references auth.users(id) on delete cascade,
  league_id uuid not null references public.fl_leagues(id) on delete cascade,
  at        timestamptz not null default now()
);
create index if not exists fl_checkins_league_idx on public.fl_checkins (league_id, at desc);

create table if not exists public.fl_tourney_logs (      -- "Matchday log": owner logs a tournament (1 / day)
  league_id uuid not null references public.fl_leagues(id) on delete cascade,
  day       date not null,
  size      int  not null check (size between 4 and 32),
  primary key (league_id, day)
);

-- ---------- TRIGGERS --------------------------------------------------
create or replace function public.fl_t_touch() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists fl_profiles_touch on public.fl_profiles;
create trigger fl_profiles_touch before update on public.fl_profiles
  for each row execute function public.fl_t_touch();
drop trigger if exists fl_leagues_touch on public.fl_leagues;
create trigger fl_leagues_touch before update on public.fl_leagues
  for each row execute function public.fl_t_touch();

create or replace function public.fl_t_league_bi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from fl_profiles where user_id = new.owner_id) then raise exception 'NEED_PROFILE'; end if;
  if exists (select 1 from fl_members where user_id = new.owner_id) then raise exception 'ALREADY_IN_LEAGUE'; end if;
  new.status := 'pending'; new.kicked_off_at := null; new.kickoff_count := 0;
  new.approved_at := null; new.reject_reason := null;
  return new;
end $$;
drop trigger if exists fl_leagues_bi on public.fl_leagues;
create trigger fl_leagues_bi before insert on public.fl_leagues
  for each row execute function public.fl_t_league_bi();

create or replace function public.fl_t_league_ai() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into fl_members (user_id, league_id, role) values (new.owner_id, new.id, 'owner');
  update fl_profiles set status = 'owner' where user_id = new.owner_id;
  return new;
end $$;
drop trigger if exists fl_leagues_ai on public.fl_leagues;
create trigger fl_leagues_ai after insert on public.fl_leagues
  for each row execute function public.fl_t_league_ai();

create or replace function public.fl_t_league_bd() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update fl_profiles set status = 'looking'
   where user_id in (select user_id from fl_members where league_id = old.id);
  return old;
end $$;
drop trigger if exists fl_leagues_bd on public.fl_leagues;
create trigger fl_leagues_bd before delete on public.fl_leagues
  for each row execute function public.fl_t_league_bd();

-- ---------- PUBLIC LEAGUE CARD VIEW ----------------------------------
-- Only approved leagues. Runs with owner rights so it can count rows safely.
drop view if exists public.fl_league_cards;
create view public.fl_league_cards as
select
  l.id, l.name, l.tag, l.description, l.logo_url, l.banner_url, l.discord_url,
  l.region, l.language, l.capacity, l.members_in_game,
  greatest(l.capacity - l.members_in_game, 0) as spots_open,
  l.min_ovr, l.tourneys_per_week, l.tourney_min_size, l.tourney_max_size,
  l.vibes, l.recruiting,
  l.kicked_off_at as last_kickoff_at,
  coalesce(l.kicked_off_at, l.approved_at, l.created_at) as kicked_off_at,
  l.kickoff_count, l.created_at, l.approved_at,
  (select count(*) from fl_members m where m.league_id = l.id)                                  as site_members,
  (select count(*) from fl_checkins c where c.league_id = l.id and c.at > now() - interval '24 hours') as pulse_24h,
  (select count(*) from fl_tourney_logs t where t.league_id = l.id and t.day > current_date - 7)       as matchdays_7d,
  p.ign as owner_ign
from fl_leagues l
left join fl_profiles p on p.user_id = l.owner_id
where l.status = 'approved';

-- ---------- ROW LEVEL SECURITY ---------------------------------------
alter table public.fl_profiles     enable row level security;
alter table public.fl_leagues      enable row level security;
alter table public.fl_members      enable row level security;
alter table public.fl_applications enable row level security;
alter table public.fl_approaches   enable row level security;
alter table public.fl_kickoffs     enable row level security;
alter table public.fl_checkins     enable row level security;
alter table public.fl_tourney_logs enable row level security;

-- table privileges: nobody anonymous, signed-in users get only what they need
revoke all on public.fl_admins, public.fl_profiles, public.fl_leagues, public.fl_members,
              public.fl_applications, public.fl_approaches, public.fl_kickoffs,
              public.fl_checkins, public.fl_tourney_logs, public.fl_league_cards
  from anon, authenticated;

grant select on public.fl_admins, public.fl_members, public.fl_applications,
                public.fl_approaches, public.fl_kickoffs, public.fl_league_cards to authenticated;
grant select, delete on public.fl_leagues to authenticated;
grant select on public.fl_profiles to authenticated;

grant insert (user_id, ign, uid, discord, ovr, region, language, play_style, status, open_to_offers, bio, avatar_url)
  on public.fl_profiles to authenticated;
grant update (ign, uid, discord, ovr, region, language, play_style, status, open_to_offers, bio, avatar_url)
  on public.fl_profiles to authenticated;

grant insert (owner_id, name, tag, description, logo_url, banner_url, discord_url, region, language, capacity,
              members_in_game, min_ovr, tourneys_per_week, tourney_min_size, tourney_max_size, vibes, recruiting)
  on public.fl_leagues to authenticated;
grant update (name, tag, description, logo_url, banner_url, discord_url, region, language, capacity,
              members_in_game, min_ovr, tourneys_per_week, tourney_min_size, tourney_max_size, vibes, recruiting)
  on public.fl_leagues to authenticated;

-- profiles: you see only your own card (admins see all). Others only via safe RPCs.
drop policy if exists fl_profiles_sel on public.fl_profiles;
create policy fl_profiles_sel on public.fl_profiles for select to authenticated
  using (user_id = auth.uid() or public.fl_is_admin());
drop policy if exists fl_profiles_ins on public.fl_profiles;
create policy fl_profiles_ins on public.fl_profiles for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists fl_profiles_upd on public.fl_profiles;
create policy fl_profiles_upd on public.fl_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- leagues: owner + admin read raw rows; everybody else uses fl_league_cards
drop policy if exists fl_leagues_sel on public.fl_leagues;
create policy fl_leagues_sel on public.fl_leagues for select to authenticated
  using (owner_id = auth.uid() or public.fl_is_admin());
drop policy if exists fl_leagues_ins on public.fl_leagues;
create policy fl_leagues_ins on public.fl_leagues for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists fl_leagues_upd on public.fl_leagues;
create policy fl_leagues_upd on public.fl_leagues for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists fl_leagues_del on public.fl_leagues;
create policy fl_leagues_del on public.fl_leagues for delete to authenticated
  using (owner_id = auth.uid() or public.fl_is_admin());

drop policy if exists fl_members_sel on public.fl_members;
create policy fl_members_sel on public.fl_members for select to authenticated
  using (user_id = auth.uid() or public.fl_is_admin()
         or league_id in (select id from public.fl_leagues where owner_id = auth.uid()));

drop policy if exists fl_apps_sel on public.fl_applications;
create policy fl_apps_sel on public.fl_applications for select to authenticated
  using (user_id = auth.uid() or public.fl_is_admin()
         or league_id in (select id from public.fl_leagues where owner_id = auth.uid()));

drop policy if exists fl_appr_sel on public.fl_approaches;
create policy fl_appr_sel on public.fl_approaches for select to authenticated
  using (player_id = auth.uid() or public.fl_is_admin()
         or league_id in (select id from public.fl_leagues where owner_id = auth.uid()));

drop policy if exists fl_kick_sel on public.fl_kickoffs;
create policy fl_kick_sel on public.fl_kickoffs for select to authenticated
  using (public.fl_is_admin());

-- ---------- INTERNAL HELPERS (not callable from the browser) ---------
create or replace function public.fl_i_join(p_league uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from fl_members where user_id = p_user) then return false; end if;
  insert into fl_members (user_id, league_id, role) values (p_user, p_league, 'member');
  update fl_profiles set status = 'in_league' where user_id = p_user and status <> 'owner';
  update fl_leagues set members_in_game = least(capacity, members_in_game + 1) where id = p_league;
  update fl_applications set status = 'declined' where user_id = p_user and status = 'pending';
  update fl_approaches   set status = 'declined' where player_id = p_user and status = 'sent';
  return true;
end $$;

create or replace function public.fl_i_leave(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_league uuid;
begin
  select league_id into v_league from fl_members where user_id = p_user and role = 'member';
  if v_league is null then return; end if;
  delete from fl_members  where user_id = p_user;
  delete from fl_checkins where user_id = p_user;
  update fl_profiles set status = 'looking' where user_id = p_user and status = 'in_league';
  update fl_leagues set members_in_game = greatest(0, members_in_game - 1) where id = v_league;
end $$;

-- ---------- PLAYER-FACING RPCs ---------------------------------------
create or replace function public.fl_touch() returns void
language plpgsql security definer set search_path = public as $$
begin
  update fl_profiles set active_at = now()
   where user_id = auth.uid() and active_at < now() - interval '10 minutes';
end $$;

create or replace function public.fl_league_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_card jsonb;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  select to_jsonb(c) into v_card from fl_league_cards c where c.id = p_id;
  if v_card is null then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object(
    'league', v_card,
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'ign', p.ign, 'ovr', p.ovr,
                       'avatar_url', p.avatar_url, 'role', m.role)
                       order by (m.role = 'owner') desc, m.joined_at)
        from fl_members m join fl_profiles p on p.user_id = m.user_id where m.league_id = p_id), '[]'::jsonb),
    'kickoffs', coalesce((
      select jsonb_agg(x order by (x->>'at') desc) from (
        select jsonb_build_object('ign', p.ign, 'at', k.at) as x
          from fl_kickoffs k join fl_profiles p on p.user_id = k.user_id
         where k.league_id = p_id order by k.at desc limit 5) s), '[]'::jsonb),
    'matchdays', coalesce((
      select jsonb_agg(jsonb_build_object('day', t.day, 'size', t.size) order by t.day desc)
        from fl_tourney_logs t where t.league_id = p_id and t.day > current_date - 14), '[]'::jsonb),
    'my', jsonb_build_object(
      'member_of',   (select m.league_id from fl_members m where m.user_id = v_uid),
      'application', (select jsonb_build_object('id', a.id, 'status', a.status)
                        from fl_applications a where a.league_id = p_id and a.user_id = v_uid),
      'last_pulse',  (select c.at from fl_checkins c where c.user_id = v_uid and c.league_id = p_id)
    )
  );
end $$;

-- KICKOFF: any member of the league can lift it to the top, once every 6h per league.
create or replace function public.fl_kickoff(p_league uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_last timestamptz; v_status text; v_left int;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  if not exists (select 1 from fl_members where user_id = v_uid and league_id = p_league) then
    raise exception 'NOT_MEMBER'; end if;
  select kicked_off_at, status into v_last, v_status from fl_leagues where id = p_league for update;
  if v_status is distinct from 'approved' then raise exception 'FORBIDDEN'; end if;
  if v_last is not null and v_last + interval '6 hours' > now() then
    v_left := ceil(extract(epoch from (v_last + interval '6 hours' - now())));
    raise exception 'COOLDOWN:%', v_left;
  end if;
  update fl_leagues set kicked_off_at = now(), kickoff_count = kickoff_count + 1 where id = p_league;
  insert into fl_kickoffs (league_id, user_id) values (p_league, v_uid);
  update fl_profiles set active_at = now() where user_id = v_uid;
  return now();
end $$;

-- PULSE: a member confirms "this league is active", once every 24h.
create or replace function public.fl_pulse() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_league uuid; v_last timestamptz; v_left int;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  select m.league_id into v_league from fl_members m join fl_leagues l on l.id = m.league_id
   where m.user_id = v_uid and l.status = 'approved';
  if v_league is null then raise exception 'NOT_MEMBER'; end if;
  select at into v_last from fl_checkins where user_id = v_uid;
  if v_last is not null and v_last + interval '24 hours' > now() then
    v_left := ceil(extract(epoch from (v_last + interval '24 hours' - now())));
    raise exception 'COOLDOWN:%', v_left;
  end if;
  insert into fl_checkins (user_id, league_id, at) values (v_uid, v_league, now())
  on conflict (user_id) do update set league_id = excluded.league_id, at = excluded.at;
  update fl_profiles set active_at = now() where user_id = v_uid;
  return now();
end $$;

create or replace function public.fl_apply(p_league uuid, p_message text default '') returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_status text; v_rec boolean; v_old text;
begin
  if v_uid is null then raise exception 'AUTH'; end if;
  if not exists (select 1 from fl_profiles where user_id = v_uid) then raise exception 'NEED_PROFILE'; end if;
  if exists (select 1 from fl_members where user_id = v_uid) then raise exception 'ALREADY_IN_LEAGUE'; end if;
  select status, recruiting into v_status, v_rec from fl_leagues where id = p_league;
  if v_status is distinct from 'approved' then raise exception 'NOT_FOUND'; end if;
  if not v_rec then raise exception 'NOT_RECRUITING'; end if;
  select status into v_old from fl_applications where league_id = p_league and user_id = v_uid;
  if v_old = 'pending' then raise exception 'ALREADY_APPLIED'; end if;
  if (select count(*) from fl_applications where user_id = v_uid and status = 'pending') >= 5 then
    raise exception 'TOO_MANY_APPS'; end if;
  insert into fl_applications (league_id, user_id, message, status)
  values (p_league, v_uid, left(coalesce(p_message, ''), 300), 'pending')
  on conflict (league_id, user_id) do update
    set message = excluded.message, status = 'pending', created_at = now();
end $$;

create or replace function public.fl_withdraw_application(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update fl_applications set status = 'withdrawn'
   where id = p_id and user_id = auth.uid() and status = 'pending';
end $$;

create or replace function public.fl_respond_approach(p_id uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); a fl_approaches; v_status text;
begin
  select * into a from fl_approaches where id = p_id and player_id = v_uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if a.status <> 'sent' then raise exception 'NOT_PENDING'; end if;
  if not p_accept then update fl_approaches set status = 'declined' where id = p_id; return 'declined'; end if;
  select status into v_status from fl_leagues where id = a.league_id;
  if v_status is distinct from 'approved' then raise exception 'NOT_FOUND'; end if;
  if not public.fl_i_join(a.league_id, v_uid) then
    update fl_approaches set status = 'declined' where id = p_id;
    return 'already_in_league';
  end if;
  update fl_approaches set status = 'accepted' where id = p_id;
  return 'accepted';
end $$;

create or replace function public.fl_leave_league() returns void
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from fl_members where user_id = auth.uid();
  if v_role is null then raise exception 'NOT_MEMBER'; end if;
  if v_role = 'owner' then raise exception 'OWNER_CANNOT_LEAVE'; end if;
  perform public.fl_i_leave(auth.uid());
end $$;

-- ---------- OWNER RPCs -----------------------------------------------
create or replace function public.fl_remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from fl_leagues l join fl_members m on m.league_id = l.id
                  where l.owner_id = auth.uid() and m.user_id = p_user and m.role = 'member') then
    raise exception 'FORBIDDEN'; end if;
  perform public.fl_i_leave(p_user);
end $$;

create or replace function public.fl_review_application(p_id uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare a fl_applications; v_owner uuid; v_status text;
begin
  select * into a from fl_applications where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select owner_id, status into v_owner, v_status from fl_leagues where id = a.league_id;
  if v_owner is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if a.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  if not p_accept then update fl_applications set status = 'declined' where id = p_id; return 'declined'; end if;
  if v_status <> 'approved' then raise exception 'FORBIDDEN'; end if;
  if not public.fl_i_join(a.league_id, a.user_id) then
    update fl_applications set status = 'declined' where id = p_id;
    return 'player_in_league';
  end if;
  update fl_applications set status = 'accepted' where id = p_id;
  return 'accepted';
end $$;

create or replace function public.fl_league_inbox() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_league uuid;
begin
  select id into v_league from fl_leagues where owner_id = auth.uid() and status = 'approved';
  if v_league is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'message', a.message, 'created_at', a.created_at,
             'user_id', p.user_id, 'ign', p.ign, 'uid', p.uid, 'discord', p.discord, 'ovr', p.ovr,
             'region', p.region, 'language', p.language, 'play_style', p.play_style,
             'avatar_url', p.avatar_url, 'bio', p.bio) order by a.created_at)
      from fl_applications a join fl_profiles p on p.user_id = a.user_id
     where a.league_id = v_league and a.status = 'pending'), '[]'::jsonb);
end $$;

create or replace function public.fl_log_matchday(p_size int) returns void
language plpgsql security definer set search_path = public as $$
declare v_league uuid;
begin
  select id into v_league from fl_leagues where owner_id = auth.uid() and status = 'approved';
  if v_league is null then raise exception 'NOT_APPROVED_OWNER'; end if;
  if p_size is null or p_size < 4 or p_size > 32 then raise exception 'Tournament size must be 4–32.'; end if;
  insert into fl_tourney_logs (league_id, day, size) values (v_league, current_date, p_size)
  on conflict (league_id, day) do update set size = excluded.size;
end $$;

create or replace function public.fl_resubmit_league() returns void
language plpgsql security definer set search_path = public as $$
begin
  update fl_leagues set status = 'pending', reject_reason = null
   where owner_id = auth.uid() and status = 'rejected';
end $$;

-- ---------- SCOUT ROOM (owners find players) -------------------------
-- 3 approaches per day per league, resets 00:00 UTC. Contacts are only revealed on approach.
create or replace function public.fl_scout_quota() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_league uuid; v_used int;
begin
  select id into v_league from fl_leagues where owner_id = auth.uid() and status = 'approved';
  if v_league is null then return jsonb_build_object('used', 0, 'limit', 3, 'eligible', false); end if;
  select count(*) into v_used from fl_approaches
   where league_id = v_league and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  return jsonb_build_object('used', v_used, 'limit', 3, 'eligible', true);
end $$;

create or replace function public.fl_scout_market(
  p_region text default null, p_min_ovr int default null, p_max_ovr int default null,
  p_style text default null, p_limit int default 24, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_league uuid;
begin
  select id into v_league from fl_leagues where owner_id = v_uid and status = 'approved';
  if v_league is null then raise exception 'NOT_APPROVED_OWNER'; end if;
  return coalesce((
    select jsonb_agg(r.j order by r.ts desc) from (
      select p.active_at as ts,
             jsonb_build_object('user_id', p.user_id, 'ign', p.ign, 'ovr', p.ovr, 'region', p.region,
               'language', p.language, 'play_style', p.play_style, 'bio', p.bio,
               'avatar_url', p.avatar_url, 'active_at', p.active_at,
               'approached', exists (select 1 from fl_approaches a where a.league_id = v_league and a.player_id = p.user_id)) as j
        from fl_profiles p
       where p.status = 'looking' and p.open_to_offers and p.user_id <> v_uid
         and not exists (select 1 from fl_members m where m.user_id = p.user_id)
         and (p_region  is null or p.region = p_region)
         and (p_min_ovr is null or p.ovr >= p_min_ovr)
         and (p_max_ovr is null or p.ovr <= p_max_ovr)
         and (p_style   is null or p.play_style = p_style)
       order by p.active_at desc
       limit least(greatest(coalesce(p_limit, 24), 1), 50) offset greatest(coalesce(p_offset, 0), 0)) r), '[]'::jsonb);
end $$;

create or replace function public.fl_scout_approach(p_player uuid, p_message text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_league uuid; v_used int; p fl_profiles;
begin
  select id into v_league from fl_leagues where owner_id = v_uid and status = 'approved';
  if v_league is null then raise exception 'NOT_APPROVED_OWNER'; end if;
  select count(*) into v_used from fl_approaches
   where league_id = v_league and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if v_used >= 3 then raise exception 'DAILY_LIMIT'; end if;
  select * into p from fl_profiles where user_id = p_player;
  if not found or p.status <> 'looking' or not p.open_to_offers
     or exists (select 1 from fl_members where user_id = p_player) then
    raise exception 'PLAYER_UNAVAILABLE'; end if;
  begin
    insert into fl_approaches (league_id, player_id, message) values (v_league, p_player, left(coalesce(p_message, ''), 300));
  exception when unique_violation then raise exception 'ALREADY_APPROACHED';
  end;
  return jsonb_build_object('remaining', 3 - v_used - 1,
                            'player', jsonb_build_object('ign', p.ign, 'uid', p.uid, 'discord', p.discord));
end $$;

create or replace function public.fl_scout_sent() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_league uuid;
begin
  select id into v_league from fl_leagues where owner_id = auth.uid() and status = 'approved';
  if v_league is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'status', a.status, 'message', a.message, 'created_at', a.created_at,
             'user_id', p.user_id, 'ign', p.ign, 'uid', p.uid, 'discord', p.discord, 'ovr', p.ovr,
             'region', p.region, 'avatar_url', p.avatar_url) order by a.created_at desc)
      from (select * from fl_approaches where league_id = v_league order by created_at desc limit 50) a
      join fl_profiles p on p.user_id = a.player_id), '[]'::jsonb);
end $$;

-- ---------- ADMIN ------------------------------------------------------
create or replace function public.fl_admin_review(p_league uuid, p_status text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.fl_is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('pending','approved','rejected','suspended') then raise exception 'FORBIDDEN'; end if;
  update fl_leagues set
    status = p_status,
    reject_reason = case when p_status in ('rejected','suspended') then nullif(left(coalesce(p_reason, ''), 300), '') else null end,
    approved_at = case when p_status = 'approved' then coalesce(approved_at, now()) else approved_at end
  where id = p_league;
end $$;

-- ---------- LOCK DOWN FUNCTION ACCESS --------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'fl\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    if r.proname !~ '^fl_(t|i)_' then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
