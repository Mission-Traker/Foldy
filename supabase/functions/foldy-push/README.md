Supabase Edge Function `foldy-push` (modu-publish, verify_jwt=false — DB가 보내는 x-foldy-push-secret으로 확인).
- kind=feedback {id}: 관리자 가족(foldy_admins)의 알림 기기로 새 수정요청 알림(e2e_ 테스트 가족은 건너뜀)
- kind=remind: 알림을 켠 구성원 중 마지막 학습 24시간이 지났고 24시간 안에 알림을 안 받은 사람에게 "오늘도 짧게 영어단어 하나 배워볼까요?" (오전 8시~밤 9시만)
배포된 코드는 Supabase 대시보드 Edge Functions에서 볼 수 있음(이 폴더는 설명만).
