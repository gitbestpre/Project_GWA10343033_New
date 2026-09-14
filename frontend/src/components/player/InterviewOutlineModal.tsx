import { useEffect, useRef } from 'react'

const OUTLINE_IMAGE = '/images/epidemiology/interview-outline.png'
const OUTLINE_TITLE = '食品安全事故病例访谈提纲'

/**
 * “记录｜个案调查表”点击后的访谈提纲弹窗（对齐 Figma 301:444）。
 * 1000×881 白卡（圆角 12）：顶部 55px 标题栏（蓝色竖条 + 标题 + 右上关闭 X），
 * 下方为浅蓝 #e8edf5 文档区，内嵌 950 宽白色表单长图（基本信息/临床/流行病学
 * 三部分共 16 项 + 签名行，来自 Figma 301:443），区域高 826px，超出纵向滚动。
 */
export default function InterviewOutlineModal({ onClose }: { onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 打开时回到文档顶部；Esc 关闭
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="io-mask" onClick={onClose}>
      <section
        className="io-card"
        role="dialog"
        aria-modal="true"
        aria-label={OUTLINE_TITLE}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <header className="io-head">
          <span className="io-head-bar" />
          <h2 className="io-head-title">{OUTLINE_TITLE}</h2>
          <button type="button" className="io-close" aria-label="关闭" onClick={onClose}>
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3 3L15 15M15 3L3 15" stroke="#A5B0C5" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* 可滚动文档区 */}
        <div className="io-doc" ref={scrollRef}>
          <img className="io-doc-img" src={OUTLINE_IMAGE} alt="食品安全事故病例访谈提纲（基本信息/临床相关信息/流行病学相关信息）" />
        </div>
      </section>
    </div>
  )
}
