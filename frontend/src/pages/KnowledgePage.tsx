import { useState } from 'react'
import Header from '../components/Header'
import './KnowledgePage.css'

const knowledgeModules = [
  '基础知识',
  '传播途径与污染机制',
  '临床表现与诊断鉴别',
  '预防策略与控制体系',
  '应急响应与流行病学调查',
  '实验室检测与分子溯源',
]

const moduleContent: Record<string, string> = {
  基础知识:
    '（一）食源性疾病\n食源性疾病是指通过摄食进入人体的各种致病因子引起的、通常具有感染或中毒性质的一类疾病。WHO定义为食品中致病因素进入人体引起的感染性、中毒性疾病，涵盖食物中毒、经食物传播的传染病/寄生虫病及长期低剂量污染物导致的慢性危害。\n\n致病因子分五大类：细菌性、病毒性、寄生虫性、化学性和动植物毒素性。细菌性和病毒性占报告事件绝大多数，化学性和动植物毒素性病死率更高。据WHO 2015年报告，全球每年约6亿例食源性疾病，约42万人死亡；5岁以下儿童占死亡人数30%（约12.5万），非洲和东南亚负担最重。临床表现从轻微胃肠炎到败血症、脑膜炎、肾衰竭、癌症不等，部分可致远期后遗症（如空肠弯曲菌后格林-巴利综合征、EHEC后溶血性尿毒综合征）。',
  传播途径与污染机制: '传播途径与污染机制相关内容...',
  临床表现与诊断鉴别: '临床表现与诊断鉴别相关内容...',
  预防策略与控制体系: '预防策略与控制体系相关内容...',
  应急响应与流行病学调查: '应急响应与流行病学调查相关内容...',
  实验室检测与分子溯源: '实验室检测与分子溯源相关内容...',
}

function MicrophoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

export default function KnowledgePage() {
  const [activeModule, setActiveModule] = useState(0)
  const [aiTutorVisible, setAiTutorVisible] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [volume, setVolume] = useState(80)
  const [dialogInput, setDialogInput] = useState('')

  return (
    <div className="knowledge-page">
      <Header />
      <div className="knowledge-layout">
        {aiTutorVisible && (
          <aside className="ai-tutor-sidebar">
            <div className="tutor-image-container">
              <img src="/images/ai-tutor.svg" alt="AI导师" className="tutor-image" />
              <div className="tutor-controls">
                <button className="control-btn" title="音量">
                  <VolumeIcon />
                </button>
                <button
                  className="control-btn"
                  onClick={() => setIsPaused(!isPaused)}
                  title={isPaused ? '播放' : '暂停'}
                >
                  {isPaused ? '▶' : '⏸'}
                </button>
              </div>
              <div className="volume-slider">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="tutor-buttons">
              <button className="tutor-action-btn">知识科普</button>
              <button className="tutor-action-btn">完成学习</button>
              <button
                className="tutor-action-btn"
                onClick={() => setAiTutorVisible(false)}
              >
                隐藏AI导师
              </button>
            </div>
          </aside>
        )}

        <main className="knowledge-content">
          <div className="module-tabs">
            <div className="module-title">
              <div className="title-bar"></div>
              <h2>{knowledgeModules[activeModule]}</h2>
            </div>
            <div className="tab-buttons">
              {knowledgeModules.map((mod, index) => (
                <button
                  key={mod}
                  className={`tab-btn ${index === activeModule ? 'active' : ''}`}
                  onClick={() => setActiveModule(index)}
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>

          <div className="content-area">
            <button className="nav-arrow left-arrow" disabled>
              <ChevronLeftIcon />
            </button>
            <div className="content-text">
              <p>{moduleContent[knowledgeModules[activeModule]]}</p>
            </div>
            <button className="nav-arrow right-arrow">
              <ChevronRightIcon />
            </button>
          </div>

          <div className="ai-dialog">
            <button className="voice-btn" title="语音输入">
              <MicrophoneIcon />
            </button>
            <input
              type="text"
              className="dialog-input"
              placeholder="请输入内容"
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
            />
            <button className="send-btn" title="发送">
              <SendIcon />
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
