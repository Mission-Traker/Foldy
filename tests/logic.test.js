import { describe, it, expect } from 'vitest'
import { gradeMeaning, gradeSpelling, gradeSpeech, normalizeKo, speechScore, soundKey } from '../src/lib/grading.js'
import {
  statusOf, applyAnswer, applyReview, sortWords, pickQuiz, nextStreak, cleanEntry,
  expandStage, isDue, sendToWrongNote, addDays,
  wrongDue, wrongDueList, nameNextChange, nameLocked, wrongNextVisit, applyWrongResult, meaningChoices, WRONG_GOAL,
} from '../src/lib/study.js'
import { dailyPick, recommendLevel, wordsOfLevel, levelTestSet, LEVELS, levelLabel } from '../src/lib/levels.js'

const base = { en_ok: false, ko_ok: false, sp_ok: false, attempted: false, wrong_modes: [] }

describe('뜻 채점(맥락상 정답 허용)', () => {
  it('정확히 같으면 정답', () => expect(gradeMeaning('사과', '사과').ok).toBe(true))
  it('어미가 달라도 정답: 행복하다 vs 행복한', () => expect(gradeMeaning('행복하다', '행복한').ok).toBe(true))
  it('여러 뜻 중 하나만 써도 정답', () => expect(gradeMeaning('기쁜', '행복한, 기쁜').ok).toBe(true))
  it('AI 허용 답안 목록에 있으면 정답', () => expect(gradeMeaning('즐거운', '행복한', ['즐거운', '신나는']).ok).toBe(true))
  it('띄어쓰기·괄호 무시', () => expect(gradeMeaning('아름 다운', '아름다운(형용사)').ok).toBe(true))
  it('오타 1글자 허용(3글자 이상)', () => expect(gradeMeaning('도서괸', '도서관').ok).toBe(true))
  it('전혀 다른 뜻은 오답', () => expect(gradeMeaning('자동차', '사과').ok).toBe(false))
  it('빈 입력은 오답', () => expect(gradeMeaning('   ', '사과')).toEqual({ ok: false, close: false }))
  it('한 글자 답으로 긴 뜻을 맞힐 수 없음', () => expect(gradeMeaning('바', '바다').ok).toBe(false))
  it('정규화 결과', () => expect(normalizeKo('공부하다')).toBe('공부'))
})

describe('철자 채점', () => {
  it('대소문자·공백 무시', () => expect(gradeSpelling('  Apple ', 'apple').ok).toBe(true))
  it('관사 허용', () => expect(gradeSpelling('an apple', 'apple').ok).toBe(true))
  it('철자 틀리면 오답 + 아깝다 표시', () => expect(gradeSpelling('aple', 'apple')).toEqual({ ok: false, close: true }))
  it('빈 입력', () => expect(gradeSpelling('', 'apple').ok).toBe(false))
})

describe('발음 채점(유연, 70% 이상 통과)', () => {
  it('정확히 맞으면 100%', () => expect(speechScore([{ t: 'Apple' }], 'apple')).toBe(1))
  it('비슷한 발음도 통과: apples → apple', () => expect(gradeSpeech([{ t: 'apples' }], 'apple')).toBe(true))
  it('r/l 헷갈림 허용: rice ↔ lice', () => expect(gradeSpeech([{ t: 'lice' }], 'rice')).toBe(true))
  it('v/f 헷갈림 허용: very ↔ fairy', () => expect(gradeSpeech([{ t: 'fairy' }], 'very')).toBe(true))
  it('끝소리만 다른 경우 통과: libraries → library', () => expect(gradeSpeech([{ t: 'libraries' }], 'library')).toBe(true))
  it('문장으로 들려도 그 속 낱말로 판정', () => expect(gradeSpeech([{ t: 'i said umbrella' }], 'umbrella')).toBe(true))
  it('전혀 다른 단어는 실패', () => expect(gradeSpeech([{ t: 'banana' }], 'library')).toBe(false))
  it('짧은 단어 다른 소리는 실패: dog ↔ cat', () => expect(gradeSpeech([{ t: 'cat' }], 'dog')).toBe(false))
  it('여러 후보 중 가장 좋은 점수 사용', () => expect(speechScore([{ t: 'banana' }, { t: 'library' }], 'library')).toBe(1))
  it('아무것도 못 들으면 0', () => expect(speechScore([], 'apple')).toBe(0))
  it('소리 키: phone ↔ fone 같음', () => expect(soundKey('phone')).toBe(soundKey('fone')))
})

describe('○△× 상태', () => {
  it('아무것도 안 했으면 ×', () => expect(statusOf(base)).toBe('x'))
  it('하나라도 시도하면 △', () => expect(statusOf({ ...base, attempted: true })).toBe('t'))
  it('셋 다 맞히면 ○', () => expect(statusOf({ ...base, en_ok: true, ko_ok: true, sp_ok: true })).toBe('o'))
  it('두 개만 맞히면 △', () => expect(statusOf({ ...base, en_ok: true, ko_ok: true })).toBe('t'))
})

describe('답 반영·복습 일정', () => {
  it('세 번째 정답으로 ○가 되면 내일 복습 예약', () => {
    const p = applyAnswer({ ...base, en_ok: true, ko_ok: true }, 'sp', true, '2026-10-15')
    expect(p).toMatchObject({ sp_ok: true, review_step: 1, next_review: '2026-10-16' })
  })
  it('○ 단어를 틀리면 △로 내려가고 복습 해제', () => {
    const p = applyAnswer({ ...base, en_ok: true, ko_ok: true, sp_ok: true, review_step: 2 }, 'ko', false)
    expect(p).toMatchObject({ ko_ok: false, review_step: 0, next_review: null })
  })
  it('일반 퀴즈에서 한 번 맞혀도 오답노트에서 빠지지 않음', () => {
    const p = applyAnswer({ ...base, wrong_modes: ['ko', 'sp'] }, 'ko', true)
    expect(p.wrong_modes).toBeUndefined()
  })
  it('복습 정답이면 간격이 늘어남(1→3일)', () => {
    expect(applyReview({ review_step: 1 }, 'ko', true, '2026-10-15')).toEqual({ review_step: 2, next_review: '2026-10-18' })
  })
  it('복습 대상 판정', () => {
    const w = { ...base, en_ok: true, ko_ok: true, sp_ok: true, next_review: '2026-10-15' }
    expect(isDue(w, '2026-10-15')).toBe(true)
    expect(isDue(w, '2026-10-14')).toBe(false)
  })
  it('오답노트 보내기는 중복 없이', () => {
    expect(sendToWrongNote({ wrong_modes: ['ko'] }, 'ko').wrong_modes).toEqual(['ko'])
  })
  it('월말 날짜 계산', () => expect(addDays('2026-10-31', 1)).toBe('2026-11-01'))
})

describe('확장 단계', () => {
  const o = { ...base, en_ok: true, ko_ok: true, sp_ok: true }
  it('○ 전에는 없음', () => expect(expandStage(base)).toBe('none'))
  it('○이면 유의어·반의어 단계', () => expect(expandStage({ ...o, enriched: true, syn: {}, ant: {} })).toBe('synant'))
  it('둘 다 맞히면 예문', () => expect(expandStage({ ...o, enriched: true, syn: {}, ant: {}, syn_ok: true, ant_ok: true })).toBe('example'))
  it('반의어가 없는 단어는 유의어만 맞혀도 예문', () => expect(expandStage({ ...o, enriched: true, syn: {}, ant: null, syn_ok: true })).toBe('example'))
  it('유의어·반의어가 둘 다 없는 단어(apple)는 바로 예문', () => expect(expandStage({ ...o, enriched: true, syn: null, ant: null })).toBe('example'))
  it('AI 정보가 아직 없으면 기다림 단계', () => expect(expandStage({ ...o, enriched: false, syn: null, ant: null })).toBe('synant'))
})

describe('정렬', () => {
  const ws = [
    { seq: 2, word: 'banana', created_at: '2026-10-14T00:00:00Z' },
    { seq: 1, word: 'cherry', created_at: '2026-10-15T00:00:00Z' },
    { seq: 3, word: 'Apple', created_at: '2026-10-13T00:00:00Z' },
  ]
  it('번호순', () => expect(sortWords(ws, 'seq').map((w) => w.seq)).toEqual([1, 2, 3]))
  it('날짜순', () => expect(sortWords(ws, 'date').map((w) => w.seq)).toEqual([3, 2, 1]))
  it('알파벳순(대소문자 무시)', () => expect(sortWords(ws, 'abc').map((w) => w.word)).toEqual(['Apple', 'banana', 'cherry']))
  it('역순', () => expect(sortWords(ws, 'seq', 'desc').map((w) => w.seq)).toEqual([3, 2, 1]))
})

describe('퀴즈 출제', () => {
  it('이미 통과한 단어는 빼고 남은 단어만(뜻)', () => {
    const ws = Array.from({ length: 15 }, (_, i) => ({ ...base, id: i, ko_ok: i < 10 }))
    const q = pickQuiz(ws, 'ko', 10)
    expect(q.length).toBe(5)
    expect(q.every((w) => !w.ko_ok)).toBe(true)
  })
  it('철자·발음도 각각 통과한 것만 뺌', () => {
    const ws = [{ ...base, id: 1, en_ok: true, sp_ok: false }, { ...base, id: 2, en_ok: false, sp_ok: true }]
    expect(pickQuiz(ws, 'en').map((w) => w.id)).toEqual([2])
    expect(pickQuiz(ws, 'sp').map((w) => w.id)).toEqual([1])
  })
  it('남은 게 많으면 10개씩', () => {
    const ws = Array.from({ length: 25 }, (_, i) => ({ ...base, id: i }))
    expect(pickQuiz(ws, 'ko').length).toBe(10)
  })
  it('모두 통과했으면 빈 목록', () => {
    expect(pickQuiz([{ ...base, ko_ok: true }], 'ko')).toEqual([])
  })
})

describe('연속 학습일', () => {
  it('어제 공부했으면 +1', () => expect(nextStreak({ streak: 3, best_streak: 3, last_study: '2026-10-14' }, '2026-10-15')).toEqual({ streak: 4, best_streak: 4, last_study: '2026-10-15' }))
  it('하루 빠지면 1부터', () => expect(nextStreak({ streak: 3, best_streak: 5, last_study: '2026-10-12' }, '2026-10-15').streak).toBe(1))
  it('오늘 이미 했으면 변화 없음', () => expect(nextStreak({ last_study: '2026-10-15' }, '2026-10-15')).toBeNull())
})

describe('입력 검증', () => {
  it('정상', () => expect(cleanEntry({ word: ' apple ', meaning: '사과' }).errors).toEqual([]))
  it('빈 입력', () => expect(cleanEntry({ word: '', meaning: '' }).errors.length).toBe(2))
  it('길이 초과', () => expect(cleanEntry({ word: 'a'.repeat(61), meaning: '뜻' }).errors[0]).toMatch(/60자/))
  it('한글을 영어 칸에 넣으면 거부', () => expect(cleanEntry({ word: '사과', meaning: '사과' }).errors[0]).toMatch(/알파벳/))
  it('HTML 같은 입력 거부', () => expect(cleanEntry({ word: '<b>x</b>', meaning: 'x' }).errors.length).toBe(1))
})

describe('레벨', () => {
  it('각 레벨에 단어가 있음', () => ['e1', 'e3', 'e5', 'm', 'h'].forEach((l) => expect(wordsOfLevel(l).length).toBeGreaterThan(150)))
  it('추천은 가진 단어 제외 + 같은 날 같은 결과', () => {
    const owned = new Set(['apple'])
    const a = dailyPick('e1', owned, 'm1-2026-10-15')
    const b = dailyPick('e1', owned, 'm1-2026-10-15')
    expect(a).toEqual(b)
    expect(a.length).toBe(5)
    expect(a.includes('apple')).toBe(false)
  })
  it('진단: 처음으로 4개 미만인 레벨 추천', () => {
    expect(recommendLevel([{ level: 'L1', known: 5 }, { level: 'L2', known: 4 }, { level: 'L3', known: 2 }])).toBe('L3')
  })
  it('레벨 표기는 Lv.01~Lv.10, 예전 값도 읽음', () => {
    expect(LEVELS.map((l) => l.label)).toEqual(['Lv.01','Lv.02','Lv.03','Lv.04','Lv.05','Lv.06','Lv.07','Lv.08','Lv.09','Lv.10'])
    expect(levelLabel('m')).toBe('Lv.04')
    expect(levelLabel('a')).toBe('Lv.10')
    expect(wordsOfLevel('e1')).toBe(wordsOfLevel('L1'))
  })
  it('진단 세트는 9레벨 × 5단어', () => {
    const s = levelTestSet('x')
    expect(s.length).toBe(9)
    expect(s.every((g) => g.words.length === 5)).toBe(true)
  })
})

import { parseLines } from '../src/lib/study.js'
describe('직접 적기 줄 나누기', () => {
  it('공백 구분', () => expect(parseLines('apple 사과')).toEqual([{ word: 'apple', meaning: '사과' }]))
  it('하이픈·콜론 구분', () => expect(parseLines('happy - 행복한, 기쁜\nlibrary: 도서관')).toEqual([
    { word: 'happy', meaning: '행복한, 기쁜' }, { word: 'library', meaning: '도서관' }]))
  it('두 단어 표현', () => expect(parseLines('ice cream 아이스크림')).toEqual([{ word: 'ice cream', meaning: '아이스크림' }]))
  it('하이픈 단어는 유지', () => expect(parseLines('well-known 잘 알려진')[0].word).toBe('well-known'))
  it('뜻 없는 줄', () => expect(parseLines('banana')).toEqual([{ word: 'banana', meaning: '' }]))
  it('빈 줄 무시', () => expect(parseLines('\n\n')).toEqual([]))
})

import { mergePatchResult, enqueue, PatchTracker } from '../src/lib/study.js'
describe('오답노트 보내기 저장 경쟁(버그 재현)', () => {
  it('먼저 보낸 정답/오답 저장의 응답이 오답노트 표시를 지우면 안 됨', () => {
    // 1) 오답 기록 저장 요청(응답에는 wrong_modes가 아직 비어 있음)
    const answerPatch = { attempted: true, ko_ok: false }
    const answerSaved = { id: 'w', attempted: true, ko_ok: false, wrong_modes: [] }
    // 2) 그 사이 사용자가 '오답노트로'를 눌러 화면에는 이미 반영됨
    const current = { id: 'w', attempted: true, ko_ok: false, wrong_modes: ['ko'] }
    // 3) 1)의 응답이 늦게 도착
    expect(mergePatchResult(current, answerSaved, answerPatch).wrong_modes).toEqual(['ko'])
  })
  it('같은 단어 저장은 순서대로 실행', async () => {
    const log = []
    const slow = () => new Promise((r) => setTimeout(() => { log.push('answer'); r() }, 30))
    const fast = () => { log.push('wrongnote'); return Promise.resolve() }
    await Promise.all([enqueue('w', slow), enqueue('w', fast)])
    expect(log).toEqual(['answer', 'wrongnote'])
  })
})

import { pairFromText } from '../src/lib/ocr.js'
import { searchEntries } from '../src/lib/dict.js'
import DICT from '../src/data/dict.json'
const ENTRIES = Object.entries(DICT).map(([word, meaning]) => ({ word, meaning, lw: word.toLowerCase(), km: meaning.replace(/\s/g, '') }))

describe('기기 글자 인식 결과 → 단어·뜻', () => {
  it('같은 줄 영어+한글', () => expect(pairFromText('1. apple 사과\n2) happy 행복한, 기쁜')).toEqual([
    { word: 'apple', meaning: '사과' }, { word: 'happy', meaning: '행복한, 기쁜' }]))
  it('영어 줄 다음 한글 줄', () => expect(pairFromText('library\n도서관')).toEqual([{ word: 'library', meaning: '도서관' }]))
  it('발음기호·잡음 제거', () => expect(pairFromText('umbrella [ʌmbrélə] 우산')[0]).toEqual({ word: 'umbrella', meaning: '우산' }))
  it('한 글자·숫자만 있는 줄은 버림', () => expect(pairFromText('a 하나\n123 숫자')).toEqual([]))
})

describe('직접 적기 자동완성', () => {
  it('사전 2,898단어 모두 뜻이 있음', () => expect(ENTRIES.length).toBeGreaterThan(2800))
  it('영어 앞글자만 쳐도 찾음(app → apple 포함)', () => expect(searchEntries(ENTRIES, 'app').map((e) => e.word)).toContain('apple'))
  it('정확히 일치하는 단어가 맨 앞', () => expect(searchEntries(ENTRIES, 'apple')[0].word).toBe('apple'))
  it('한글로 찾기(사과 → apple)', () => expect(searchEntries(ENTRIES, '사과').map((e) => e.word)).toContain('apple'))
  it('한글 일부만 쳐도 찾음(행복 → happy)', () => expect(searchEntries(ENTRIES, '행복').map((e) => e.word)).toContain('happy'))
  it('최대 8개', () => expect(searchEntries(ENTRIES, 'a').length).toBeLessThanOrEqual(8))
  it('빈 입력·이상한 입력은 빈 결과', () => { expect(searchEntries(ENTRIES, ' ')).toEqual([]); expect(searchEntries(ENTRIES, '<b>')).toEqual([]) })
})

describe('늦게 온 저장 응답이 최신 값을 되돌리지 않음(한 번 더 버그)', () => {
  it('1회차 오답 응답이 2회차 정답을 덮어쓰지 않음', () => {
    const t = new PatchTracker()
    const first = t.begin('w', { ko_ok: false })   // 1회차 오답 저장 시작
    const second = t.begin('w', { ko_ok: true })   // 2회차 정답 저장 시작
    let cur = { id: 'w', ko_ok: true }              // 화면엔 최신(정답) 반영
    cur = mergePatchResult(cur, { id: 'w', ko_ok: false }, t.fresh('w', first))  // 1회차 응답 늦게 도착
    expect(cur.ko_ok).toBe(true)
    cur = mergePatchResult(cur, { id: 'w', ko_ok: true }, t.fresh('w', second))
    expect(cur.ko_ok).toBe(true)
  })
  it('다른 칸은 정상 반영', () => {
    const t = new PatchTracker()
    const a = t.begin('w', { ko_ok: false, attempted: true })
    t.begin('w', { ko_ok: true })
    expect(Object.keys(t.fresh('w', a))).toEqual(['attempted'])
  })
})

describe('AI 정보 붙이기가 퀴즈 결과를 덮어쓰지 않음', () => {
  it('AI 칸만 반영', () => {
    const cur = { id: 'w', ko_ok: true, attempted: true, enriched: false, syn: null }
    const fromServer = { id: 'w', ko_ok: false, attempted: false, enriched: true, syn: { word: 'glad' } }
    const out = mergePatchResult(cur, fromServer, { accepted: 1, syn: 1, ant: 1, example: 1, enriched: 1 })
    expect(out).toMatchObject({ ko_ok: true, attempted: true, enriched: true, syn: { word: 'glad' } })
  })
})

describe('flushQueued (화면을 닫을 때 저장 줄 비우기)', () => {
  it('앞 저장이 끝나기 전이라도 뒤 저장을 바로 보낸다', async () => {
    const { enqueue, flushQueued } = await import('../src/lib/study.js')
    const log = []
    let release
    enqueue('w1', () => new Promise((r) => { log.push('a'); release = r }))
    const second = enqueue('w1', () => { log.push('b'); return 'B' })
    const tick = () => new Promise((r) => setTimeout(r, 0))
    await tick()
    expect(log).toEqual(['a'])
    flushQueued()
    await tick()
    expect(log).toEqual(['a', 'b'])
    release()
    expect(await second).toBe('B')
    expect(log).toEqual(['a', 'b']) // 두 번 보내지 않음
  })
})

describe('오늘의 단어 · 반복 학습 · 오늘 복습', async () => {
  const S = await import('../src/lib/study.js')
  const mk = (seq, f = {}) => ({ id: 'w' + seq, seq, word: 'w' + seq, ...f })
  const all = [mk(1, { ko_ok: true, en_ok: true, sp_ok: true }), mk(2), mk(3, { attempted: true }), mk(4), mk(5), mk(6, { ko_ok: true }), mk(7)]
  it('목표 개수만큼, 학습 중(△)부터 번호 순으로 고르고 ○ 단어는 뺀다', () => {
    expect(S.resolveTodaySet(all, [], 3)).toEqual(['w3', 'w6', 'w2'])
  })
  it('저장된 세트는 그대로 지키고(○가 돼도 남김), 지워진 단어만 빼고 채운다', () => {
    const words = all.map((w) => (w.id === 'w3' ? { ...w, ko_ok: true, en_ok: true, sp_ok: true } : w)).filter((w) => w.id !== 'w6')
    expect(S.resolveTodaySet(words, ['w3', 'w6', 'w2'], 3)).toEqual(['w3', 'w2', 'w4'])
  })
  it('한 바퀴: 못 맞힌 단어만 → 다 맞히면 같은 세트 전체를 다시(다른 단어로 안 넘어감)', () => {
    const set = ['w2', 'w6']
    expect(S.todayQueue(all, set, 'ko').map((x) => x.id)).toEqual(['w2'])
    const passed = all.map((w) => (w.id === 'w2' ? { ...w, ko_ok: true } : w))
    const q = S.todayQueue(passed, set, 'ko')
    expect(q.map((x) => x.id).sort()).toEqual(['w2', 'w6'])
    expect(q.every((x) => x.practice)).toBe(true)
  })
  it('오늘 복습 = 복습 날이 된 ○ 단어 + 오늘 푼 단어(중복 없이)', () => {
    const words = [...all, mk(8, { ko_ok: true, en_ok: true, sp_ok: true, next_review: '2026-10-16' })]
    const q = S.reviewQueue(words, ['w2', 'w8', 'gone'], '2026-10-16')
    expect(q.map((x) => x.id).sort()).toEqual(['w2', 'w8'])
    expect(q.find((x) => x.id === 'w8').review).toBe(true)
    expect(q.find((x) => x.id === 'w2').practice).toBe(true)
    expect(S.reviewCount(words, ['w2', 'w8', 'gone'], '2026-10-16')).toBe(2)
  })
  it('연속 학습일: 어제·오늘 공부했으면 유지, 이틀 이상 빠지면 0', () => {
    expect(S.liveStreak({ streak: 3, last_study: '2026-10-15' }, '2026-10-16')).toBe(3)
    expect(S.liveStreak({ streak: 3, last_study: '2026-10-13' }, '2026-10-16')).toBe(0)
    expect(S.nextStreak({ streak: 1, best_streak: 1, last_study: '2026-10-15' }, '2026-10-16')).toEqual({ streak: 2, best_streak: 2, last_study: '2026-10-16' })
  })
})

describe('오프라인 보낼 목록', async () => {
  const store = {}
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v) }, removeItem: (k) => { delete store[k] } }
  const O = await import('../src/lib/offline.js')
  it('같은 단어는 칸별로 합치고, 보낸 것만 지운다', async () => {
    O.outboxAdd('word', 'w1', { ko_ok: true })
    O.outboxAdd('word', 'w1', { attempted: true })
    O.outboxAdd('daily', 'm1', { done: 1 })
    O.outboxAdd('daily', 'm1', { done: 2 })
    expect(O.outboxSize()).toBe(2)
    const sent = []
    await O.outboxFlush(async (kind, id, patch) => { sent.push([kind, id, patch]) })
    expect(sent).toEqual([['word', 'w1', { ko_ok: true, attempted: true }], ['daily', 'm1', { done: 2 }]])
    expect(O.outboxSize()).toBe(0)
  })
  it('인터넷 오류면 멈추고 남겨 둔다', async () => {
    O.outboxAdd('word', 'w2', { en_ok: true })
    const ok = await O.outboxFlush(async () => { throw new Error('인터넷 연결을 확인해 주세요') })
    expect(ok).toBe(false)
    expect(O.outboxSize()).toBe(1)
  })
})

describe('브라우저 판별(발음 퀴즈는 아이폰에선 사파리)', async () => {
  const B = await import('../src/lib/browser.js')
  const as = (ua, standalone = false) => {
    const nav = { userAgent: ua, maxTouchPoints: 5, standalone }
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true })
    globalThis.window = { navigator: nav, matchMedia: () => ({ matches: standalone }) }
  }
  it('아이폰 사파리만 그 자리에서, 홈 화면 앱·카톡·크롬은 사파리로', () => {
    as('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')
    expect(B.pronHereOK(true)).toBe(true)
    as('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', true)
    expect(B.pronHereOK(true)).toBe(false)
    as('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5')
    expect(B.isKakao()).toBe(true); expect(B.pronHereOK(true)).toBe(false)
    as('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1')
    expect(B.pronHereOK(true)).toBe(false)
  })
  it('안드로이드 크롬은 그 자리에서, 카톡 안은 크롬으로', () => {
    as('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36')
    expect(B.pronHereOK(true)).toBe(true)
    as('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 KAKAOTALK 10.8.5')
    expect(B.pronHereOK(true)).toBe(false)
  })
})

import { ipaFromMap } from '../src/lib/ipa.js'
import { readFileSync } from 'fs'
describe('발음기호', () => {
  const map = JSON.parse(readFileSync(new URL('../public/ipa-v1.json', import.meta.url)))
  it('기본 단어', () => expect(ipaFromMap('Happy', map)).toBe('/ˈhæpi/'))
  it('r·l은 일반 글자로', () => expect(ipaFromMap('library', map)).toBe('/ˈlaɪbrɛˌri/'))
  it('영국식 철자도 찾음', () => expect(ipaFromMap('organise', map)).toBe(ipaFromMap('organize', map)))
  it('구는 낱말마다 이어 붙임', () => expect(ipaFromMap('look after', map)).toMatch(/^\/\S+ \S+\/$/))
  it('없으면 빈 값', () => expect(ipaFromMap('zzqqx', map)).toBe(''))
  it('기본 어휘 대부분에 발음기호가 있음', () => {
    const lv = JSON.parse(readFileSync(new URL('../src/data/levels.json', import.meta.url)))
    const all = Object.values(lv).flat()
    expect(all.filter((w) => ipaFromMap(w, map)).length / all.length).toBeGreaterThan(0.98)
  })
})

import { levelProgress } from '../src/lib/levels.js'
describe('레벨업 게이지', () => {
  const w = (word, k, e, s) => ({ word, ko_ok: k, en_ok: e, sp_ok: s })
  it('퀴즈 하나 통과마다 1점, 단어당 최대 3점', () => {
    const p = levelProgress([w('zzword', true, true, false), w('qqword', true, true, true)], 'L4')
    expect(p.xp).toBe(5); expect(p.need).toBe(120); expect(p.nextLabel).toBe('Lv.05'); expect(p.full).toBe(false)
  })
  it('지금 레벨보다 쉬운 단어는 세지 않음', () => {
    const easy = JSON.parse(readFileSync(new URL('../src/data/levels.json', import.meta.url))).L1[0]
    expect(levelProgress([w(easy, true, true, true)], 'L4').xp).toBe(0)
    expect(levelProgress([w(easy, true, true, true)], 'L1').xp).toBe(3)
  })
  it('다 채우면 레벨업 가능, Lv.10은 다음 레벨 없음', () => {
    const many = Array.from({ length: 30 }, (_, i) => w('xx' + i, true, true, true))
    expect(levelProgress(many, 'L1').full).toBe(true)
    expect(levelProgress(many, 'L10').next).toBe(null)
    expect(levelProgress(many, 'm').label).toBe('Lv.04')
  })
})

import { gnawDays, pickGnawWords, gnawEat } from '../src/lib/study.js'
describe('갉아먹기 장면', () => {
  it('이틀 이상 쉬었을 때만(알림으로 오면 하루도)', () => {
    expect(gnawDays({ last_study: '2026-10-13' }, '2026-10-16')).toBe(3)
    expect(gnawDays({ last_study: '2026-10-15' }, '2026-10-16')).toBe(0)
    expect(gnawDays({ last_study: '2026-10-15' }, '2026-10-16', true)).toBe(1)
    expect(gnawDays({ last_study: '2026-10-16' }, '2026-10-16', true)).toBe(0)
    expect(gnawDays({ last_study: null }, '2026-10-16', true)).toBe(0)
  })
  it('복습할 단어 먼저, 구·짧은 단어 제외, 최대 3개', () => {
    const ws = [
      { id: 1, word: 'ox', ko_ok: true, en_ok: true, sp_ok: true, next_review: '2026-10-01' },
      { id: 2, word: 'look after', ko_ok: true },
      { id: 3, word: 'library', ko_ok: true, en_ok: true, sp_ok: true, next_review: '2026-10-10' },
      { id: 4, word: 'tiger' }, { id: 5, word: 'happy', en_ok: true }, { id: 6, word: 'apple' },
    ]
    const p = pickGnawWords(ws, '2026-10-16')
    expect(p.map((w) => w.id)[0]).toBe(3)
    expect(p.length).toBe(3)
    expect(p.some((w) => w.id === 1 || w.id === 2)).toBe(false)
  })
  it('먹는 글자 수: 절반 남짓, 앞 2글자는 남김', () => {
    expect(gnawEat('library')).toBe(4); expect(gnawEat('cat')).toBe(1); expect(gnawEat('fortune')).toBe(4)
  })
})

import { weekStart, familyWeekRank, examPlan, daysUntil } from '../src/lib/study.js'
describe('가족 주간 순위', () => {
  it('월요일부터', () => {
    expect(weekStart('2026-10-16')).toBe('2026-10-12') // 금 → 월
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
    expect(weekStart('2026-10-18')).toBe('2026-10-12') // 일
  })
  it('목표가 달라도 %로 공평하게, 이번 주 가입자는 가입일부터', () => {
    const ms = [
      { id: 'a', daily_goal: 10, created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', daily_goal: 5, created_at: '2026-10-15T00:00:00Z' },
    ]
    const rows = [
      { member_id: 'a', day: '2026-10-12', done: 10 }, { member_id: 'a', day: '2026-10-13', done: 30 },
      { member_id: 'b', day: '2026-10-15', done: 5 }, { member_id: 'b', day: '2026-10-16', done: 5 },
    ]
    const r = familyWeekRank(ms, rows, '2026-10-16')
    expect(r[0].m.id).toBe('b'); expect(r[0].pct).toBe(100)
    expect(r[1].pct).toBe(40) // (10+10)/(10*5)
  })
})
describe('시험 대비 분량', () => {
  const ws = Array.from({ length: 10 }, (_, i) => ({ id: 'w' + i, seq: i, ko_ok: i < 2, en_ok: i < 2 }))
  it('남은 날로 나눔(오늘 포함)', () => {
    const p = examPlan({ exam_date: '2026-10-20', word_ids: ws.map((w) => w.id) }, ws, '2026-10-16')
    expect(p.dday).toBe(4); expect(p.ready).toBe(2); expect(p.today.length).toBe(2) // 8개 ÷ 4일
  })
  it('시험 당일·전날은 남은 것 전부, 지나면 0', () => {
    expect(examPlan({ exam_date: '2026-10-17', word_ids: ws.map((w) => w.id) }, ws, '2026-10-16').today.length).toBe(8)
    expect(examPlan({ exam_date: '2026-10-16', word_ids: ws.map((w) => w.id) }, ws, '2026-10-16').today.length).toBe(8)
    expect(examPlan({ exam_date: '2026-10-15', word_ids: ws.map((w) => w.id) }, ws, '2026-10-16').today.length).toBe(0)
  })
  it('지운 단어는 빼고 셈', () => {
    expect(examPlan({ exam_date: '2026-10-20', word_ids: ['w0', 'gone'] }, ws, '2026-10-16')).toMatchObject({ total: 1, missing: 1 })
    expect(daysUntil('2026-11-01', '2026-10-30')).toBe(2)
  })
})

import { petState, wearing } from '../src/lib/pet.js'
describe('캐릭터 키우기', () => {
  const ws = (n) => Array.from({ length: n }, () => ({ ko_ok: true, en_ok: true, sp_ok: true }))
  it('퀴즈 통과 수로 자람', () => {
    expect(petState([]).name).toBe('아기')
    expect(petState(ws(5)).name).toBe('꼬마') // 15
    expect(petState(ws(5)).unlocked).toEqual(['ribbon'])
    expect(petState(ws(100)).name).toBe('전설')
    expect(petState(ws(100)).next).toBe(null)
    expect(petState(ws(4)).toNext).toBe(3)
  })
  it('착용은 풀린 것만', () => {
    expect(wearing({ wear: ['crown', 'ribbon'] }, ['ribbon'])).toEqual(['ribbon'])
    expect(wearing(null, ['ribbon', 'glasses'])).toEqual(['ribbon', 'glasses'])
    expect(wearing({ wear: [] }, ['ribbon'])).toEqual([])
  })
})

describe('오답노트 3단계 다시 익히기 + 날짜 간격 졸업', () => {
  const T = '2026-10-16'
  const w = (o) => ({ ...base, id: 'w', wrong_modes: ['ko'], wrong_step: 0, wrong_next: null, wrong_grad: 0, ...o })
  it('보내면 처음부터(오늘 바로)', () => {
    expect(sendToWrongNote({ wrong_modes: [], wrong_step: 2, wrong_next: '2026-10-20' }, 'en')).toEqual({ wrong_modes: ['en'], wrong_step: 0, wrong_next: null })
  })
  it('오늘 볼 단어 판정', () => {
    expect(wrongDue(w(), T)).toBe(true)
    expect(wrongDue(w({ wrong_next: T }), T)).toBe(true)
    expect(wrongDue(w({ wrong_next: '2026-10-17' }), T)).toBe(false)
    expect(wrongDue(w({ wrong_modes: [] }), T)).toBe(false)
  })
  it('1번째 맞힘 → 3일 뒤, 2번째 → 7일 뒤, 3번째 → 졸업', () => {
    const a = applyWrongResult(w(), true, T)
    expect(a).toEqual({ wrong_step: 1, wrong_next: '2026-10-19' })
    const b = applyWrongResult(w(a), true, '2026-10-19')
    expect(b).toEqual({ wrong_step: 2, wrong_next: '2026-10-26' })
    const c = applyWrongResult(w(b), true, '2026-10-26')
    expect(c).toEqual({ wrong_modes: [], wrong_step: 0, wrong_next: null, wrong_grad: 1 })
    expect(WRONG_GOAL).toBe(3)
  })
  it('틀리면 처음부터(오늘 다시 가능)', () => {
    expect(applyWrongResult(w({ wrong_step: 2, wrong_next: T }), false, T)).toEqual({ wrong_step: 0, wrong_next: null })
  })
  it('다시 볼 순서와 다음 만남', () => {
    const list = [w({ id: 'a', wrong_next: T, wrong_step: 1 }), w({ id: 'b' }), w({ id: 'c', wrong_next: '2026-10-19' }), w({ id: 'd', wrong_next: '2026-10-19' }), w({ id: 'e', wrong_next: '2026-10-25' })]
    expect(wrongDueList(list, T).map((x) => x.id)).toEqual(['b', 'a'])
    expect(wrongNextVisit(list, T)).toEqual({ day: '2026-10-19', count: 2 })
    expect(wrongNextVisit([w()], T)).toBeNull()
  })
  it('뜻 보기는 정답 포함, 같은 뜻 중복 없음', () => {
    const words = [w({ id: 'a', meaning: '사과' }), w({ id: 'b', meaning: '사과' }), w({ id: 'c', meaning: '배' }), w({ id: 'd', meaning: '감' }), w({ id: 'e', meaning: '귤' })]
    const ch = meaningChoices(words[0], words)
    expect(ch).toContain('사과')
    expect(ch.length).toBe(4)
    expect(new Set(ch).size).toBe(4)
    expect(meaningChoices(words[0], [words[0]])).toEqual(['사과'])
  })
  it('졸업한 단어는 캐릭터가 2번 더 먹음', () => {
    expect(petState([{ ko_ok: true, wrong_grad: 1 }]).food).toBe(3)
  })
})

describe('이름은 한 달에 한 번', () => {
  it('처음엔 바꿀 수 있음', () => expect(nameLocked(null)).toBeNull())
  it('바꾼 뒤 한 달 동안 잠김', () => {
    const at = new Date(Date.UTC(2026, 9, 16, 12, 0)).toISOString()
    expect(nameLocked(at, new Date(Date.UTC(2026, 10, 16, 11, 59)))).not.toBeNull()
    expect(nameLocked(at, new Date(Date.UTC(2026, 10, 16, 12, 1)))).toBeNull()
  })
  it('말일은 다음 달 말일로', () => {
    const n = nameNextChange(new Date(Date.UTC(2026, 0, 31, 9)).toISOString())
    expect([n.getUTCMonth(), n.getUTCDate()]).toEqual([1, 28])
  })
})

describe('오늘의 단어 수는 하루 목표로 고정', async () => {
  const S = await import('../src/lib/study.js')
  const mk = (i, o = {}) => ({ id: 'w' + i, seq: i, word: 'w' + i, ko_ok: false, en_ok: false, sp_ok: false, ...o })
  const words = Array.from({ length: 30 }, (_, i) => mk(i + 1))
  it('저장된 세트가 목표보다 많으면 뒤에서부터 덜어 냄(오늘 푼 단어는 남김)', () => {
    const saved = words.slice(0, 22).map((w) => w.id)
    const r = S.resolveTodaySet(words, saved, 10, ['w20', 'w21'])
    expect(r.length).toBe(10)
    expect(r).toContain('w20'); expect(r).toContain('w21')
    expect(r.slice(0, 8)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'])
  })
  it('새 단어 더 하기(extra)만큼은 늘어남', () => {
    expect(S.resolveTodaySet(words, [], 10, [], 5).length).toBe(15)
  })
  it('단어장에서 보낸 단어는 맨 앞, 개수는 그대로, 안 푼 단어가 빠짐', () => {
    const cur = ['w1', 'w2', 'w3', 'w4']
    const { ids, dropped } = S.sendToSet(cur, 'w9', 4, ['w4'])
    expect(ids).toEqual(['w9', 'w1', 'w2', 'w4'])
    expect(dropped).toEqual(['w3'])
  })
  it('이미 있으면 그대로', () => {
    expect(S.sendToSet(['w1'], 'w1', 1).dropped).toEqual([])
  })
  it('연달아 보내면 보낸 단어들이 앞에 쌓임', () => {
    let ids = ['w1', 'w2', 'w3']
    ids = S.sendToSet(ids, 'w8', 3).ids
    ids = S.sendToSet(ids, 'w9', 3).ids
    expect(ids).toEqual(['w9', 'w8', 'w1'])
  })
})

describe('새 날 오늘의 단어', async () => {
  const { resolveTodaySet } = await import('../src/lib/study.js')
  const ws = Array.from({ length: 30 }, (_, i) => ({ id: 'w' + i, seq: i, ko_ok: i < 3, en_ok: false, sp_ok: false }))
  it('어제 세트(다 못 끝낸 단어)는 뒤로 미루고 다음 단어부터', () => {
    const yesterday = ws.slice(0, 10).map((w) => w.id)
    const set = resolveTodaySet(ws, [], 10, [], 0, yesterday)
    expect(set).toHaveLength(10)
    expect(set.some((id) => yesterday.includes(id))).toBe(false)
  })
  it('다른 단어가 모자라면 어제 단어로 채움', () => {
    const few = ws.slice(0, 12)
    const set = resolveTodaySet(few, [], 10, [], 0, few.slice(0, 10).map((w) => w.id))
    expect(set.slice(0, 2)).toEqual(['w10', 'w11'])
    expect(set).toHaveLength(10)
  })
})

describe('AI 없이: 내장 어휘 데이터·연관 추천', async () => {
  const { loadVocab, vocabEnrich, vocabPron } = await import('../src/lib/vocab.js')
  const { relatedPick } = await import('../src/lib/levels.js')
  const map = await loadVocab()
  it('기본 어휘 2,898개가 모두 들어 있음', () => { expect(map.size).toBe(2898) })
  it('유의어·반의어·예문·허용 답안(교재 뜻 포함)', () => {
    const d = vocabEnrich(map, 'Happy', '행복한, 기쁜')
    expect(d.syn.word).toBeTruthy(); expect(d.example.en.toLowerCase()).toContain('happy')
    expect(d.accepted).toContain('행복한'); expect(d.accepted).toContain('기쁜')
    expect(vocabEnrich(map, 'zzqword', '')).toBe(null)
  })
  it('발음 요령: 음절·강세·한글 흉내, 잘못 들린 말이면 조언', () => {
    const p = vocabPron(map, 'library', 'lie bury', '/ˈlaɪˌbrɛri/')
    expect(p.syllables.join('').toLowerCase()).toBe('library')
    expect(p.syllables[p.stress]).toBe(p.syllables[p.stress].toUpperCase())
    expect(p.ko).toMatch(/[가-힣]/); expect(p.mistake).toContain('lie bury')
    expect(vocabPron(map, 'library', 'library').mistake).toBe('')
  })
  it('연관 추천: 가진 단어는 빼고, 최근 단어 주변(같은 주제)에서', () => {
    const r = relatedPick(['cat', 'red'], new Set(['cat', 'red', 'dog']), 'seed', 5)
    expect(r).toHaveLength(5)
    expect(r.some((x) => x.word === 'dog')).toBe(false)
    expect(new Set(r.map((x) => x.from)).size).toBe(2)
  })
})

describe('틀린 철자 비교', async () => {
  const { spellDiff } = await import('../src/lib/grading.js')
  const show = (a, b) => spellDiff(a, b).map((c) => (c.ok ? c.ch : c.miss ? '_' : `[${c.ch}]`)).join('')
  it('틀린 글자·빠진 글자 표시', () => {
    expect(show('mesure', 'measure')).toBe('me_sure')
    expect(show('meazure', 'measure')).toBe('mea[z]_ure'.replace('[z]_', '[z]_'))
    expect(show('measure', 'measure')).toBe('measure')
    expect(show('Measur', 'measure')).toBe('Measur_')
  })
})
