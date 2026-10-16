-- 2026-10-16 (기록용 — 이미 적용됨)
-- 버그: 비밀번호 없는 프로필에서 발음 퀴즈 '사파리로 열어서 하기'를 누르면 '문제가 생겼어요'
-- 원인: foldy_member()가 null → member_unlocked에 null이 들어가 not-null 제약 위반(400)
create or replace function public.foldy_handoff_create(p_member uuid) returns json language plpgsql security definer set search_path to 'public','extensions' as $$
declare fid uuid := foldy_family(); c text := encode(gen_random_bytes(16),'hex');
begin
  if fid is null then return json_build_object('error','NO_SESSION'); end if;
  if p_member is not null and not exists(select 1 from foldy_members where id = p_member and family_id = fid) then return json_build_object('error','NOT_FOUND'); end if;
  insert into foldy_handoffs(code, family_id, member_id, member_unlocked)
    values (c, fid, p_member, coalesce(p_member is not null and foldy_member() = p_member, false));
  return json_build_object('code', c);
end $$;
alter table public.foldy_handoffs alter column member_unlocked set default false;
