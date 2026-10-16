-- 2026-10-16 (기록용 — 이미 적용됨)
-- 유료 AI(Claude)는 ai_paid=true 가족만. 다른 가족은 무료 AI(Gemini 등)만 씀.
-- 가족이 스스로 바꿀 수 없음(foldy_families는 본인 행 읽기만 허용). 켜고 끄기는 SQL로:
--   update foldy_families set ai_paid = true where login_id = '아이디';
alter table public.foldy_families add column if not exists ai_paid boolean not null default false;
update public.foldy_families set ai_paid = true where login_id = 'bang9family';
create or replace function public.foldy_ai_paid() returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select ai_paid from foldy_families where id = foldy_family()), false)
$$;
grant execute on function public.foldy_ai_paid() to anon, authenticated;
