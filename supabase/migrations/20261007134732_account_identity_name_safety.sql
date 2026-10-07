create schema if not exists private;

create table if not exists public.reserved_identity_keywords (
  keyword text primary key,
  scope text not null default 'both' check (scope in ('username','display_name','both')),
  match_mode text not null default 'exact' check (match_mode in ('exact','contains')),
  reason text not null default 'reserved or inappropriate name',
  enabled boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.reserved_identity_keywords enable row level security;
revoke all on public.reserved_identity_keywords from anon, authenticated;

create or replace function private.normalize_identity_key(p_value text)
returns text
language plpgsql
stable
set search_path = pg_catalog, pg_temp
as $function$
declare
  v text;
begin
  v := lower(normalize(coalesce(p_value,''), NFKC));
  v := extensions.unaccent(v);
  v := translate(
    v,
    '0123456789@$',
    'oizeasgtbga s'
  );
  v := regexp_replace(v, '[^a-z0-9]+', '', 'g');
  return v;
end
$function$;

create or replace function private.reserved_identity_name_reason(
  p_value text,
  p_scope text
)
returns text
language plpgsql
stable
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_raw text;
  v_compact text;
  v_collapsed text;
  v_spaced text;
  v_token text;
  v_keyword public.reserved_identity_keywords%rowtype;
begin
  if coalesce(btrim(p_value),'') = '' then
    return null;
  end if;

  v_raw := lower(normalize(coalesce(p_value,''), NFKC));
  v_raw := extensions.unaccent(v_raw);
  v_raw := translate(
    v_raw,
    '0123456789@$',
    'oizeasgtbga s'
  );

  v_compact := regexp_replace(v_raw, '[^a-z0-9]+', '', 'g');
  v_collapsed := regexp_replace(v_compact, '(.)\1+', '\1', 'g');
  v_spaced := regexp_replace(v_raw, '[^a-z0-9]+', ' ', 'g');

  for v_keyword in
    select *
    from public.reserved_identity_keywords
    where enabled = true
      and (scope = 'both' or scope = p_scope)
    order by length(keyword) desc
  loop
    if v_keyword.match_mode = 'contains' then
      if v_compact like '%' || v_keyword.keyword || '%'
         or v_collapsed like '%' || v_keyword.keyword || '%'
      then
        return v_keyword.reason;
      end if;
    else
      if v_compact = v_keyword.keyword
         or v_collapsed = v_keyword.keyword
      then
        return v_keyword.reason;
      end if;

      for v_token in
        select token
        from unnest(regexp_split_to_array(btrim(v_spaced), '\s+')) as token
      loop
        if private.normalize_identity_key(v_token) = v_keyword.keyword
           or regexp_replace(private.normalize_identity_key(v_token), '(.)\1+', '\1', 'g') = v_keyword.keyword
        then
          return v_keyword.reason;
        end if;
      end loop;
    end if;
  end loop;

  return null;
end
$function$;

insert into public.reserved_identity_keywords(keyword,scope,match_mode,reason)
values
  ('admin','both','contains','reserved staff identity'),
  ('administrator','both','contains','reserved staff identity'),
  ('staff','both','contains','reserved staff identity'),
  ('support','both','contains','reserved support identity'),
  ('security','both','contains','reserved staff identity'),
  ('official','both','contains','reserved official identity'),
  ('owner','both','contains','reserved staff identity'),
  ('developer','both','contains','reserved staff identity'),
  ('system','both','contains','reserved system identity'),
  ('root','both','contains','reserved system identity'),
  ('fcmobiletools','both','contains','reserved FCMobiletools identity'),
  ('fcmobiletool','both','contains','reserved FCMobiletools identity'),
  ('fcmobile','both','contains','reserved FC Mobile identity'),
  ('fcmobiletools_official','both','contains','reserved FCMobiletools identity'),
  ('fcmobiletools_admin','both','contains','reserved FCMobiletools identity'),
  ('fc_mobile_tools','both','contains','reserved FCMobiletools identity'),
  ('tanzimfc','both','contains','reserved creator identity'),
  ('tanzimfcyt','both','contains','reserved creator identity'),
  ('tanzim','both','contains','reserved creator identity'),
  ('fuck','both','exact','inappropriate language'),
  ('fucker','both','exact','inappropriate language'),
  ('fuckers','both','exact','inappropriate language'),
  ('fucking','both','exact','inappropriate language'),
  ('fucked','both','exact','inappropriate language'),
  ('fuckface','both','exact','inappropriate language'),
  ('motherfucker','both','exact','inappropriate language'),
  ('motherfuckers','both','exact','inappropriate language'),
  ('motherfucking','both','exact','inappropriate language'),
  ('bullshit','both','exact','inappropriate language'),
  ('bullshitter','both','exact','inappropriate language'),
  ('shit','both','exact','inappropriate language'),
  ('shitty','both','exact','inappropriate language'),
  ('shitting','both','exact','inappropriate language'),
  ('dick','both','exact','inappropriate language'),
  ('dickhead','both','exact','inappropriate language'),
  ('prick','both','exact','inappropriate language'),
  ('cunt','both','exact','inappropriate language'),
  ('pussy','both','exact','inappropriate language'),
  ('bastard','both','exact','inappropriate language'),
  ('bitch','both','exact','inappropriate language'),
  ('bitches','both','exact','inappropriate language'),
  ('bitchass','both','exact','inappropriate language'),
  ('asshole','both','exact','inappropriate language'),
  ('assholes','both','exact','inappropriate language'),
  ('arsehole','both','exact','inappropriate language'),
  ('dumbass','both','exact','inappropriate language'),
  ('jackass','both','exact','inappropriate language'),
  ('smartass','both','exact','inappropriate language'),
  ('whore','both','exact','inappropriate language'),
  ('whores','both','exact','inappropriate language'),
  ('slut','both','exact','inappropriate language'),
  ('sluts','both','exact','inappropriate language'),
  ('slutty','both','exact','inappropriate language'),
  ('hoe','both','exact','inappropriate language'),
  ('nigger','both','exact','hateful slur'),
  ('niggers','both','exact','hateful slur'),
  ('nigga','both','exact','hateful slur'),
  ('niggas','both','exact','hateful slur'),
  ('niggah','both','exact','hateful slur'),
  ('niggaz','both','exact','hateful slur'),
  ('faggot','both','exact','hateful slur'),
  ('faggots','both','exact','hateful slur'),
  ('fag','both','exact','hateful slur'),
  ('fags','both','exact','hateful slur'),
  ('dyke','both','exact','hateful slur'),
  ('dykes','both','exact','hateful slur'),
  ('tranny','both','exact','hateful slur'),
  ('trannies','both','exact','hateful slur'),
  ('kike','both','exact','hateful slur'),
  ('kikes','both','exact','hateful slur'),
  ('spic','both','exact','hateful slur'),
  ('spics','both','exact','hateful slur'),
  ('chink','both','exact','hateful slur'),
  ('chinks','both','exact','hateful slur'),
  ('gook','both','exact','hateful slur'),
  ('gooks','both','exact','hateful slur'),
  ('wetback','both','exact','hateful slur'),
  ('wetbacks','both','exact','hateful slur'),
  ('beaner','both','exact','hateful slur'),
  ('beaners','both','exact','hateful slur'),
  ('coon','both','exact','hateful slur'),
  ('coons','both','exact','hateful slur'),
  ('retard','both','exact','abusive language'),
  ('retarded','both','exact','abusive language'),
  ('pedo','both','exact','sexual safety violation'),
  ('pedophile','both','exact','sexual safety violation'),
  ('pedophilia','both','exact','sexual safety violation'),
  ('rapist','both','exact','sexual safety violation'),
  ('molester','both','exact','sexual safety violation'),
  ('incest','both','exact','sexual safety violation'),
  ('kys','both','exact','self-harm abuse'),
  ('nazi','both','exact','extremist identity'),
  ('hitler','both','exact','extremist identity')
on conflict (keyword) do update
set scope=excluded.scope,
    match_mode=excluded.match_mode,
    reason=excluded.reason,
    enabled=true,
    updated_at=clock_timestamp();

create or replace function public.server_update_account_profile(
  p_account_id uuid,
  p_username text,
  p_display_name text,
  p_avatar_url text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_username text := lower(pg_catalog.btrim(coalesce(p_username,'')));
  v_name text := pg_catalog.btrim(coalesce(p_display_name,''));
  v_avatar text := nullif(pg_catalog.btrim(coalesce(p_avatar_url,'')),'');
  v_reserved text;
begin
  if v_username !~ '^[a-z0-9][a-z0-9._-]{1,22}[a-z0-9]$' then
    raise exception using errcode='22023',
      message='Username must be 3-24 characters and use lowercase letters, numbers, dots, underscores or hyphens';
  end if;

  if length(v_name)>80 then
    raise exception using errcode='22023',message='Display name is too long';
  end if;

  if v_avatar is not null and length(v_avatar)>2048 then
    raise exception using errcode='22023',message='Avatar URL is too long';
  end if;

  v_reserved := private.reserved_identity_name_reason(v_username,'username');
  if v_reserved is not null then
    raise exception using errcode='22023',
      message='That username is reserved or not allowed. Choose another username.';
  end if;

  v_reserved := private.reserved_identity_name_reason(v_name,'display_name');
  if v_reserved is not null then
    raise exception using errcode='22023',
      message='That display name is reserved or not allowed. Choose another display name.';
  end if;

  if exists(select 1 from public.accounts where username=v_username and id<>p_account_id) then
    raise exception using errcode='23505',message='Username is already taken';
  end if;

  update public.accounts
  set username=v_username,display_name=v_name,avatar_url=v_avatar
  where id=p_account_id;

  if not found then
    raise exception using errcode='22023',message='Account not found';
  end if;

  return jsonb_build_object('ok',true);
end
$function$;

revoke execute on function private.normalize_identity_key(text) from public,anon,authenticated;
revoke execute on function private.reserved_identity_name_reason(text,text) from public,anon,authenticated;
