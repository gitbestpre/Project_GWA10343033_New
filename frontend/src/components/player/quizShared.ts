/**
 * 知识考核的**共享判题口径** —— `QuizStep`（全屏弹窗，走阶段状态机）与
 * `QuizRail`（非模态侧栏，本项目实验室检测页）共用同一套节奏，避免两处各写一份、
 * 日后改一处忘一处（负责人 2026-09-18 明确要求侧栏「复用之前的选择题模块的逻辑」）：
 *
 *   · 答对 → **即时**进入下一步 / 下一题（不留停留，故结果文案基本不可见）；
 *   · 答错 → 锁定并高亮正确答案，**停留 `WRONG_HOLD_SECONDS` 秒**后自动前进。
 *
 * 负责人 2026-09-20 追加计分与「每题只做一次」：
 *   · 判题一律走 `judgeAndRecord` —— 判对错的同时把作答写进 `lib/quizScore`（幂等）；
 *   · 已答过的题重走阶段时走 `reviewResultOf` 回显「你的答案 + 正确答案」，
 *     **停留 `WRONG_HOLD_SECONDS` 秒**后前进（评审态无论对错都停留），不重复计分。
 */
import { useEffect, useRef } from 'react'
import type { QuizQuestion } from '../../data/questions'
import { getRecord, recordAnswer } from '../../lib/quizScore'
import type { QuizResult } from './QuizModal'

/** 答错后正确答案停留时长（秒），到时自动进入下一步 / 下一题（与流行病学播放器一致） */
export const WRONG_HOLD_SECONDS = 5

/** 判断所选集合是否与标准答案集合完全一致（顺序无关，兼容单选/多选） */
export function isCorrectAnswer(selected: string[], answerKeys: string[]): boolean {
  if (selected.length !== answerKeys.length) return false
  return answerKeys.every((k) => selected.includes(k))
}

/**
 * 判题 + 记账（**所有判题处都应走这里**，不要直接调 isCorrectAnswer）：
 * 先判对错，再把作答写入 quizScore。写入是幂等的（每题只做一次），
 * 故阶段重走 / StrictMode 双跑 / 判题函数被重复调用都不会重复加分。
 */
export function judgeAndRecord(question: QuizQuestion, selected: string[]): boolean {
  const correct = isCorrectAnswer(selected, question.answerKeys)
  recordAnswer(question.id, selected, correct)
  return correct
}

/**
 * 该题若**已经答过**，返回评审态结果（回显用户当时的选择 + 正确答案）；
 * 未答过返回 null（正常作答流程）。用于 `useState(reviewResultOf(qid))` 这类懒初始化。
 */
export function reviewResultOf(qid: string): QuizResult | null {
  const rec = getRecord(qid)
  if (!rec) return null
  return {
    correct: rec.correct,
    selectedKeys: rec.selected,
    review: true,
    countdown: WRONG_HOLD_SECONDS,
  }
}

/**
 * 答错后的倒计时：`countdown` 每秒 -1，归零时回调 `advance`。
 * 传 `paused`（侧栏被暂隐、或已被弹窗接管）可挂起计时 —— 否则用户会在弹窗里被悄悄带走。
 * 依赖项全是原始值 + ref，父组件重渲染不会打断 1 秒定时器（`advance` 用 ref 取最新）。
 */
export function useWrongHoldCountdown(
  active: boolean,
  countdown: number,
  setCountdown: (f: (c: number) => number) => void,
  advance: () => void,
  paused = false,
) {
  const advanceRef = useRef(advance)
  useEffect(() => {
    advanceRef.current = advance
  }, [advance])

  useEffect(() => {
    if (!active) return
    if (countdown <= 0) {
      advanceRef.current()
      return
    }
    if (paused) return
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, countdown, paused])
}
