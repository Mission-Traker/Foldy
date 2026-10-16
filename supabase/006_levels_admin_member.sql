-- 2026-10-16 (기록용 — 이미 적용됨)
-- 1) 레벨을 Lv.01~Lv.10(L1~L10)로. 예전 값(e1·e3·e5·m·h·a)은 옮기고, 옛 화면이 보내도 받도록 함께 허용
alter table public.foldy_members drop constraint foldy_members_level_check;
alter table public.foldy_members add constraint foldy_members_level_check
  check (level in ('L1','L2','L3','L4','L5','L6','L7','L8','L9','L10','e1','e3','e5','m','h','a'));
alter table public.foldy_members alter column level set default 'L1';
update public.foldy_members set level = case level when 'e1' then 'L1' when 'e3' then 'L2' when 'e5' then 'L3'
  when 'm' then 'L4' when 'h' then 'L7' when 'a' then 'L10' else level end
  where level in ('e1','e3','e5','m','h','a');

-- 2) 수정요청 알림은 관리자 가족 전체가 아니라 관리자 본인 한 사람에게만
alter table public.foldy_admins add column if not exists member_id uuid references public.foldy_members(id) on delete set null;
create or replace function public.foldy_admin_member() returns uuid language sql stable security definer set search_path to 'public' as $$
  select a.member_id from public.foldy_admins a where a.family_id = public.foldy_family() limit 1
$$;
grant execute on function public.foldy_admin_member() to anon, authenticated;
