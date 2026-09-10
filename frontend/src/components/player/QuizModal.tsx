import { useState } from 'react'
import type { QuizQuestion } from '../../data/questions'

export type { QuizOption, QuizQuestion } from '../../data/questions'

/** 判题结果：correct=是否回答正确；countdown=答错后停留倒计时（秒），答对立即跳转不传 */
export interface QuizResult {
  correct: boolean
  countdown?: number
}

export default function QuizModal({
  index,
  total,
  question,
  result,
  onSubmit,
}: {
  /** 当前题号（从 1 开始） */
  index: number
  total: number
  question: QuizQuestion
  /** 提交后的判题结果；null 表示尚未提交（可作答） */
  result?: QuizResult | null
  /** 提交所选选项字母（单选 1 个，多选多个），由父组件判题 */
  onSubmit: (selectedKeys: string[]) => void
}) {
  const multiple = question.type === 'multiple'
  const [selected, setSelected] = useState<string[]>([])

  // 提交后锁定，进入判题结果展示（高亮正确/错选，不可再改）
  const locked = result != null

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

  const isChosen = (key: string) => selected.includes(key)
  const isAnswer = (key: string) => question.answerKeys.includes(key)
  const isWrongPick = (key: string) => locked && isChosen(key) && !isAnswer(key)
  const pad = (n: number) => String(n).padStart(2, '0')
  const answerText = question.answerKeys.join('、')

  return (
    <div className="epi-quiz-mask">
      <section className="epi-quiz" role="dialog" aria-modal="true" aria-label="知识考核">
        {/* 头部：知识考核 + 页码 + 题型徽标 */}
        <div className="epi-quiz-head">
          <div className="epi-quiz-title">
            <span className="epi-quiz-name">知识考核</span>
            <span className="epi-quiz-page">
              <span className="epi-quiz-page-now">{pad(index)}</span>
              <span className="epi-quiz-page-total"> / {pad(total)}</span>
            </span>
          </div>
          <span className="epi-quiz-type">{multiple ? '多选题' : '单选题'}</span>
        </div>

        {/* 题干 */}
        <h2 className="epi-quiz-question">
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

        {/* 判题结果条：答错时展示正确答案并倒计时停留；答对瞬间即跳转，基本不可见 */}
        {locked && (
          <div className={`epi-quiz-result ${result?.correct ? 'is-ok' : 'is-bad'}`}>
            {result?.correct ? (
              <span className="epi-quiz-result-text">回答正确，即将进入下一步……</span>
            ) : (
              <>
                <span className="epi-quiz-result-text">
                  回答错误，正确答案：<b>{answerText}</b>
                </span>
                <span className="epi-quiz-result-count">
                  {result?.countdown ?? 0} 秒后进入下一步
                </span>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
