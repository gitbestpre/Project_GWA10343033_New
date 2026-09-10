import type { ReactNode } from 'react'

/** 顶部右侧圆形操作按钮 */
function RoundButton({ label, children, onClick }: {
  label: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className="epi-nav-btn"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function PlayerTopBar({
  score,
  timeText,
  onBack,
}: {
  score: number
  timeText: string
  onBack: () => void
}) {
  return (
    <header className="epi-topbar">
      {/* 校名 / 校徽 */}
      <img className="epi-logo" src="/images/epidemiology/logo-xzmu.png" alt="徐州医科大学" />

      {/* 中、英文标题 */}
      <div className="epi-titles">
        <div className="epi-title-cn">AI食品致病性微生物污染事件应急与处置</div>
        <div className="epi-title-en">Emergency response and disposal of foodborne pathogenic microorganism events</div>
      </div>

      <span className="epi-topbar-divider epi-divider-left" />

      {/* 当前阶段标签 */}
      <div className="epi-stage-tag">现场流行病学调查</div>

      <span className="epi-topbar-divider epi-divider-right" />

      {/* 得分卡 */}
      <div className="epi-stat epi-score-card">
        <svg className="epi-icon-star" viewBox="0 0 28 27" width="28" height="27" aria-hidden>
          <path fill="#FDB806" d="M14 0l3.9 8.6 9.1 1-6.8 6.1 1.9 9-8.1-4.7L5.9 24.7l1.9-9L1 9.6l9.1-1z" />
        </svg>
        <span className="epi-stat-label">目前得分</span>
        <span className="epi-stat-sep" />
        <span className="epi-stat-value epi-num">{score}</span>
      </div>

      {/* 用时卡 */}
      <div className="epi-stat epi-time-card">
        <svg className="epi-icon-clock" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
          <circle cx="12" cy="12" r="10" fill="none" stroke="#1ED84E" strokeWidth="2" />
          <path d="M12 6v6l4 2" fill="none" stroke="#1ED84E" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="epi-stat-label">操作用时</span>
        <span className="epi-stat-sep" />
        <span className="epi-stat-value epi-num">{timeText}</span>
      </div>

      {/* 圆形操作按钮组（与 Figma Component 32 一致：问号/齿轮/返回弯箭头/最小化/关闭） */}
      <nav className="epi-nav">
        <RoundButton label="帮助">
          <img src="/images/icons/nav/nav-help.svg" alt="" className="epi-tool-img" />
        </RoundButton>
        <RoundButton label="设置">
          <img src="/images/icons/nav/nav-gear.svg" alt="" className="epi-tool-img epi-tool-gear" />
        </RoundButton>
        <RoundButton label="返回" onClick={onBack}>
          <img src="/images/icons/nav/nav-redo.svg" alt="" className="epi-tool-img" />
        </RoundButton>
        <RoundButton label="最小化">
          <img src="/images/icons/nav/nav-minus.svg" alt="" className="epi-tool-img epi-tool-minus" />
        </RoundButton>
        <RoundButton label="关闭">
          <img src="/images/icons/nav/nav-close.svg" alt="" className="epi-tool-img" />
        </RoundButton>
      </nav>
    </header>
  )
}
