-- 2026-10-17: 로그아웃 전까지 로그인 유지 + 가족 비밀번호 8자 이상 (적용 이름: foldy_sessions_no_expiry_pw8)
alter table public.foldy_sessions alter column expires_at set default (now() + interval '100 years');
alter table public.foldy_member_sessions alter column expires_at set default (now() + interval '100 years');
update public.foldy_sessions set expires_at = now() + interval '100 years' where expires_at > now();
update public.foldy_member_sessions set expires_at = now() + interval '100 years' where expires_at > now();
-- foldy_signup / foldy_change_password / foldy_reset_password: 비밀번호 길이 검사 < 4 → < 8

-- 2026-10-20 (적용 이름: foldy_rest_day_o_rule): 연속 학습 쉼표 + ○ 기준(뜻+철자)
alter table public.foldy_members add column if not exists rest_day date;
grant select (rest_day), update (rest_day) on public.foldy_members to anon, authenticated;
update public.foldy_words set review_step = 1, next_review = current_date + 1
where ko_ok and en_ok and not coalesce(sp_ok, false) and coalesce(review_step, 0) = 0;

-- 2026-10-20 (적용 이름: foldy_engagement_features): 복습 간격(ease·ivl), 복습 기억률(rev_ok·rev_n), 오늘의 한 판(run_done),
-- 저녁 알림(last_evening, cron foldy-evening 7 11 * * *), 가족 깨우기(foldy_nudges·foldy_nudge), 관리자 지표(foldy_admin_retention)

-- 2026-10-20 (적용 이름: foldy_beta_guardian_errors): 보호자 동의 시각(guardian_at·privacy_at, foldy_mark_guardian),
-- 오류 기록(foldy_errors, foldy_log_error·foldy_admin_errors·foldy_admin_clear_errors), foldy_cleanup에 오류 90일·깨우기 30일 정리 추가
