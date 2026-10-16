-- 2026-10-17: 로그아웃 전까지 로그인 유지 + 가족 비밀번호 8자 이상 (적용 이름: foldy_sessions_no_expiry_pw8)
alter table public.foldy_sessions alter column expires_at set default (now() + interval '100 years');
alter table public.foldy_member_sessions alter column expires_at set default (now() + interval '100 years');
update public.foldy_sessions set expires_at = now() + interval '100 years' where expires_at > now();
update public.foldy_member_sessions set expires_at = now() + interval '100 years' where expires_at > now();
-- foldy_signup / foldy_change_password / foldy_reset_password: 비밀번호 길이 검사 < 4 → < 8
