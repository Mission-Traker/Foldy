import { describe, it, expect } from 'vitest'
import { gradeMeaning, gradeSpelling, gradeSpeech, normalizeKo, speechScore, soundKey } from '../src/lib/grading.js'
import {
  statusOf, applyAnswer, applyReview, sortWords, pickQuiz, nextStreak, cleanEntry,
  expandStage, isDue, sendToWrongNote, addDays,
} from '../src/lib/study.js'
import { dailyPick, recommendLevel, wordsOfLevel, levelTestSet } from '../src/lib/levels.js'

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
  it('오답노트 모드를 맞히면 오답노트에서 빠짐', () => {
    const p = applyAnswer({ ...base, wrong_modes: ['ko', 'sp'] }, 'ko', true)
    expect(p.wrong_modes).toEqual(['sp'])
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
    expect(recommendLevel([{ level: 'e1', known: 5 }, { level: 'e3', known: 4 }, { level: 'e5', known: 2 }])).toBe('e5')
  })
  it('진단 세트는 5레벨 × 5단어', () => {
    const s = levelTestSet('x')
    expect(s.length).toBe(5)
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

import { mergePatchResult, enqueue } from '../src/lib/study.js'
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
