import { useEffect, useRef } from 'react'

/**
 * 问询后两题考核完成时的处置反馈弹窗（对齐 Figma 179:475 / 节点 288:488）。
 * 1000×600 白卡：标题“市场监管局经风险研判” + 处置说明正文 + 居中“我已了解”按钮。
 * 弹窗出现时同步播放处置说明语音 02.mp3，离开（我已了解/关闭）即停止。
 */
const FEEDBACK_TITLE = '市场监管局经风险研判'

/** 反馈弹窗同步播放的处置说明语音 */
const FEEDBACK_AUDIO = '/Audio/现场流行病学调查/02.mp3'

const FEEDBACK_TEXT =
  '如区市场监管局经风险研判，需疾控中心开展流行病学调查，应立即通知区卫生行政部门应急值班室，' +
  '由区卫生行政部门相应科室通知疾控中心对该起疑似食源性疾病事件开展流行病学调查。' +
  '疾控中心应急值班室或值班医师接到电话后，应立即向疾控中心分管领导汇报。'

export default function PostFeedbackModal({ onAck }: { onAck: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  // 弹窗出现即自动播放处置说明语音，离开（我已了解/关闭）时停止
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = 0
    el.play().catch(() => {})
    return () => {
      el.pause()
      el.currentTime = 0
    }
  }, [])

  return (
    <div className="pf-mask">
      {/* 处置说明语音（隐藏控件，仅发声） */}
      <audio ref={audioRef} src={FEEDBACK_AUDIO} preload="auto" />

      <section className="pf-card" role="alertdialog" aria-modal="true" aria-label={FEEDBACK_TITLE}>
        {/* 标题栏 */}
        <div className="pf-head">
          <span className="pf-head-bar" />
          <span className="pf-head-title">{FEEDBACK_TITLE}</span>
        </div>
        <div className="pf-divider" />

        {/* 正文 */}
        <p className="pf-body">{FEEDBACK_TEXT}</p>

        {/* 关闭（等同“我已了解”，离开本环节） */}
        <button type="button" className="pf-close" aria-label="关闭" onClick={onAck}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 3L15 15M15 3L3 15" stroke="#A5B0C5" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* 主操作 */}
        <button type="button" className="pf-ack-btn" onClick={onAck}>
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="30" height="30" rx="7" fill="#FCFCFC" />
            <path
              d="M10 13.5h14M10 17.5h14M10 21.5h9"
              stroke="#618DCF"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span>我已了解</span>
        </button>
      </section>
    </div>
  )
}
