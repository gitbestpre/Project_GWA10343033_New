import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import KnowledgePage from './pages/KnowledgePage'
import CaseStudyPage from './pages/CaseStudyPage'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/case-study" element={<CaseStudyPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
