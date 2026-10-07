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
  v := replace(v,'0','o');
  v := replace(v,'1','i');
  v := replace(v,'2','z');
  v := replace(v,'3','e');
  v := replace(v,'4','a');
  v := replace(v,'5','s');
  v := replace(v,'6','g');
  v := replace(v,'7','t');
  v := replace(v,'8','b');
  v := replace(v,'9','g');
  v := replace(v,'@','a');
  v := replace(v,'$','s');
  v := replace(v,'!','i');
  v := replace(v,'€','e');
  v := replace(v,'£','l');
  v := replace(v,'¢','c');
  return regexp_replace(v, '[^a-z0-9]+', '', 'g');
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
  v_raw := replace(v_raw,'0','o');
  v_raw := replace(v_raw,'1','i');
  v_raw := replace(v_raw,'2','z');
  v_raw := replace(v_raw,'3','e');
  v_raw := replace(v_raw,'4','a');
  v_raw := replace(v_raw,'5','s');
  v_raw := replace(v_raw,'6','g');
  v_raw := replace(v_raw,'7','t');
  v_raw := replace(v_raw,'8','b');
  v_raw := replace(v_raw,'9','g');
  v_raw := replace(v_raw,'@','a');
  v_raw := replace(v_raw,'$','s');
  v_raw := replace(v_raw,'!','i');
  v_raw := replace(v_raw,'€','e');
  v_raw := replace(v_raw,'£','l');
  v_raw := replace(v_raw,'¢','c');

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
