-- 로그인 실패 10회/15분 잠금 (2026-10-15 적용 완료)
create table if not exists public.foldy_login_fails (
  login_id text not null,
  at timestamptz not null default now()
);
create index if not exists foldy_login_fails_idx on public.foldy_login_fails(login_id, at);
alter table public.foldy_login_fails enable row level security;

-- 실패를 기록해야 하므로 예외 대신 {"error": ...} 를 돌려줌
create or replace function public.foldy_login(p_login text, p_password text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare f foldy_families; tok text; lid text := lower(trim(coalesce(p_login,''))); fails int;
begin
  select count(*) into fails from foldy_login_fails where login_id = lid and at > now() - interval '15 minutes';
  if fails >= 10 then return json_build_object('error', 'LOGIN_LOCKED'); end if;
  select * into f from foldy_families where login_id = lid;
  if f.id is null or f.pw_hash <> crypt(coalesce(p_password,''), f.pw_hash) then
    insert into foldy_login_fails(login_id) values (lid);
    return json_build_object('error', 'LOGIN_FAILED');
  end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into foldy_sessions(token, family_id) values (tok, f.id);
  return json_build_object('token', tok, 'family_id', f.id, 'name', f.name);
end $$;
grant execute on function public.foldy_login(text,text) to anon, authenticated;
