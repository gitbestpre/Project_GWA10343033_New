import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModuleTabs from '../components/ModuleTabs'
import ContentViewer from '../components/ContentViewer'
import AITutor from '../components/AITutor'
import ChatDialog from '../components/ChatDialog'
import { knowledgeModules } from '../data/knowledgeData'
import '../styles/KnowledgePage.css'

export default function KnowledgePage() {
  const navigate = useNavigate()
  const [currentModuleId, setCurrentModuleId] = useState(knowledgeModules[0].id)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [isTutorVisible, setIsTutorVisible] = useState(true)
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set())

  const currentModule = knowledgeModules.find(m => m.id === currentModuleId)!
  const currentPage = currentModule.pages[currentPageIndex]
  const totalPages = currentModule.pages.length

  const handleModuleChange = (moduleId: string) => {
    setCurrentModuleId(moduleId)
    setCurrentPageIndex(0)
  }

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(currentPageIndex + 1)
    }
  }

  const handleCompleteLearning = () => {
    setCompletedModules(prev => new Set([...prev, currentModuleId]))
    navigate('/')
  }

  const handleToggleTutor = () => {
    setIsTutorVisible(!isTutorVisible)
  }

  return (
    <div className="knowledge-page">
      <header className="app-header">
        <div className="logo-section">
          <h1>AI食品致病性微生物污染事件应急与处置</h1>
        </div>
      </header>

      <div className="knowledge-layout">
        {isTutorVisible && (
          <aside className="tutor-sidebar">
            <AITutor />
            <div className="sidebar-buttons">
              <button
                className="btn-complete"
                onClick={handleCompleteLearning}
              >
                ✓ 完成学习
              </button>
              <button
                className="btn-toggle"
                onClick={handleToggleTutor}
              >
                隐藏AI导师
              </button>
            </div>
          </aside>
        )}

        <main className="knowledge-main">
          <ModuleTabs
            modules={knowledgeModules}
            currentModuleId={currentModuleId}
            onModuleChange={handleModuleChange}
          />

          <ContentViewer
            page={currentPage}
            currentPageIndex={currentPageIndex}
            totalPages={totalPages}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
          />
        </main>
      </div>

      <ChatDialog />

      {!isTutorVisible && (
        <button
          className="btn-show-tutor"
          onClick={handleToggleTutor}
        >
          显示AI导师
        </button>
      )}
    </div>
  )
}
