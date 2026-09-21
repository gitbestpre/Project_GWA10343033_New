/**
 * 考核组件「每题只做一次 + 评审态」的组件级验证（配合 lib/quizScore 的计分口径）。
 *
 * 用真实的 `QuizStep`（全屏题卡）驱动，断言四件事：
 *   1. 未答过 → 正常作答（有「提交」按钮），答对后即时前进且题目记录 +6 分；
 *   2. 已答过 → 挂载即评审态：**没有提交按钮**、回显「你的答案 / 正确答案」；
 *   3. 评审态**不重复计分**（得分与记录保持第一次的值）；
 *   4. 评审态停留 5 秒后自动前进（无论当初答对还是答错）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import QuizStep from '../components/player/QuizStep'
import { getRecord, getScore, recordAnswer, resetQuizScore } from '../lib/quizScore'
import { QUESTIONS } from '../data/questions'

const KEY = 'gwa10343033.quiz-score.v1'
/** 取一道单选（答案唯一，便于构造「答对 / 答错」两种历史记录） */
const Q = QUESTIONS.find((q) => q.type === 'single')!
const WRONG_KEY = Q.options.map((o) => o.key).find((k) => !Q.answerKeys.includes(k))!

/** 点选指定选项（按 `.epi-option` 的字母键定位，避免依赖文案） */
function pickOption(key: string) {
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>('.epi-option')).find(
    (el) => el.querySelector('.epi-option-key')?.textContent?.trim() === key,
  )
  expect(btn, `未找到选项 ${key}`).toBeTruthy()
  act(() => btn!.click())
}

/** 点提交 */
function submit() {
  const btn = document.querySelector<HTMLButtonElement>('.epi-quiz-submit')
  if (btn) act(() => btn.click())
}

/**
 * 逐秒推进假时钟。
 * ⚠️ 不能一次 `advanceTimersByTime(5000)`：倒计时是「每次 setState → effect 再挂下一个
 * setTimeout」的链式写法，一次性推进时钟时后续定时器还没被挂上。必须一秒一次，
 * 让 React 在两次 act 之间把状态刷完。
 */
function tickSeconds(n: number) {
  for (let i = 0; i < n; i += 1) {
    act(() => {
      vi.advanceTimersByTime(1000)
    })
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  act(() => resetQuizScore())
  window.sessionStorage.removeItem(KEY)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('QuizStep 首次作答（未答过）', () => {
  it('未答过 → 有「提交」按钮，无评审提示', () => {
    render(<QuizStep qid={Q.id} index={1} total={1} onAdvance={() => {}} />)

    expect(screen.queryByRole('button', { name: '提交' })).toBeTruthy()
    expect(screen.queryByText(/已作答/)).toBeNull()
    expect(screen.queryByText(/你的答案/)).toBeNull()
  })

  it('答对 → 即时前进，且记账 +6 分', () => {
    const onAdvance = vi.fn()
    render(<QuizStep qid={Q.id} index={1} total={1} onAdvance={onAdvance} />)

    for (const k of Q.answerKeys) pickOption(k)
    submit()

    expect(onAdvance).toHaveBeenCalledTimes(1)
    expect(getRecord(Q.id)?.correct).toBe(true)
    expect(getScore()).toBe(6)
  })

  it('答错 → 停在原题等 5 秒，不加分，记录里留用户所选项', () => {
    const onAdvance = vi.fn()
    render(<QuizStep qid={Q.id} index={1} total={1} onAdvance={onAdvance} />)

    pickOption(WRONG_KEY)
    submit()

    expect(onAdvance).not.toHaveBeenCalled()
    expect(getScore()).toBe(0)
    expect(getRecord(Q.id)?.selected).toEqual([WRONG_KEY])
  })
})

describe('QuizStep 评审态（每题只做一次）', () => {
  it('已答过 → 挂载即评审态：无提交按钮，回显你的答案与正确答案', () => {
    act(() => recordAnswer(Q.id, [WRONG_KEY], false))
    render(<QuizStep qid={Q.id} index={1} total={1} onAdvance={() => {}} />)

    expect(screen.queryByRole('button', { name: '提交' })).toBeNull()
    // 右上角徽标由题型变为「已作答」，结果条回显两个答案
    expect(screen.getByText('已作答')).toBeTruthy()
    const line = screen.getByText(/已作答 · 你的答案/).textContent ?? ''
    expect(line).toContain(WRONG_KEY)
    expect(line).toContain(Q.answerKeys.join('、'))
  })

  it('评审态不重复计分（记录与得分保持第一次的值）', () => {
    act(() => recordAnswer(Q.id, [WRONG_KEY], false))
    const before = getScore()
    render(<QuizStep qid={Q.id} index={1} total={1} onAdvance={() => {}} />)

    // 选项被锁定，无法再点（点也不改分）
    const opts = document.querySelectorAll<HTMLButtonElement>('.epi-option')
    for (const o of opts) act(() => o.click())

    expect(getScore()).toBe(before)
    expect(getRecord(Q.id)?.correct).toBe(false)
    expect(getRecord(Q.id)?.selected).toEqual([WRONG_KEY])
  })

  it('评审态停留 5 秒后自动前进（当初答错的题）', () => {
    act(() => recordAnswer(Q.id, [WRONG_KEY], false))
    const onAdvance = vi.fn()
    render(<QuizStep qid={Q.id} index={1} total={1} onAdvance={onAdvance} />)

    // 不到 5 秒不前进
    tickSeconds(4)
    expect(onAdvance).not.toHaveBeenCalled()

    tickSeconds(1)
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('当初答对的题同样是评审态：停 5 秒（不会像首次答对那样一闪而过）', () => {
    act(() => recordAnswer(Q.id, Q.answerKeys, true))
    const onAdvance = vi.fn()
    render(<QuizStep qid={Q.id} index={1} total={1} onAdvance={onAdvance} />)

    expect(screen.queryByRole('button', { name: '提交' })).toBeNull()
    expect(onAdvance).not.toHaveBeenCalled() // 挂载瞬间不前进

    tickSeconds(5)
    expect(onAdvance).toHaveBeenCalledTimes(1)
    expect(getScore()).toBe(6) // 仍只计一次
  })
})
