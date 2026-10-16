-- 앱 수정요청(건의함) — 멘토링대학교 수정요청 구조를 폴디에 맞게 옮김 (적용 완료)
create table if not exists public.foldy_admins (family_id uuid primary key references public.foldy_families(id) on delete cascade, created_at timestamptz default now());
alter table public.foldy_admins enable row level security; -- 정책 없음 = 서비스롤만
insert into public.foldy_admins(family_id) select id from public.foldy_families where login_id='bang9family' on conflict do nothing;
create or replace function public.foldy_is_admin() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from public.foldy_admins a where a.family_id = public.foldy_family()) $$;

create table if not exists public.foldy_feedback (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default public.foldy_family() references public.foldy_families(id) on delete cascade,
  family_name text, member_name text,
  category text not null default '기타', area text,
  content text not null check (char_length(content) between 1 and 2000),
  status text not null default '신규' check (status in ('신규','확인완료','의견보류','수정진행','수정완료')),
  reply text check (reply is null or char_length(reply) <= 2000),
  reply_at timestamptz, status_changed_at timestamptz, user_seen_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.foldy_feedback enable row level security;
-- 트리거: 넣을 때 가족·상태를 서버가 정함 / 상태·답장이 바뀌면 '안 읽음'으로
--   foldy_feedback_bi (insert), foldy_feedback_bu (update) — 본문은 DB 참고
-- 정책: 내 가족 것 읽기·쓰기, 관리자(foldy_admins)는 전체 읽기·상태/답장 수정·삭제
-- RPC: foldy_feedback_seen() — 내 가족 요청의 새 답장/상태를 읽음 처리
