import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import './CaseStudyPage.css'

const modules = [
  {
    id: 'epidemiology',
    title: '流行病学调查',
    path: '/epidemiology',
    image: '/images/hospital-scene.png',
    status: '未学习' as const,
  },
  {
    id: 'food-hygiene',
    title: '食品卫生学调查',
    path: '/food-hygiene',
    image: '/images/kitchen-scene.png',
    status: '未学习' as const,
  },
  {
    id: 'lab-testing',
    title: '实验室检测',
    path: '/lab-testing',
    image: '/images/lab-scene.png',
    status: '未学习' as const,
  },
  {
    id: 'analysis',
    title: '资料分析及调查结论',
    path: '/analysis',
    image: '/images/hospital-scene.png',
    status: '未学习' as const,
  },
]

export default function CaseStudyPage() {
  const navigate = useNavigate()

  return (
    <div className="case-study-page">
      <Header />
      <main className="case-study-content">
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
