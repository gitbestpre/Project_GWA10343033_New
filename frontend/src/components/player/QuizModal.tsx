import { useLayoutEffect, useRef, useState } from 'react'
import type { QuizQuestion } from '../../data/questions'

export type { QuizOption, QuizQuestion } from '../../data/questions'

/** 判题结果：correct=是否回答正确；countdown=答错后停留倒计时（秒），答对立即跳转不传 */
export interface QuizResult {
  correct: boolean
  countdown?: number
  /**
   * 用户提交的选项字母。评审态（review）必须传，用于回显用户当时的选择；
   * 首次作答时不必传 —— 组件内部的 `selected` 已经是用户所选项。
   */
  selectedKeys?: string[]
  /**
   * 评审态：该题**之前已经答过**（每题只做一次），本次只是重走阶段时回显，
   * 不可再作答、不重复计分。此时展示「你的答案 + 正确答案」并以 countdown 推进。
   */
  review?: boolean
}

export default function QuizModal({
  index,
  total,
  question,
  result,
  onSubmit,
  successText = '回答正确，即将进入下一步……',
}: {
  /** 当前题号（从 1 开始） */
  index: number
  total: number
  question: QuizQuestion
  /** 提交后的判题结果；null 表示尚未提交（可作答） */
  result?: QuizResult | null
  /** 提交所选选项字母（单选 1 个，多选多个），由父组件判题 */
  onSubmit: (selectedKeys: string[]) => void
  /** 答对结果条文案（链路终点题可传“本环节考核完成”等） */
  successText?: string
}) {
  const multiple = question.type === 'multiple'
  const [selected, setSelected] = useState<string[]>([])

  // 题干可能折成两行（如 H_03），测量后给卡片加修饰类，选项/提交按钮整体下移避免重叠
  const questionRef = useRef<HTMLHeadingElement>(null)
  const [longQuestion, setLongQuestion] = useState(false)
  useLayoutEffect(() => {
    const el = questionRef.current
    if (!el) return
    const measure = () => setLongQuestion(el.offsetHeight > 42)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [question.id])

  // 提交后锁定，进入判题结果展示（高亮正确/错选，不可再改）；
  // 评审态（本题之前已答过）挂载即锁定，且用记录里的选择回显，无需用户再点。
  const locked = result != null
  const review = result?.review === true
  /** 实际高亮的选项集合：评审态取回显值，首次作答取组件内部状态 */
  const chosenKeys = result?.selectedKeys ?? selected

  const toggle = (key: string) => {
    if (locked) return
    if (multiple) {
      setSelected((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      )
    } else {
      setSelected([key])
    }
  }

  const isChosen = (key: string) => chosenKeys.includes(key)
  const isAnswer = (key: string) => question.answerKeys.includes(key)
  const isWrongPick = (key: string) => locked && isChosen(key) && !isAnswer(key)
  const pad = (n: number) => String(n).padStart(2, '0')
  const answerText = question.answerKeys.join('、')
  /** 用户所选项字母，按选项原始顺序排列（与正确答案对照更直观） */
  const chosenText = question.options
    .filter((o) => chosenKeys.includes(o.key))
    .map((o) => o.key)
    .join('、')

  return (
    <div className="epi-quiz-mask">
      <section
        className={`epi-quiz${longQuestion ? ' is-long-q' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="知识考核"
      >
        {/* 头部：知识考核 + 页码 + 题型徽标 */}
        <div className="epi-quiz-head">
          <div className="epi-quiz-title">
            <span className="epi-quiz-name">知识考核</span>
            <span className="epi-quiz-page">
              <span className="epi-quiz-page-now">{pad(index)}</span>
              <span className="epi-quiz-page-total"> / {pad(total)}</span>
            </span>
          </div>
          <span className="epi-quiz-type">{review ? '已作答' : multiple ? '多选题' : '单选题'}</span>
        </div>

        {/* 题干 */}
        <h2 className="epi-quiz-question" ref={questionRef}>
          <span className="epi-quiz-qdot" />
          {question.question}
        </h2>

        {/* 选项列表 */}
        <ul className="epi-quiz-options">
          {question.options.map((opt) => {
            const correct = locked && isAnswer(opt.key)
            const wrong = isWrongPick(opt.key)
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  className={[
                    'epi-option',
                    isChosen(opt.key) ? 'is-selected' : '',
                    correct ? 'is-correct' : '',
                    wrong ? 'is-wrong' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={locked}
                  onClick={() => toggle(opt.key)}
                >
                  <span
                    className={[
                      'epi-option-key',
                      isChosen(opt.key) ? 'is-selected' : '',
                      correct ? 'is-correct' : '',
                      wrong ? 'is-wrong' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {opt.key}
                  </span>
                  <span className="epi-option-text">{opt.text}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* 提交按钮（未判题时） */}
        {!locked && (
          <button
            type="button"
            className="epi-quiz-submit"
            disabled={selected.length === 0}
            onClick={() => onSubmit(selected)}
          >
            提交
          </button>
        )}

        {/* 判题结果条：
            · 评审态 —— 展示「你的答案 + 正确答案」，停留 countdown 秒后推进（每题只做一次）；
            · 首次答错 —— 展示正确答案并倒计时停留；
            · 首次答对 —— 立即跳转，基本不可见。 */}
        {locked && (
          <div
            className={`epi-quiz-result ${result?.correct ? 'is-ok' : 'is-bad'}${
              review ? ' is-review' : ''
            }`}
          >
            {review ? (
              <>
                <span className="epi-quiz-result-text">
                  已作答 · 你的答案：<b>{chosenText}</b>　正确答案：<b>{answerText}</b>
                </span>
                {result?.countdown != null && (
                  <span className="epi-quiz-result-count">
                    {result.countdown} 秒后进入下一步
                  </span>
                )}
              </>
            ) : result?.correct ? (
              <span className="epi-quiz-result-text">{successText}</span>
            ) : (
              <>
                <span className="epi-quiz-result-text">
                  回答错误，正确答案：<b>{answerText}</b>
                </span>
                {result?.countdown != null && (
                  <span className="epi-quiz-result-count">
                    {result.countdown} 秒后进入下一步
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
