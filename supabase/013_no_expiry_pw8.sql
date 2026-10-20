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

-- 2026-10-20: 친구 소개 추적
-- alter table foldy_families add column invited_by text;
-- foldy_mark_invited(p_from): 가입 하루 안, 비어 있을 때만 기록 · foldy_admin_retention에 invited·invited7·inviters 추가
-- 오답노트 정리: 이미 그 방식으로 맞힌(ko_ok/en_ok/sp_ok) 모드는 wrong_modes에서 뺌(일회성)

-- 2026-10-20: 베타 사용 분석
-- foldy_events(dev·family_id·member_id·name·props·test, RLS 켬·정책 없음) + foldy_track(p_dev, p_events, p_test): 이름 허용 목록, 기기 하루 800·전체 하루 10만
-- foldy_admin_analytics(p_days, p_tests): 관리자만. foldy_cleanup에 180일 지난 기록 삭제 추가

-- 2026-10-20: 우리 가족 펫
-- foldy_family_pet(family_id pk, species, name, hunger·fun·clean, xp, updated_at) · foldy_pet_log(family_id, member_id, action, day)
-- foldy_pet_now(하루 20씩 감소 계산) · foldy_pet_tickets(구성원별 오늘 돌봄권: 밥=done/10 최대 3, 산책=run_done, 목욕=rev_n≥3 또는 연속 2일)
-- foldy_pet_get / foldy_pet_adopt / foldy_pet_rename / foldy_pet_care(+35, xp+5) · foldy_track 허용 이름에 'pet'

-- 2026-10-20: 오늘 학습 단어 직접 고르기 — foldy_daily_extra_check를 extra >= -50 and extra <= 200 으로(고른 수가 목표보다 적을 때 음수) · foldy_track 허용 이름에 'pick_today'
