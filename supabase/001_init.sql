-- Foldy (폴디) — modu-publish 프로젝트에 foldy_ 접두어 표로 추가
-- 글로자 아카데미 표는 건드리지 않습니다. (2026-10-15 적용 완료 — 다시 실행할 필요 없음)
-- 로그인은 가족 아이디+비밀번호 → 세션 토큰(x-foldy-token 헤더) 방식, 모든 표는 RLS로 가족 단위 격리.

create table public.foldy_families (
  id uuid primary key default gen_random_uuid(),
  login_id text not null unique check (login_id ~ '^[a-z0-9_]{3,30}$'),
  pw_hash text not null,
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);
create table public.foldy_sessions (
  token text primary key,
  family_id uuid not null references public.foldy_families(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days'
);
create table public.foldy_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.foldy_families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  avatar int not null default 0 check (avatar between 0 and 11),
  level text not null default 'e1' check (level in ('e1','e3','e5','m','h','a')),
  daily_goal int not null default 5 check (daily_goal between 1 and 50),
  streak int not null default 0,
  best_streak int not null default 0,
  last_study date,
  created_at timestamptz not null default now()
);
create index on public.foldy_members(family_id);
create table public.foldy_words (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.foldy_members(id) on delete cascade,
  seq int not null default 0,
  word text not null check (char_length(word) between 1 and 60),
  meaning text not null check (char_length(meaning) between 1 and 120),
  accepted text[] not null default '{}',
  en_ok boolean not null default false,
  ko_ok boolean not null default false,
  sp_ok boolean not null default false,
  attempted boolean not null default false,
  wrong_modes text[] not null default '{}',
  syn jsonb,
  ant jsonb,
  syn_ok boolean not null default false,
  ant_ok boolean not null default false,
  example jsonb,
  enriched boolean not null default false,
  review_step int not null default 0,
  next_review date,
  source text not null default 'manual' check (source in ('manual','photo','recommend')),
  created_at timestamptz not null default now()
);
create unique index foldy_words_member_word on public.foldy_words(member_id, lower(word));
create table public.foldy_daily (
  member_id uuid not null references public.foldy_members(id) on delete cascade,
  day date not null,
  done int not null default 0,
  recs jsonb,
  primary key (member_id, day)
);
create table public.foldy_cache (
  word text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.foldy_family() returns uuid
language sql stable security definer set search_path = public as $$
  select s.family_id from public.foldy_sessions s
  where s.token = nullif(current_setting('request.headers', true)::json->>'x-foldy-token','')
    and s.expires_at > now()
$$;

create or replace function public.foldy_owns_member(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.foldy_members where id = m and family_id = public.foldy_family())
$$;

create or replace function public.foldy_words_seq() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce(max(seq),0)+1 into new.seq from public.foldy_words where member_id = new.member_id;
  return new;
end $$;
create trigger foldy_words_seq before insert on public.foldy_words for each row execute function public.foldy_words_seq();

alter table public.foldy_families enable row level security;
alter table public.foldy_sessions enable row level security;
alter table public.foldy_members enable row level security;
alter table public.foldy_words enable row level security;
alter table public.foldy_daily enable row level security;
alter table public.foldy_cache enable row level security;

create policy foldy_families_sel on public.foldy_families for select using (id = public.foldy_family());
create policy foldy_members_all on public.foldy_members for all using (family_id = public.foldy_family()) with check (family_id = public.foldy_family());
create policy foldy_words_all on public.foldy_words for all using (public.foldy_owns_member(member_id)) with check (public.foldy_owns_member(member_id));
create policy foldy_daily_all on public.foldy_daily for all using (public.foldy_owns_member(member_id)) with check (public.foldy_owns_member(member_id));
create policy foldy_cache_sel on public.foldy_cache for select using (public.foldy_family() is not null);
create policy foldy_cache_ins on public.foldy_cache for insert with check (public.foldy_family() is not null);
create policy foldy_cache_upd on public.foldy_cache for update using (public.foldy_family() is not null);

create or replace function public.foldy_signup(p_login text, p_password text, p_name text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare fid uuid; tok text;
begin
  if char_length(coalesce(p_password,'')) < 4 then raise exception 'PASSWORD_SHORT'; end if;
  if exists(select 1 from foldy_families where login_id = lower(trim(p_login))) then raise exception 'LOGIN_TAKEN'; end if;
  insert into foldy_families(login_id, pw_hash, name) values (lower(trim(p_login)), crypt(p_password, gen_salt('bf')), trim(p_name)) returning id into fid;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into foldy_sessions(token, family_id) values (tok, fid);
  return json_build_object('token', tok, 'family_id', fid, 'name', trim(p_name));
end $$;

create or replace function public.foldy_login(p_login text, p_password text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare f foldy_families; tok text;
begin
  select * into f from foldy_families where login_id = lower(trim(p_login));
  if f.id is null or f.pw_hash <> crypt(p_password, f.pw_hash) then raise exception 'LOGIN_FAILED'; end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into foldy_sessions(token, family_id) values (tok, f.id);
  return json_build_object('token', tok, 'family_id', f.id, 'name', f.name);
end $$;

create or replace function public.foldy_logout() returns void
language sql security definer set search_path = public as $$
  update public.foldy_sessions set expires_at = now() where token = current_setting('request.headers', true)::json->>'x-foldy-token'
$$;

revoke all on function public.foldy_signup(text,text,text) from public;
revoke all on function public.foldy_login(text,text) from public;
grant execute on function public.foldy_signup(text,text,text) to anon, authenticated;
grant execute on function public.foldy_login(text,text) to anon, authenticated;
grant execute on function public.foldy_logout() to anon, authenticated;
grant execute on function public.foldy_family() to anon, authenticated;
grant execute on function public.foldy_owns_member(uuid) to anon, authenticated;
grant select on public.foldy_families to anon, authenticated;
grant select, insert, update, delete on public.foldy_members, public.foldy_words, public.foldy_daily to anon, authenticated;
grant select, insert, update on public.foldy_cache to anon, authenticated;
