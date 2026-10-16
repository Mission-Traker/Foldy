-- 오답노트 3단계 다시 익히기 + 날짜 간격 졸업 (2026-10-16)
-- wrong_step: 오답노트에서 서로 다른 날 맞힌 횟수(0~3, 3이면 졸업하며 0으로)
-- wrong_next: 다음에 다시 볼 날(null이면 오늘 바로)
-- wrong_grad: 이 단어가 오답노트를 졸업한 횟수(캐릭터 먹이 보너스)
alter table public.foldy_words
  add column if not exists wrong_step smallint not null default 0 check (wrong_step between 0 and 3),
  add column if not exists wrong_next date,
  add column if not exists wrong_grad smallint not null default 0 check (wrong_grad between 0 and 999);
grant select, insert, update (wrong_step, wrong_next, wrong_grad) on public.foldy_words to anon, authenticated;
