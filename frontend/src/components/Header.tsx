import './Header.css'

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-section">
          <img src="/logo.png" alt="温州医科大学" className="logo" />
          <div className="title-section">
            <h1 className="main-title">食品安全</h1>
            <p className="sub-title">
              AI食品致病性微生物污染事件应急与处置
            </p>
          </div>
        </div>
      </div>
      <div className="header-right">
        <div className="score-display">
          <span className="score-icon">⭐</span>
          <span className="score-label">目前得分</span>
          <span className="score-value">| 0</span>
        </div>
        <div className="timer-display">
          <span className="timer-icon">🕐</span>
          <span className="timer-label">操作用时</span>
          <span className="timer-value">| 00:00</span>
        </div>
        <div className="tool-buttons">
          <button className="tool-btn" title="帮助">?</button>
          <button className="tool-btn" title="设置">⚙</button>
          <button className="tool-btn" title="撤销">↺</button>
          <button className="tool-btn" title="最小化">—</button>
          <button className="tool-btn" title="关闭">✕</button>
        </div>
      </div>
    </header>
  )
}
