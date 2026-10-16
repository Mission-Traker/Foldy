-- 2026-10-16~17: 이름 한 달에 한 번 + 관리자 페이지 서버 함수 (실제 적용은 Supabase 마이그레이션 foldy_member_name_monthly, foldy_admin_console)

-- ① 이름(닉네임)은 한 달에 한 번 — 바꾼 날짜는 서버가 기록(클라이언트는 못 고침)
alter table public.foldy_members add column if not exists name_changed_at timestamptz;
grant select (name_changed_at) on public.foldy_members to anon, authenticated;
create or replace function public.foldy_member_name_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.name is distinct from old.name then
    if old.name_changed_at is not null and now() < old.name_changed_at + interval '1 month' then
      raise exception 'name_cooldown:%', to_char((old.name_changed_at + interval '1 month') at time zone 'Asia/Seoul', 'YYYY-MM-DD') using errcode = 'P0001';
    end if;
    new.name_changed_at := now();
  else
    new.name_changed_at := old.name_changed_at;
  end if;
  return new;
end $$;
create or replace trigger foldy_member_name_guard before update on public.foldy_members for each row execute function public.foldy_member_name_guard();

-- ② 관리자 페이지: 관리자 구성원만(그 구성원에 숫자 비밀번호가 있으면 그 비밀번호로 연 기기에서만)
create or replace function public.foldy_admin_ok() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from foldy_admins a join foldy_members m on m.id = a.member_id
    where a.family_id = foldy_family() and (m.pin_hash is null or foldy_member() = a.member_id))
$$;
-- foldy_admin_overview(): 가족·구성원·단어 수, 오늘/7일 공부한 가족, 오늘 AI 사용(종류별), 처리할 수정요청(신규·수정진행), 테스트 가족 수 — e2e_ 가족은 숫자에서 뺌
-- foldy_admin_families(p_tests): 가족별 이름·아이디·가입일·구성원·단어·마지막 학습·오늘 AI·유료 여부(우리 가족은 늘 포함, 300개까지)
-- foldy_admin_set_paid(p_family, p_paid): 유료 AI(Claude) 켜고 끄기
-- foldy_admin_cleanup_tests(): 아이디가 e2e_로 시작하는 가족만 지움(내 가족 제외)
-- 위 네 함수 본문은 Supabase 마이그레이션 foldy_admin_console 참고. 모두 security definer + foldy_admin_ok() 확인, 실패 시 'not_admin'(42501)
