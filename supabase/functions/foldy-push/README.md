Supabase Edge Function `foldy-push` (modu-publish, verify_jwt=false — DB가 보내는 x-foldy-push-secret으로 확인). 현재 v6.
- kind=feedback {id}: 관리자 본인(foldy_admins.member_id)의 알림 기기로만 새 수정요청 알림(e2e_ 테스트 가족은 건너뜀)
- kind=challenge / challenge_done {id}: 가족 문제 도착·결과
- kind=nudge {from,to}: 가족 깨우기(👏) — DB 함수 foldy_nudge가 같은 가족·하루 한 번을 확인한 뒤 부름
- kind=evening: cron 'foldy-evening' 매일 20:07 KST. 내일 시험이 있으면 '총정리' 알림, 아니면 연속 학습일이 끊기기 직전(어제 공부·쉼표 가능)인데 오늘 아직이면 '1분만 하면 N일째'. 하루 한 번(foldy_members.last_evening)
- kind=remind: 알림을 켠 구성원 중 마지막 학습 24시간이 지났고 24시간 안에 알림을 안 받은 사람에게 "오늘도 짧게 영어단어 하나 배워볼까요?" (오전 8시~밤 9시만)
배포된 코드는 Supabase 대시보드 Edge Functions에서 볼 수 있음(이 폴더는 설명만).
