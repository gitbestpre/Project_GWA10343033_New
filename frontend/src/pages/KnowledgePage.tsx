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

const moduleImages: Record<string, string> = {
  '基础知识': '/images/基础知识.png',
  '传播途径与污染机制': '/images/传播途径与污染机制.png',
  '临床表现与诊断鉴别': '/images/临床表现与诊断鉴别.png',
  '预防策略与控制体系': '/images/预防策略与控制体系.png',
  '应急响应与流行病学调查': '/images/针对性预防策略与控制体系.png',
  '实验室检测与分子溯源': '/images/实验室检测与分子溯源技术.png',
}

const moduleContent: Record<string, { title: string; sections: { heading: string; body: string }[] }> = {
  基础知识: {
    title: '基础知识',
    sections: [
      {
        heading: '（一）食源性疾病',
        body: '食源性疾病是指通过摄食进入人体的各种致病因子引起的、通常具有感染或中毒性质的一类疾病。WHO定义为食品中致病因素进入人体引起的感染性、中毒性疾病，涵盖食物中毒、经食物传播的传染病/寄生虫病及长期低剂量污染物导致的慢性危害。\n\n致病因子分五大类：细菌性、病毒性、寄生虫性、化学性和动植物毒素性。细菌性和病毒性占报告事件绝大多数，化学性和动植物毒素性病死率更高。据WHO 2015年报告，全球每年约6亿例食源性疾病，约42万人死亡；5岁以下儿童占死亡人数30%（约12.5万），非洲和东南亚负担最重。临床表现从轻微胃肠炎到败血症、脑膜炎、肾衰竭、癌症不等，部分可致远期后遗症（如空肠弯曲菌后格林-巴利综合征、EHEC后溶血性尿毒综合征）。',
      },
      {
        heading: '（二）食品安全事故',
        body: '根据《食品安全法》第一百五十条，指食源性疾病、食品污染等源于食品，对人体健康有危害或可能有危害的事故，将"可能有危害"纳入体现预防为主原则。四大特征：突发性（难以预测，需快速响应）、群体性（共同暴露常致暴发）、危害性（健康损害、经济损失、社会恐慌）、复杂性（涉及多环节多因子，溯源难度大）。按《国家食品安全事故应急预案》分四级：Ⅰ级（特别重大）、Ⅱ级（重大）、Ⅲ级（较大）、Ⅳ级（一般）。',
      },
      {
        heading: '（三）食物中毒',
        body: '食物中毒是食源性疾病的特殊类型，特指食用被有毒有害物质污染或含有毒有害物质的食品后出现的急性、亚急性疾病。不包括暴饮暴食引起的急性胃肠炎、食源性肠道传染病和寄生虫病，也不包括慢性毒害为主的疾病。五大特征：潜伏期短（数分钟至数十小时）、发病急、临床表现相似（以胃肠道症状为主）、与进食有关（未食者不发病）、无传染性（诺如病毒等可经呕吐物气溶胶二代传播）。',
      },
      {
        heading: '（四）食源性疾病暴发',
        body: '指因食用共同食物出现2例及以上类似临床表现的病例；肉毒中毒等严重疾病1例即按暴发处理。核心任务是3W：确定致病因子（What）、污染食品（Which food）和污染环节（Where）。按规模分为家庭暴发（2~3例）、集体单位暴发、餐饮单位暴发、跨区域暴发。',
      },
      {
        heading: '（五）概念辨析要点',
        body: '食源性疾病食品安全事故食物中毒。食源性疾病最宽泛，包括经食物传播的所有疾病；食品安全事故强调事故属性和应急响应；食物中毒最窄，特指急性、亚急性中毒性疾病。三者在法律定性和统计口径上有严格区分。',
      },
    ],
  },
  传播途径与污染机制: {
    title: '传播途径与污染机制',
    sections: [
      { heading: '（一）主要传播途径', body: '食源性致微生物主要通过食物链传播，包括原料污染、加工过程交叉污染、储存不当导致的增殖、以及食用前的处理不当。' },
      { heading: '（二）常见污染机制', body: '细菌性污染主要通过接触传播，病毒性污染可通过气溶胶和接触传播，寄生虫通过未煮熟的肉类或水产品传播。' },
    ],
  },
  临床表现与诊断鉴别: {
    title: '临床表现与诊断鉴别',
    sections: [
      { heading: '（一）常见临床表现', body: '胃肠道症状是最常见的临床表现，包括恶心、呕吐、腹痛、腹泻等。严重病例可出现脱水、电解质紊乱、甚至休克。' },
      { heading: '（二）诊断与鉴别', body: '诊断需结合流行病学史、临床表现和实验室检查。需与非食源性疾病进行鉴别诊断。' },
    ],
  },
  预防策略与控制体系: {
    title: '预防策略与控制体系',
    sections: [
      { heading: '（一）预防策略', body: '预防为主是食品安全工作的基本原则。包括源头控制、过程监管、风险评估和应急响应四个层面。' },
      { heading: '（二）控制体系', body: '建立从农田到餐桌的全过程控制体系，包括GAP、GMP、HACCP等管理体系。' },
    ],
  },
  应急响应与流行病学调查: {
    title: '应急响应与流行病学调查',
    sections: [
      { heading: '（一）应急响应流程', body: '发现疑似食源性疾病暴发后，应立即启动应急响应，包括报告、调查、控制和评估四个阶段。' },
      { heading: '（二）流行病学调查方法', body: '采用病例对照研究、队列研究等方法，确定致病因子、污染食品和污染环节。' },
    ],
  },
  实验室检测与分子溯源: {
    title: '实验室检测与分子溯源',
    sections: [
      { heading: '（一）实验室检测方法', body: '包括传统培养法、快速检测法和分子生物学方法。分子溯源技术可精确追踪污染源。' },
      { heading: '（二）分子溯源技术', body: '全基因组测序（WGS）是目前最精确的分子溯源方法，可实现菌株水平的溯源。' },
    ],
  },
}

function MicrophoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function KnowledgePage() {
  const [activeModule, setActiveModule] = useState(0)
  const [aiTutorVisible, setAiTutorVisible] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [volume, setVolume] = useState(80)
  const [dialogInput, setDialogInput] = useState('')

  const currentContent = moduleContent[knowledgeModules[activeModule]]

  return (
    <div className="knowledge-page">
      <Header />
      <div className="knowledge-layout">
        {aiTutorVisible && (
          <aside className="ai-tutor-sidebar">
            <div className="sidebar-buttons">
              <button className="sidebar-action-btn">
                <BookIcon />
                <span>知识科普</span>
              </button>
              <button className="sidebar-action-btn">
                <CheckIcon />
                <span>完成学习</span>
              </button>
            </div>
            <div className="tutor-image-wrapper">
              <img
                src="/images/ai-tutor.png"
                alt="AI导师"
                className="tutor-image"
              />
              <div className="tutor-top-controls">
                <button className="control-btn" title="音量">
                  <VolumeIcon />
                </button>
                <button
                  className="control-btn"
                  onClick={() => setIsPaused(!isPaused)}
                  title={isPaused ? '播放' : '暂停'}
                >
                  {isPaused ? <PlayIcon /> : <PauseIcon />}
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
              <button
                className="hide-tutor-btn"
                onClick={() => setAiTutorVisible(false)}
                title="隐藏AI导师"
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
              <h2>{currentContent.title}</h2>
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
              <div className="content-image-wrapper">
                <img
                  src={moduleImages[knowledgeModules[activeModule]]}
                  alt={currentContent.title}
                  className="content-module-image"
                />
              </div>
              {currentContent.sections.map((section, idx) => (
                <div key={idx} className="content-section">
                  <h3 className="section-heading">{section.heading}</h3>
                  <p className="section-body">{section.body}</p>
                </div>
              ))}
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
