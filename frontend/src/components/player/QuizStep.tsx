import { useEffect, useState } from 'react'
import QuizModal, { type QuizResult } from './QuizModal'
import { getQuestionById } from '../../data/questions'
import {
  WRONG_HOLD_SECONDS,
  judgeAndRecord,
  reviewResultOf,
  useWrongHoldCountdown,
} from './quizShared'

/**
 * 单步知识考核：内部封装判题与答错 5 秒倒计时。
 * - 答对：立即调用 onAdvance() 进入下一阶段；
 * - 答错：锁定并高亮正确答案，停留 5 秒后自动调用 onAdvance()。
 * - **已答过的题**（每题只做一次）：挂载即进入评审态，回显「你的答案 + 正确答案」，
 *   停留 5 秒后调用 onAdvance()，不重复计分。
 *
 * **判题节奏与《WRONG_HOLD_SECONDS / 倒计时》统一放在 `quizShared.ts`** ——
 * 实验室检测页的非模态侧栏 `QuizRail` 也复用同一套，避免两处各写一份。
 *
 * 用 key={qid} 挂载可保证切题时内部作答/倒计时状态全部重置
 * （也因此评审态的懒初始化每次切题只算一次）。
 */
export default function QuizStep({
  qid,
  index,
  total,
  onAdvance,
  successText = '回答正确，即将进入下一步……',
}: {
  /** 题号，如 H_08 */
  qid: string
  /** 当前题号（从 1 开始）与总题数，用于弹窗右上角 01/02 页码 */
  index: number
  total: number
  /** 本题流程结束（答对即时 / 答错倒计时结束 / 评审态停留结束）后进入下一阶段 */
  onAdvance: () => void
  /** 答对结果条文案 */
  successText?: string
}) {
  const question = getQuestionById(qid)
  // 懒初始化：已答过的题直接以评审态挂载（不可再作答、不重复计分）
  const [result, setResult] = useState<QuizResult | null>(() => reviewResultOf(qid))
  const [countdown, setCountdown] = useState(WRONG_HOLD_SECONDS)

  // 题库缺题保护：正常不应发生，缺题直接放行避免卡死流程
  useEffect(() => {
    if (!question) {
      const t = window.setTimeout(onAdvance, 0)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  // 倒计时：评审态一律停留（无论当初对错），首次答错才停留；归零后进入下一步
  useWrongHoldCountdown(
    !!result && (result.review === true || !result.correct),
    countdown,
    setCountdown,
    onAdvance,
  )

  if (!question) return null

  const handleSubmit = (selectedKeys: string[]) => {
    // 判题的同时记账（每题只做一次，幂等）
    if (judgeAndRecord(question, selectedKeys)) {
      setResult({ correct: true })
      onAdvance()
    } else {
      setResult({ correct: false, countdown: WRONG_HOLD_SECONDS })
      setCountdown(WRONG_HOLD_SECONDS)
    }
  }

  return (
    <QuizModal
      index={index}
      total={total}
      question={question}
      result={result ? { ...result, countdown } : null}
      onSubmit={handleSubmit}
      successText={successText}
    />
  )
}
