import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      <header className="app-header">
        <div className="logo-section">
          <h1>AI食品致病性微生物污染事件应急与处置</h1>
        </div>
      </header>

      <main className="home-content">
        <h2>请按照模块依次操作</h2>

        <div className="module-grid">
          <div className="module-card" onClick={() => navigate('/knowledge')}>
            <div className="module-image">
              <div className="placeholder-img">流行病学调查</div>
            </div>
            <div className="module-info">
              <span className="module-name">流行病学调查</span>
              <span className="module-status unlearned">● 未学习</span>
            </div>
          </div>

          <div className="module-card">
            <div className="module-image">
              <div className="placeholder-img">食品卫生学调查</div>
            </div>
            <div className="module-info">
              <span className="module-name">食品卫生学调查</span>
              <span className="module-status unlearned">● 未学习</span>
            </div>
          </div>

          <div className="module-card">
            <div className="module-image">
              <div className="placeholder-img">实验室检测</div>
            </div>
            <div className="module-info">
              <span className="module-name">实验室检测</span>
              <span className="module-status unlearned">● 未学习</span>
            </div>
          </div>

          <div className="module-card">
            <div className="module-image">
              <div className="placeholder-img">资料分析及调查结论</div>
            </div>
            <div className="module-info">
              <span className="module-name">资料分析及调查结论</span>
              <span className="module-status unlearned">● 未学习</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
