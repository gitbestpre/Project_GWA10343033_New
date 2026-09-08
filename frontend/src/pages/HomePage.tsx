import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import './HomePage.css'

const modules = [
  {
    id: 'knowledge',
    title: '知识宣教',
    path: '/knowledge',
    image: '/images/hospital-scene.png',
    status: '未学习' as const,
  },
  {
    id: 'case-study',
    title: '案例学习',
    path: '/case-study',
    image: '/images/kitchen-scene.png',
    status: '未学习' as const,
  },
]

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      <Header />
      <main className="home-content">
        <div className="title-section">
          <div className="title-bar"></div>
          <h2 className="page-title">请按照模块依次操作</h2>
        </div>
        <div className="module-grid">
          {modules.map((module) => (
            <div
              key={module.id}
              className="module-card"
              onClick={() => navigate(module.path)}
            >
              <div className="card-image">
                <img src={module.image} alt={module.title} />
              </div>
              <div className="card-info">
                <h3 className="card-title">{module.title}</h3>
                <div className="card-status">
                  <span className="status-dot not-started"></span>
                  <span className="status-text">{module.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
