import { useState } from 'react'

export interface QuizOption {
  /** 选项字母，如 A / B / C */
  key: string
  text: string
}

export default function QuizModal({
  index,
  total,
  question,
  options,
  onSubmit,
}: {
  /** 当前题号（从 1 开始） */
  index: number
  total: number
  question: string
  options: QuizOption[]
  onSubmit: (selectedIndex: number) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)

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
          <span className="epi-quiz-type">单选题</span>
        </div>

        {/* 题干 */}
        <h2 className="epi-quiz-question">
          <span className="epi-quiz-qdot" />
          {question}
        </h2>

        {/* 选项列表 */}
        <ul className="epi-quiz-options">
          {options.map((opt, i) => (
            <li key={opt.key}>
              <button
                type="button"
                className={`epi-option ${selected === i ? 'is-selected' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className={`epi-option-key ${selected === i ? 'is-selected' : ''}`}>
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
          disabled={selected === null}
          onClick={() => selected !== null && onSubmit(selected)}
        >
          提交
        </button>
      </section>
    </div>
  )
}
