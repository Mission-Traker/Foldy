import { describe, it, expect } from 'vitest'
import { gradeMeaning, gradeSpelling, gradeSpeech, normalizeKo } from '../src/lib/grading.js'
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

describe('발음 채점', () => {
  it('후보 중 하나라도 일치', () => expect(gradeSpeech(['apples', 'Apple'], 'apple')).toBe(true))
  it('문장 속 단어 인식', () => expect(gradeSpeech(['an apple'], 'apple')).toBe(true))
  it('다른 단어는 실패', () => expect(gradeSpeech(['banana'], 'apple')).toBe(false))
  it('짧은 단어는 오인식 허용 안 함', () => expect(gradeSpeech(['rad'], 'red')).toBe(false))
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
  it('○이면 유의어·반의어 단계', () => expect(expandStage({ ...o, syn: {}, ant: {} })).toBe('synant'))
  it('둘 다 맞히면 예문', () => expect(expandStage({ ...o, syn: {}, ant: {}, syn_ok: true, ant_ok: true })).toBe('example'))
  it('반의어가 없는 단어는 유의어만 맞혀도 예문', () => expect(expandStage({ ...o, syn: {}, ant: null, syn_ok: true })).toBe('example'))
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
  it('못 맞힌 단어 먼저, 개수 제한', () => {
    const ws = Array.from({ length: 15 }, (_, i) => ({ ...base, id: i, ko_ok: i < 10 }))
    const q = pickQuiz(ws, 'ko', 8)
    expect(q.length).toBe(8)
    expect(q.slice(0, 5).every((w) => !w.ko_ok)).toBe(true)
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
