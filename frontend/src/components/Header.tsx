import { useNavigate, useLocation } from 'react-router-dom'
import './Header.css'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()

  // 判断是否在首页
  const isHomePage = location.pathname === '/'

  // 返回上一页
  const handleBack = () => {
    navigate(-1)
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-section">
          <img src="/images/wmu-logo.png" alt="温州医科大学" className="logo" />
          <div className="header-divider"></div>
          <div className="title-section">
            <h1 className="main-title">AI食品致病性微生物污染事件应急与处置</h1>
            <p className="sub-title">
              Emergency response and disposal of food pathogenic microorganism contamination incidents
            </p>
          </div>
        </div>
      </div>
      <div className="header-right">
        <div className="score-display">
          <span className="score-icon">⭐</span>
          <span className="score-label">目前得分</span>
          <span className="score-value">| 100</span>
        </div>
        <div className="timer-display">
          <span className="timer-icon">🕐</span>
          <span className="timer-label">操作用时</span>
          <span className="timer-value">| 20:00</span>
        </div>
        <div className="tool-buttons">
          <button className="tool-btn" title="帮助">?</button>
          <button className="tool-btn" title="设置">⚙</button>
          <button
            className="tool-btn"
            title={isHomePage ? "撤销" : "返回上一页"}
            onClick={isHomePage ? undefined : handleBack}
            disabled={isHomePage}
          >
            ↺
          </button>
          <button className="tool-btn" title="最小化">—</button>
          <button className="tool-btn" title="关闭">✕</button>
        </div>
      </div>
    </header>
  )
}

