import { useState } from 'react'
import type { QuizQuestion } from '../../data/questions'

export type { QuizOption, QuizQuestion } from '../../data/questions'

export default function QuizModal({
  index,
  total,
  question,
  onSubmit,
}: {
  /** 当前题号（从 1 开始） */
  index: number
  total: number
  question: QuizQuestion
  /** 提交所选选项字母（单选 1 个，多选多个），由父组件判题 */
  onSubmit: (selectedKeys: string[]) => void
}) {
  const multiple = question.type === 'multiple'
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (key: string) => {
    if (multiple) {
      setSelected((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      )
    } else {
      setSelected([key])
    }
  }

  const isChosen = (key: string) => selected.includes(key)
  const pad = (n: number) => String(n).padStart(2, '0')

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
          {question.options.map((opt) => (
            <li key={opt.key}>
              <button
                type="button"
                className={`epi-option ${isChosen(opt.key) ? 'is-selected' : ''}`}
                onClick={() => toggle(opt.key)}
              >
                <span className={`epi-option-key ${isChosen(opt.key) ? 'is-selected' : ''}`}>
                  {opt.key}
                </span>
                <span className="epi-option-text">{opt.text}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* 提交 */}
        <button
          type="button"
          className="epi-quiz-submit"
          disabled={selected.length === 0}
          onClick={() => onSubmit(selected)}
        >
          提交
        </button>
      </section>
    </div>
  )
}
