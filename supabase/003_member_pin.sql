-- 구성원별 비밀번호(PIN): 내 단어장은 나만 고치고, 가족은 학습현황만 보기 (2026-10-16 적용 완료)
alter table public.foldy_members add column if not exists pin_hash text;
alter table public.foldy_members add column if not exists has_pin boolean not null default false;

create table if not exists public.foldy_member_sessions (
  token text primary key,
  member_id uuid not null references public.foldy_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days'
);
alter table public.foldy_member_sessions enable row level security;

-- x-foldy-member 헤더 → 잠금 해제된 구성원
create or replace function public.foldy_member() returns uuid
language sql stable security definer set search_path = public as $$
  select s.member_id from public.foldy_member_sessions s
  where s.token = nullif(current_setting('request.headers', true)::json->>'x-foldy-member','')
    and s.expires_at > now()
$$;

-- 고칠 수 있는가: 같은 가족 + (비밀번호가 없거나, 그 구성원으로 잠금 해제됨)
create or replace function public.foldy_can_edit(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.foldy_members x
    where x.id = m and x.family_id = public.foldy_family()
      and (x.pin_hash is null or public.foldy_member() = m)
  )
$$;
grant execute on function public.foldy_member() to anon, authenticated;
grant execute on function public.foldy_can_edit(uuid) to anon, authenticated;

-- 단어: 보기는 가족 모두, 고치기는 본인만 (기존 정책 수정 + 제한 정책 추가)
alter policy foldy_words_all on public.foldy_words using (public.foldy_owns_member(member_id)) with check (public.foldy_can_edit(member_id));
create policy foldy_words_upd_own on public.foldy_words as restrictive for update using (public.foldy_can_edit(member_id));
create policy foldy_words_del_own on public.foldy_words as restrictive for delete using (public.foldy_can_edit(member_id));
alter policy foldy_daily_all on public.foldy_daily using (public.foldy_owns_member(member_id)) with check (public.foldy_can_edit(member_id));
create policy foldy_members_upd_own on public.foldy_members as restrictive for update using (public.foldy_can_edit(id));
create policy foldy_members_del_own on public.foldy_members as restrictive for delete using (public.foldy_can_edit(id));

-- 비밀번호 해시는 화면에 절대 내려보내지 않음(열 단위 권한)
revoke select, update on public.foldy_members from anon, authenticated;
grant select (id, family_id, name, avatar, level, daily_goal, streak, best_streak, last_study, created_at, has_pin) on public.foldy_members to anon, authenticated;
grant update (name, avatar, level, daily_goal, streak, best_streak, last_study) on public.foldy_members to anon, authenticated;

-- 잠금 해제(15분에 10번 틀리면 잠김)
create or replace function public.foldy_member_unlock(p_member uuid, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare m foldy_members; tok text; fails int; k text := 'm:' || p_member::text;
begin
  select * into m from foldy_members where id = p_member and family_id = foldy_family();
  if m.id is null then return json_build_object('error', 'NOT_FOUND'); end if;
  if m.pin_hash is null then return json_build_object('error', 'NO_PIN'); end if;
  select count(*) into fails from foldy_login_fails where login_id = k and at > now() - interval '15 minutes';
  if fails >= 10 then return json_build_object('error', 'LOGIN_LOCKED'); end if;
  if m.pin_hash <> crypt(coalesce(p_pin,''), m.pin_hash) then
    insert into foldy_login_fails(login_id) values (k);
    return json_build_object('error', 'PIN_WRONG');
  end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into foldy_member_sessions(token, member_id) values (tok, m.id);
  return json_build_object('token', tok);
end $$;

-- 비밀번호 설정·변경·해제(본인만). 빈 값이면 해제
create or replace function public.foldy_set_pin(p_member uuid, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  if not foldy_can_edit(p_member) then return json_build_object('error', 'FORBIDDEN'); end if;
  if coalesce(p_pin,'') = '' then
    update foldy_members set pin_hash = null, has_pin = false where id = p_member;
    return json_build_object('ok', true);
  end if;
  if p_pin !~ '^[0-9]{4,6}$' then return json_build_object('error', 'PIN_FORMAT'); end if;
  update foldy_members set pin_hash = crypt(p_pin, gen_salt('bf')), has_pin = true where id = p_member;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into foldy_member_sessions(token, member_id) values (tok, p_member);
  return json_build_object('ok', true, 'token', tok);
end $$;
grant execute on function public.foldy_member_unlock(uuid, text) to anon, authenticated;
grant execute on function public.foldy_set_pin(uuid, text) to anon, authenticated;
