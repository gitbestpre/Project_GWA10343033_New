import { useNavigate, useLocation } from 'react-router-dom'
import './Header.css'

type HeaderVariant = 'simple' | 'stats'

/**
 * 全局顶部栏 —— 对齐 Figma 顶栏规范（73px 高）
 * - simple：仅右侧 5 个图标（首页 / 知识宣教等浏览页）
 * - stats：右侧含「目前得分 / 操作用时」浅蓝卡片（案例学习 / 学习页）
 * 右侧 5 个图标使用从 Figma 导出的原始 SVG 切图（含微投影）。
 */
export default function Header({
  variant = 'simple',
  score = 100,
  timeText = '20:00',
}: {
  variant?: HeaderVariant
  score?: number
  timeText?: string
}) {
  const navigate = useNavigate()
  const location = useLocation()

  // 返回目标按应用导航层级固定映射，避免依赖浏览历史
  //（刷新或直接打开 URL 时 navigate(-1) 会失效或返回到应用外）。
  const BACK_TARGETS: Record<string, string> = {
    '/case-study': '/',
    '/knowledge': '/',
  }
  const backTo = BACK_TARGETS[location.pathname]
  const isHomePage = location.pathname === '/'
  const backDisabled = isHomePage || backTo === undefined

  const handleBack = () => {
    if (backTo !== undefined) navigate(backTo)
  }

  return (
    <header className="app-header">
      {/* 左侧：校徽 + 竖分割线 + 中英标题 */}
      <div className="hd-brand">
        <img src="/images/wmu-logo.png" alt="温州医科大学" className="hd-logo" />
        <span className="hd-divider" />
        <div className="hd-titles">
          <h1 className="hd-title-cn">AI食品致病性微生物污染事件应急与处置</h1>
          <p className="hd-title-en">
            Emergency response and disposal of food pathogenic microorganism contamination incidents
          </p>
        </div>
      </div>

      {/* 右侧：信息卡片 + 工具图标 */}
      <div className="hd-right">
        {variant === 'stats' && (
          <>
            <div className="hd-stat">
              <svg className="hd-icon-star" viewBox="0 0 28 27" width="26" height="25" aria-hidden>
                <path fill="#FDB806" d="M14 0l3.9 8.6 9.1 1-6.8 6.1 1.9 9-8.1-4.7L5.9 24.7l1.9-9L1 9.6l9.1-1z" />
              </svg>
              <span className="hd-stat-label">目前得分</span>
              <span className="hd-stat-sep" />
              <span className="hd-stat-value hd-num">{score}</span>
            </div>
            <div className="hd-stat">
              <svg className="hd-icon-clock" viewBox="0 0 24 24" width="23" height="23" aria-hidden>
                <circle cx="12" cy="12" r="10" fill="none" stroke="#1ED84E" strokeWidth="2" />
                <path d="M12 6v6l4 2" fill="none" stroke="#1ED84E" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="hd-stat-label">操作用时</span>
              <span className="hd-stat-sep" />
              <span className="hd-stat-value hd-num">{timeText}</span>
            </div>
          </>
        )}

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
      </div>
    </header>
  )
}
