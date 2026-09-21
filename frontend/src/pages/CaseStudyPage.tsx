import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import StageLayout from '../components/layout/StageLayout'
import ResumePromptModal from '../components/player/ResumePromptModal'
import {
  MODULE_FIRST_STEP,
  STATUS_CLASS,
  STATUS_LABEL,
  hasResume,
  markStudying,
  readAllProgress,
  readProgress,
  type ModuleId,
} from '../lib/moduleProgress'
import './CaseStudyPage.css'

/* ------------------------------------------------------------------ *
 * 模块选择页（/case-study）
 *
 * 每张卡片显示该模块的学习状态（未学习 / 学习中 / 已学习，负责人 2026-09-18）：
 *   · 只要点击进去了就是「学习中」；
 *   · 只有完整走到模块终点再返回这一级才是「已学习」。
 * 状态不写死在此处，而是从 lib/moduleProgress 读取（localStorage 持久化），
 * 模块页在自己的阶段推进时写回 —— 本页只负责读与展示。
 *
 * 点击卡片：有未完成断点 → 弹「学习提示」（继续学习 / 重新学习，Figma 1:7909）；
 *           无断点（未学习 / 已学习）→ 直接进入，从头开始。
 * ------------------------------------------------------------------ */

type ModuleDef = {
  id: ModuleId
  title: string
  path: string
  image: string
}

const modules: ModuleDef[] = [
  {
    id: 'epidemiology',
    title: '现场流行病学调查',
    path: '/epidemiology',
    image: '/images/hospital-scene.png',
  },
  {
    id: 'food-hygiene',
    title: '食品卫生学调查',
    path: '/food-hygiene',
    image: '/images/kitchen-scene.png',
  },
  {
    id: 'lab-testing',
    title: '实验室检测',
    path: '/lab-testing',
    image: '/images/lab-scene.png',
  },
  {
    id: 'analysis',
    title: '资料分析及调查结论',
    path: '/analysis',
    image: '/images/hospital-scene.png',
  },
]

export default function CaseStudyPage() {
  const navigate = useNavigate()

  // 每次挂载从存储读一次：从模块页返回时本页会重新挂载，状态自然刷新
  const [progress, setProgress] = useState(() => readAllProgress())
  /** 待确认续做的模块（非空即弹「学习提示」） */
  const [resumeTarget, setResumeTarget] = useState<ModuleDef | null>(null)

  /** 落「学习中 + 断点」后进入模块 */
  const enterModule = (m: ModuleDef, step: string) => {
    markStudying(m.id, step)
    setProgress(readAllProgress())
    navigate(m.path)
  }

  const handleCardClick = (m: ModuleDef) => {
    // 有未完成断点才弹「学习提示」；未学习 / 已学习直接进（已学习时 markStudying
    // 不会把状态降级，模块页读到空断点即从第一步开始）
    if (hasResume(m.id)) {
      setResumeTarget(m)
      return
    }
    enterModule(m, MODULE_FIRST_STEP[m.id])
  }

  /** 「继续学习」：沿用原断点进入 */
  const handleResume = () => {
    if (!resumeTarget) return
    const step = readProgress(resumeTarget.id).step ?? MODULE_FIRST_STEP[resumeTarget.id]
    const m = resumeTarget
    setResumeTarget(null)
    enterModule(m, step)
  }

  /** 「重新学习」：不沿用断点，直接以第一步覆盖（等价于清掉旧断点） */
  const handleRestart = () => {
    if (!resumeTarget) return
    const m = resumeTarget
    setResumeTarget(null)
    enterModule(m, MODULE_FIRST_STEP[m.id])
  }

  return (
    <StageLayout scroll background="linear-gradient(135deg, #E8EDF2 0%, #F0F4F8 100%)">
    <div className="case-study-page">
      <Header variant="stats" />
      <main className="case-study-content">
        <div className="page-title-section">
          <div className="title-bar"></div>
          <h2 className="page-title">请按照模块依次操作</h2>
        </div>
        <div className="module-grid">
          {modules.map((module) => {
            const status = progress[module.id].status
            return (
              <div
                key={module.id}
                className="module-card"
                data-module={module.id}
                data-status={status}
                onClick={() => handleCardClick(module)}
              >
                <div className="card-image">
                  <img src={module.image} alt={module.title} />
                </div>
                <div className="card-info">
                  <h3 className="card-title">{module.title}</h3>
                  <div className="card-status">
                    {/* 三态色与文案：「未学习」红点 / 「学习中」橙点 / 「已学习」绿点 */}
                    <span className={`status-dot ${STATUS_CLASS[status]}`}></span>
                    <span className="status-text">{STATUS_LABEL[status]}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* 有断点时点卡片弹出：继续学习（保留断点）/ 重新学习（从头） */}
      {resumeTarget && (
        <ResumePromptModal
          onResume={handleResume}
          onRestart={handleRestart}
          onCancel={() => setResumeTarget(null)}
        />
      )}
    </div>
    </StageLayout>
  )
}
