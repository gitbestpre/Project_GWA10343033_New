import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import KnowledgePage from './pages/KnowledgePage'
import CaseStudyPage from './pages/CaseStudyPage'
import EpidemiologyPageV2 from './pages/EpidemiologyPageV2'
import EpidemiologyPlayer from './pages/EpidemiologyPlayer'
import FoodHygienePlayer from './pages/FoodHygienePlayer'
import LabTestingPlayer from './pages/LabTestingPlayer'
import AnalysisPlayer from './pages/AnalysisPlayer'
import { syncCaseTimerWithRoute } from './lib/caseStudyTimer'
import { resetQuizScore } from './lib/quizScore'
import './index.css'

/**
 * 「本次训练」的路由驱动 —— 只做一件事：把每次 pathname 变化交给计时源裁决
 * （从首页进入案例学习 → 归零起算；案例学习内部切换 → 不打断；回到首页 → 停止）。
 *
 * 计时源是模块级单例、不依赖任何页面组件存活，所以挂在路由最外层、不渲染任何 DOM。
 * 放在 BrowserRouter 内是必须的（要用 useLocation）。刷新时先由 caseStudyTimer
 * 模块初始化恢复存档，这里再校正状态，故不存在「先归零再跳回」的闪烁。
 *
 * 同时联动「目前得分」（lib/quizScore，单选 6 / 多选 5，0 起累加）：
 * **新一次训练开始**（从首页等域外再次进入）时清空答题记录与得分，
 * 与操作用时归零保持同一口径。刷新/域内切换都**不动**记录 ——
 * 于是「每题只做一次」在本次训练内成立，重走阶段时已答过的题走评审态回显。
 */
function CaseStudyTimerWatcher() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (syncCaseTimerWithRoute(pathname) === 'restart') resetQuizScore()
  }, [pathname])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <CaseStudyTimerWatcher />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/case-study" element={<CaseStudyPage />} />
        <Route path="/epidemiology" element={<EpidemiologyPlayer />} />
        <Route path="/food-hygiene" element={<FoodHygienePlayer />} />
        <Route path="/lab-testing" element={<LabTestingPlayer />} />
        <Route path="/analysis" element={<AnalysisPlayer />} />
        <Route path="/epidemiology-v2" element={<EpidemiologyPageV2 />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
