import { useNavigate, useLocation } from 'react-router-dom'
import './Header.css'

type HeaderVariant = 'simple' | 'stats'

/**
 * 全局顶部栏 —— 对齐 Figma 顶栏规范（73px 高）
 * - simple：仅右侧 5 个线性图标（首页 / 知识宣教等浏览页）
 * - stats：右侧含「目前得分 / 操作用时」浅蓝卡片（案例学习 / 学习页）
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
  const isHomePage = location.pathname === '/'

  const handleBack = () => navigate(-1)

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
            <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9.2" />
              <path d="M9.6 9.2a2.4 2.4 0 1 1 3.2 2.3c-.8.3-1 .8-1 1.6" strokeLinecap="round" />
              <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <button type="button" className="hd-tool" title="设置" aria-label="设置">
            <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.4 5.4l1.7 1.7M16.9 16.9l1.7 1.7M18.6 5.4l-1.7 1.7M7.1 16.9l-1.7 1.7" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="hd-tool"
            title={isHomePage ? '撤销' : '返回上一页'}
            aria-label="返回"
            onClick={isHomePage ? undefined : handleBack}
            disabled={isHomePage}
          >
            <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5L4 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 10h10a6 6 0 0 1 6 6v2" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className="hd-tool" title="最小化" aria-label="最小化">
            <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className="hd-tool" title="关闭" aria-label="关闭">
            <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </nav>
      </div>
    </header>
  )
}
