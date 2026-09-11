import { useNavigate, useLocation } from 'react-router-dom'
import './Header.css'

type HeaderVariant = 'simple' | 'stats'

/**
 * 全局顶部栏 —— 全站唯一一套，严格对齐 Figma「Group 427321485」(1920x73)。
 *
 * 关键：所有元素都按 Figma 帧内绝对坐标摆放，元素显隐（阶段标签 / 得分卡）
 * 只做"显示与否"，绝不改变其它共有元素的位置，因此任意页面顶栏长度、
 * 共有元素位置完全一致。
 *
 * - variant="simple"：仅右侧 5 个操作图标（首页 / 知识宣教等浏览页）
 * - variant="stats" ：再叠加「目前得分 / 操作用时」卡片（案例学习 / 播放页）
 * - stageLabel      ：可选的当前阶段标签（如"现场流行病学调查"），
 *                     带左右竖线，固定在标题与得分卡之间
 *
 * 帧内坐标（宽 1920，高 73）：
 *   校徽 x15 y6 (232x58) ｜ 竖线 x262 ｜ 标题 x275
 *   阶段标签 771–1055（蓝底 793–1033，宽240）
 *   得分卡 x1108 (226) ｜ 用时卡 x1364 (273)
 *   图标簇 x1673 宽224（右内边距 23）
 */
export default function Header({
  variant = 'simple',
  score = 100,
  timeText = '20:00',
  stageLabel,
}: {
  variant?: HeaderVariant
  score?: number
  timeText?: string
  stageLabel?: string
}) {
  const navigate = useNavigate()
  const location = useLocation()

  // 返回目标按应用导航层级固定映射，避免依赖浏览历史
  //（刷新或直接打开 URL 时 navigate(-1) 会失效或返回到应用外）。
  const BACK_TARGETS: Record<string, string> = {
    '/case-study': '/',
    '/knowledge': '/',
    '/epidemiology': '/case-study',
  }
  const backTo = BACK_TARGETS[location.pathname]
  const isHomePage = location.pathname === '/'
  const backDisabled = isHomePage || backTo === undefined

  const handleBack = () => {
    if (backTo !== undefined) navigate(backTo)
  }

  return (
    <header className="app-header">
      {/* 校徽 */}
      <img src="/images/wmu-logo.png" alt="温州医科大学" className="hd-logo" />

      {/* 标题竖线 + 中英标题 */}
      <span className="hd-divider hd-divider-brand" />
      <div className="hd-titles">
        <h1 className="hd-title-cn">AI食品致病性微生物污染事件应急与处置</h1>
        <p className="hd-title-en">
          Emergency response and disposal of food pathogenic microorganism contamination incidents
        </p>
      </div>

      {/* 当前阶段标签（可选，播放页等场景显示） */}
      {stageLabel && (
        <div className="hd-stage">
          <span className="hd-divider hd-divider-stage-l" />
          <span className="hd-stage-tag">{stageLabel}</span>
          <span className="hd-divider hd-divider-stage-r" />
        </div>
      )}

      {/* 得分 / 用时 卡片（variant=stats 时显示，位置固定） */}
      {variant === 'stats' && (
        <>
          <div className="hd-stat hd-score-card">
            <svg className="hd-icon-star" viewBox="0 0 28 27" width="28" height="27" aria-hidden>
              <path fill="#FDB806" d="M14 0l3.9 8.6 9.1 1-6.8 6.1 1.9 9-8.1-4.7L5.9 24.7l1.9-9L1 9.6l9.1-1z" />
            </svg>
            <span className="hd-stat-label">目前得分</span>
            <span className="hd-stat-sep" />
            <span className="hd-stat-value hd-num">{score}</span>
          </div>
          <div className="hd-stat hd-time-card">
            <svg className="hd-icon-clock" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="none" stroke="#1ED84E" strokeWidth="2" />
              <path d="M12 6v6l4 2" fill="none" stroke="#1ED84E" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="hd-stat-label">操作用时</span>
            <span className="hd-stat-sep" />
            <span className="hd-stat-value hd-num">{timeText}</span>
          </div>
        </>
      )}

      {/* 右侧 5 个操作图标（Figma Component 32，所有页面同一位置 x1673） */}
      <nav className="hd-tools">
        <button type="button" className="hd-tool" title="帮助" aria-label="帮助">
          <img src="/images/icons/nav/nav-help.svg" alt="" className="hd-tool-img" />
        </button>
        <button type="button" className="hd-tool" title="设置" aria-label="设置">
          <img src="/images/icons/nav/nav-gear.svg" alt="" className="hd-tool-img hd-tool-gear" />
        </button>
        <button
          type="button"
          className="hd-tool"
          title={backDisabled ? '返回' : '返回上一页'}
          aria-label="返回"
          onClick={backDisabled ? undefined : handleBack}
          disabled={backDisabled}
        >
          <img src="/images/icons/nav/nav-redo.svg" alt="" className="hd-tool-img" />
        </button>
        <button type="button" className="hd-tool" title="最小化" aria-label="最小化">
          <img src="/images/icons/nav/nav-minus.svg" alt="" className="hd-tool-img hd-tool-minus" />
        </button>
        <button type="button" className="hd-tool" title="关闭" aria-label="关闭">
          <img src="/images/icons/nav/nav-close.svg" alt="" className="hd-tool-img" />
        </button>
      </nav>
    </header>
  )
}
