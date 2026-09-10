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

      {/* 圆形操作按钮组 */}
      <nav className="epi-nav">
        <RoundButton label="帮助">
          <svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" /><text x="10" y="14.5" textAnchor="middle" fontSize="11" fill="currentColor" stroke="none">?</text></svg>
        </RoundButton>
        <RoundButton label="声音">
          <svg viewBox="0 0 20 20" width="20" height="20"><path d="M4 7v6h3l4 3V4L7 7H4z" fill="currentColor" /><path d="M14 7a4 4 0 010 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </RoundButton>
        <RoundButton label="返回" onClick={onBack}>
          <svg viewBox="0 0 20 20" width="20" height="20"><path d="M12 4l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </RoundButton>
        <RoundButton label="菜单">
          <svg viewBox="0 0 20 20" width="20" height="20"><path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </RoundButton>
        <RoundButton label="关闭">
          <svg viewBox="0 0 20 20" width="20" height="20"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </RoundButton>
      </nav>
    </header>
  )
}
