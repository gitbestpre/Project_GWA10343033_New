import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import KnowledgePage from './pages/KnowledgePage'
import CaseStudyPage from './pages/CaseStudyPage'
import EpidemiologyPageV2 from './pages/EpidemiologyPageV2'
import EpidemiologyPlayer from './pages/EpidemiologyPlayer'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/case-study" element={<CaseStudyPage />} />
        <Route path="/epidemiology" element={<EpidemiologyPlayer />} />
        <Route path="/epidemiology-v2" element={<EpidemiologyPageV2 />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
