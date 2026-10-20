import { useEffect, useState } from 'react'
import * as db from '../lib/db.js'

// 관리자 › 분석: 유입(어디서 왔나) · 사용량(매일 몇 명이 얼마나) · 병목(어디서 멈추나)
const EVENT = {
  intro: '소개 슬라이드', auth_view: '가입·로그인 화면', signup: '가족 만들기', login: '로그인', member_add: '구성원 추가',
  add_words: '단어 담기', photo: '사진으로 단어', quiz_start: '퀴즈 시작', quiz_end: '퀴즈 끝까지', wrong_end: '다시 익히기 끝',
  sort_end: '아는 단어 거르기 끝', share_week: '성장 카드 공유', pron: '발음 연습', push_on: '알림 켜기', survey: '베타 설문',
  feedback: '수정요청 보냄', nudge: '가족 깨우기', pet: '가족 펫', pick_today: '단어장에서 오늘 학습 고르기', swap_word: '다른 단어로 바꾸기',
}
const SUB = {
  skip: '건너뜀', done: '끝까지', direct: '직접', invited: '소개', photo: '사진', manual: '직접 적기', recommend: '추천 단어', family: '가족 단어',
  ai: 'AI', ocr: '기기 글자 인식', self: '내 목소리', auto: '자동 채점', ko: '뜻 쓰기', en: '철자 쓰기', sp: '발음', daily: '오늘의 한 판',
  review: '복습', feed: '밥', known: '이미 알아요', other: '그냥 바꾸기', walk: '산책', bath: '목욕', focus: '오늘의 단어', dict: '듣고 쓰기', cloze: '빈칸 채우기', login: '로그인 탭', signup: '가입 탭', forgot: '비밀번호 찾기',
}
const PAGE = {
  '/': '홈', '/book': '단어장', '/add': '단어 추가', '/study': '학습', '/wrong': '오답노트', '/wrong/practice': '다시 익히기', '/me': '내 정보',
  '/family': '가족', '/week': '이번 주 성장', '/sort': '아는 단어 거르기', '/expand': '확장 학습', '/exam': '시험 대비', '/level': '레벨 진단',
  '/challenge': '가족 도전', '/pet': '가족 펫', '/admin': '관리자',
}
const SRC = { '': '직접(주소·북마크)', 직접: '직접(주소·북마크)', friend: '친구 소개 링크', kakao: '카톡 안에서', instagram: '인스타그램', naver: '네이버 앱' }
const featLabel = (k) => { const [a, b] = String(k).split(' · '); return (EVENT[a] || a) + (b ? ` · ${SUB[b] || b}` : '') }
const pageLabel = (p) => PAGE[p] || (String(p || '').startsWith('/quiz/') ? `퀴즈(${SUB[p.slice(6)] || p.slice(6)})` : p || '?')
const pct = (n, of) => (of ? Math.round((n / of) * 100) : null)
const md = (d) => { const [, m, dd] = String(d).slice(0, 10).split('-').map(Number); return `${m}/${dd}` }

export default function AdminStats() {
  const [days, setDays] = useState(14)
  const [tests, setTests] = useState(false)
  const [r, setR] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let on = true
    setR(null); setErr('')
    db.adminAnalytics(days, tests).then((x) => on && setR(x)).catch((e) => on && setErr(e.message))
    return () => { on = false }
  }, [days, tests])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {[7, 14, 30, 90].map((n) => (
          <button key={n} onClick={() => setDays(n)} className={`chip text-xs ${days === n ? 'chip-on' : ''}`}>최근 {n}일</button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-xs text-soft"><input type="checkbox" checked={tests} onChange={(e) => setTests(e.target.checked)} /> 테스트 포함</label>
      </div>
      {err && <p className="card p-4 text-sm text-coral">{err}</p>}
      {!r && !err && <p className="py-10 text-center text-soft">불러오는 중…</p>}
      {r && <Body r={r} />}
    </div>
  )
}

function Card({ title, desc, children }) {
  return (
    <section className="rounded-3xl border border-line bg-paper p-4">
      <h2 className="font-jua text-slate-deep">{title}</h2>
      {desc && <p className="mb-2 break-keep text-[11px] text-soft">{desc}</p>}
      {children}
    </section>
  )
}

function Body({ r }) {
  const s = r.summary || {}
  const funnel = r.funnel || []
  const top = Math.max(1, ...funnel.map((f) => f.n || 0))
  // 가장 많이 빠지는 단계(앞 단계 대비 남는 비율이 가장 낮은 곳)
  let worst = null
  funnel.forEach((f, i) => {
    if (i === 0 || f.of != null) return
    const prev = funnel[i - 1].n
    if (prev >= 3 && f.n <= prev) { const keep = f.n / prev; if (!worst || keep < worst.keep) worst = { k: f.k, from: funnel[i - 1].k, keep } }
  })
  const daily = r.daily || []
  const dmax = Math.max(1, ...daily.map((d) => Math.max(d.visitors, d.active)))
  return (
    <>
      <section className="grid grid-cols-3 gap-2">
        <Mini label="들어온 기기" v={s.visitors} />
        <Mini label="새 가족" v={s.signups} />
        <Mini label="공부한 사람" v={s.active} />
        <Mini label="맞힌 문제" v={s.answers} />
        <Mini label="1인 공부일" v={s.avg_days ?? '—'} />
        <Mini label="앱 오류" v={s.errors} warn={s.errors > 0} />
      </section>

      <Card title="🪜 어디까지 오나요 (가입 흐름)" desc={`최근 ${r.days}일 기준. 막대는 첫 단계 대비, 오른쪽 %는 바로 앞 단계에서 넘어온 비율이에요.`}>
        <ul className="space-y-2">
          {funnel.map((f, i) => {
            const prev = i ? funnel[i - 1].n : null
            const raw = f.of != null ? pct(f.n, f.of) : i ? pct(f.n, prev) : null
            const keep = raw != null && raw <= 100 ? raw : null // 기록을 모으기 전에 가입한 가족이 섞이면 100%를 넘을 수 있어 숨김
            return (
              <li key={f.k}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="break-keep text-ink">{f.k}</span>
                  <span className="shrink-0 font-jua text-slate-deep">{f.n}{f.of != null ? `/${f.of}` : ''}{keep != null && <span className={`ml-1 text-xs ${keep < 50 ? 'text-coral' : 'text-soft'}`}>{keep}%</span>}</span>
                </div>
                <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-slate" style={{ width: `${Math.min(100, ((f.n || 0) / top) * 100)}%` }} /></span>
              </li>
            )
          })}
        </ul>
        {worst && <p className="mt-3 break-keep rounded-2xl bg-coral/10 px-3 py-2 text-sm text-coral">가장 많이 빠지는 곳: ‘{worst.from}’ → ‘{worst.k}’ ({Math.round(worst.keep * 100)}%만 넘어옴)</p>}
      </Card>

      <Card title="📈 하루하루" desc="남색 = 들어온 기기, 주황 = 공부한 사람. 숫자는 그날 맞힌 문제예요.">
        <div className="flex h-36 items-end gap-1" aria-label="날짜별 이용">
          {daily.map((d, i) => (
            <div key={d.dd} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5" title={`${md(d.dd)} 들어옴 ${d.visitors} · 공부 ${d.active} · 가입 ${d.signups} · 문제 ${d.answers}`}>
              <span className="text-[9px] text-soft">{d.answers || ''}</span>
              <div className="flex h-24 w-full items-end justify-center gap-px">
                <span className="w-1/2 rounded-t bg-slate/70" style={{ height: `${(d.visitors / dmax) * 100}%` }} />
                <span className="w-1/2 rounded-t bg-tang" style={{ height: `${(d.active / dmax) * 100}%` }} />
              </div>
              <span className="whitespace-nowrap text-[9px] text-soft">{(daily.length - 1 - i) % Math.ceil(daily.length / 7) === 0 ? md(d.dd) : ''}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="🚪 어디서 들어오나요" desc="처음 연 링크·앱 기준(같은 기기는 한 번만).">
        <Rows rows={(r.sources || []).map((x) => [SRC[x.k] || x.k, `${x.n}대`])} empty="아직 기록이 없어요" />
        <p className="mt-2 text-xs text-soft">새 가족 중 친구 소개로 가입 {r.invited?.yes || 0} · 직접 {r.invited?.no || 0}</p>
      </Card>

      <Card title="🧭 많이 쓰는 기능" desc="횟수 · 쓴 사람 수(구성원 또는 기기)">
        <Rows rows={(r.features || []).map((x) => [featLabel(x.k), `${x.n}번 · ${x.people}명`])} empty="아직 기록이 없어요" />
      </Card>

      <Card title="🎯 퀴즈를 끝까지 푸나요" desc="시작 대비 끝까지 푼 비율이 낮으면 문제가 너무 많거나 어렵다는 신호예요.">
        <Rows rows={(r.quiz || []).map((x) => [SUB[x.mode] || x.mode, `${x.ended}/${x.started}번 · ${pct(x.ended, x.started) ?? '—'}%`, pct(x.ended, x.started) < 50])} empty="아직 기록이 없어요" />
        <p className="mt-2 text-xs text-soft">사진으로 단어: 성공 {r.photo?.ok || 0} · 실패 {r.photo?.fail || 0} · 담긴 단어 {r.photo?.words || 0}개</p>
      </Card>

      <Card title="🛑 마지막으로 머문 곳" desc="이틀 넘게 다시 오지 않은 기기가 마지막으로 본 화면·한 일. 많이 몰린 곳이 병목 후보예요.">
        <Rows rows={(r.exits || []).map((x) => [`${String(x.k).startsWith('/') ? pageLabel(x.k) : featLabel(x.k)} (${x.stage})`, `${x.n}대`])} empty="아직 이탈 기록이 없어요" />
      </Card>

      <Card title="📄 많이 본 화면">
        <Rows rows={(r.pages || []).map((x) => [pageLabel(x.k), `${x.n}번 · ${x.people}대`])} empty="아직 기록이 없어요" />
      </Card>

      <Card title="🗓 가입한 날별 재방문" desc="그 날 가입한 가족 중 다음 날 · 3일 뒤 이후 · 7일 뒤 이후에도 공부한 가족(아직 그날이 안 됐으면 —).">
        {(r.cohorts || []).length === 0 ? <p className="text-sm text-soft">아직 새 가족이 없어요</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-soft"><th className="text-left font-normal">가입일</th><th className="font-normal">가족</th><th className="font-normal">다음 날</th><th className="font-normal">3일+</th><th className="font-normal">7일+</th></tr></thead>
            <tbody>
              {r.cohorts.map((c) => (
                <tr key={c.sday} className="text-center">
                  <td className="py-1 text-left">{md(c.sday)}</td><td>{c.n}</td>
                  <td>{c.age >= 1 ? `${pct(c.d1, c.n)}%` : '—'}</td><td>{c.age >= 3 ? `${pct(c.d3, c.n)}%` : '—'}</td><td>{c.age >= 7 ? `${pct(c.d7, c.n)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="break-keep text-center text-[11px] text-soft">이름·단어 같은 내용은 모으지 않아요. 기기마다 만든 무작위 번호와 화면·버튼 종류만 기록하고, 180일 뒤 지워요.</p>
    </>
  )
}

function Mini({ label, v, warn }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-2.5 text-center">
      <p className="break-keep text-[11px] text-soft">{label}</p>
      <p className={`font-jua text-xl ${warn ? 'text-coral' : 'text-slate-deep'}`}>{v ?? 0}</p>
    </div>
  )
}

function Rows({ rows, empty }) {
  if (!rows.length) return <p className="text-sm text-soft">{empty}</p>
  return (
    <ul className="divide-y divide-line/70 text-sm">
      {rows.map(([a, b, bad], i) => (
        <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
          <span className="min-w-0 break-keep text-ink">{a}</span>
          <span className={`shrink-0 font-jua ${bad ? 'text-coral' : 'text-slate-deep'}`}>{b}</span>
        </li>
      ))}
    </ul>
  )
}
