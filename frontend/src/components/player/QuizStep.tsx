import { useEffect, useState } from 'react'
import QuizModal, { type QuizResult } from './QuizModal'
import { getQuestionById } from '../../data/questions'

/** 答错后正确答案停留时长（秒），到时自动进入下一步（与流行病学播放器一致） */
const WRONG_HOLD_SECONDS = 5

/** 判断所选集合是否与标准答案集合完全一致（顺序无关，兼容单选/多选） */
function isCorrectAnswer(selected: string[], answerKeys: string[]) {
  if (selected.length !== answerKeys.length) return false
  return answerKeys.every((k) => selected.includes(k))
}

/**
 * 单步知识考核：内部封装判题与答错 5 秒倒计时。
 * - 答对：立即调用 onAdvance() 进入下一阶段；
 * - 答错：锁定并高亮正确答案，停留 5 秒后自动调用 onAdvance()。
 *
 * 用 key={qid} 挂载可保证切题时内部作答/倒计时状态全部重置。
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
  /** 本题流程结束（答对即时 / 答错倒计时结束）后进入下一阶段 */
  onAdvance: () => void
  /** 答对结果条文案 */
  successText?: string
}) {
  const question = getQuestionById(qid)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [countdown, setCountdown] = useState(WRONG_HOLD_SECONDS)

  // 题库缺题保护：正常不应发生，缺题直接放行避免卡死流程
  useEffect(() => {
    if (!question) {
      const t = window.setTimeout(onAdvance, 0)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  // 答错倒计时：每秒 -1，归零后进入下一步
  useEffect(() => {
    if (!result || result.correct) return
    if (countdown <= 0) {
      onAdvance()
      return
    }
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, countdown])

  if (!question) return null

  const handleSubmit = (selectedKeys: string[]) => {
    if (isCorrectAnswer(selectedKeys, question.answerKeys)) {
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
