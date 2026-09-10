import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import StageLayout from '../components/layout/StageLayout'
import './EpidemiologyPageV2.css'

export default function EpidemiologyPageV2() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)

  // 状态管理
  const [step, setStep] = useState(0)
  const [showAI, setShowAI] = useState(true)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [aiMessages, setAiMessages] = useState<{role: string, content: string}[]>([])
  const [aiInput, setAiInput] = useState('')
  const [currentDialog, setCurrentDialog] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [modalContent, setModalContent] = useState({ title: '', content: '' })
  const [progress, setProgress] = useState(0)
  const [score, setScore] = useState(0)

  // 流程步骤定义
  const steps = [
    {
      type: 'video',
      title: '案例导入',
      videoSrc: '/Video/1.mp4',
      subtitle: '2019年6月5日凌晨4时起，A市中心医院先后接诊多名参加寿宴后出现腹泻、呕吐、腹痛、发热等症状的病人...'
    },
    {
      type: 'question',
      question: {
        id: 'q1',
        question: '到达现场后，首要工作是什么？',
        options: [
          'A. 核实病例诊断，统一病例定义',
          'B. 立即采样',
          'C. 通知媒体',
          'D. 关闭餐厅'
        ],
        correctAnswer: 0
      }
    },
    {
      type: 'video',
      title: '接到报告',
      videoSrc: '/Video/2.mp4',
      subtitle: '市疾控中心接到医院报告...'
    },
    {
      type: 'dialog',
      dialogs: [
        {
          id: '1',
          speaker: '张医生',
          text: '您好，我是海河市中心医院急诊科张医生，目前我院接诊了一批患者，均有不同程度的呕吐、腹痛、腹泻、发热，我怀疑是食物中毒，特向贵单位报告。',
          position: 'left'
        },
        {
          id: '2',
          speaker: '疾控人员',
          text: '请问患者从什么时候开始发病的？现在有多少人？',
          position: 'right'
        },
        {
          id: '3',
          speaker: '张医生',
          text: '从凌晨4点开始，陆陆续续有患者过来。这些患者都是昨晚参加同一场寿宴的。',
          position: 'left'
        }
      ]
    },
    {
      type: 'ai-interaction',
      prompt: '根据以上信息，请问这次事件可能的传播途径是什么？'
    },
    {
      type: 'question',
      question: {
        id: 'q2',
        question: '三间分布调查包括哪些内容？',
        options: [
          'A. 时间、空间、人间分布',
          'B. 上午、中午、晚上',
          'C. 城市、农村、郊区',
          'D. 男性、女性、儿童'
        ],
        correctAnswer: 0
      }
    },
    {
      type: 'panel',
      title: '调查记录',
      content: `流行病学调查记录

发病时间：2019年6月5日 凌晨4时起
发病地点：参加某酒店寿宴人员
患病人数：23人
主要症状：腹泻、呕吐、腹痛、发热
潜伏期：约12小时
共同暴露：6月4日晚寿宴`
    },
    {
      type: 'video',
      title: '现场调查',
      videoSrc: '/Video/3.mp4',
      subtitle: '调查小组到达现场...'
    },
    {
      type: 'question',
      question: {
        id: 'q3',
        question: '病例对照研究中，OR值>1且95%CI不包含1说明什么？',
        options: [
          'A. 该暴露因素是危险因素',
          'B. 该暴露因素是保护因素',
          'C. 该暴露因素与疾病无关',
          'D. 无法判断'
        ],
        correctAnswer: 0
      }
    },
    {
      type: 'panel',
      title: '实验室结果',
      content: `实验室检测结果

留样食品：肠炎沙门氏菌阳性 7份
患者标本：沙门氏菌阳性 16份
金葡菌仅在食品与厨师检出，患者均阴性

结论：致病因子为肠炎沙门氏菌`
    },
    {
      type: 'question',
      question: {
        id: 'q4',
        question: '确认菌株同源性需要做什么检测？',
        options: [
          'A. PFGE/MLST/WGS分子分型',
          'B. 血常规检查',
          'C. 生化检验',
          'D. X光检查'
        ],
        correctAnswer: 0
      }
    },
    {
      type: 'ai-interaction',
      prompt: '请总结本次流行病学调查的关键要点和防控措施。'
    },
    {
      type: 'completion',
      title: '学习完成',
      content: '恭喜您完成流行病学调查模块！'
    }
  ]

  const currentStep = steps[step]
  const totalSteps = steps.length

  // 处理视频播放结束
  const handleVideoEnd = () => {
    nextStep()
  }

  // 自动播放视频
  useEffect(() => {
    if (currentStep.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(() => {
        console.log('自动播放被阻止，等待用户交互')
      })
    }
  }, [step])

  // 处理答题
  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) {
      alert('请选择一个答案')
      return
    }

    const question = (currentStep as any).question
    if (selectedAnswer === question.correctAnswer) {
      setScore(score + 10)
      showModalMessage('回答正确！', '很好，继续学习。')
      setTimeout(() => {
        setShowModal(false)
        nextStep()
      }, 2000)
    } else {
      showModalMessage('回答错误', '请重新思考后再选择。')
    }
    setSelectedAnswer(null)
  }

  // 处理对话
  const handleDialogNext = () => {
    const dialogs = (currentStep as any).dialogs
    if (currentDialog < dialogs.length - 1) {
      setCurrentDialog(currentDialog + 1)
    } else {
      setCurrentDialog(0)
      nextStep()
    }
  }

  // 处理AI交互
  const handleAISend = () => {
    if (!aiInput.trim()) return

    const newMessages = [
      ...aiMessages,
      { role: 'user', content: aiInput },
      {
        role: 'assistant',
        content: '根据您的描述，这次事件呈现典型的点源暴发特征。所有患者都在同一时间、同一地点暴露于可疑食物，这是食源性疾病暴发的典型模式。建议立即开展病例对照研究，重点调查可疑餐次的食物暴露情况。'
      }
    ]
    setAiMessages(newMessages)
    setAiInput('')
  }

  const handleAIComplete = () => {
    setAiMessages([])
    nextStep()
  }

  // 显示模态框
  const showModalMessage = (title: string, content: string) => {
    setModalContent({ title, content })
    setShowModal(true)
  }

  // 下一步
  const nextStep = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1)
      setProgress(((step + 1) / totalSteps) * 100)
    } else {
      navigate('/case-study')
    }
  }

  // 初始AI消息
  useEffect(() => {
    if (step === 0) {
      setAiMessages([
        {
          role: 'assistant',
          content: '您好，我是疾控专家张主任。在这个模块中，我会协助您学习流行病学调查的完整流程。有任何问题随时问我！'
        }
      ])
    }
  }, [])

  return (
    <StageLayout scroll background="#f5f7fa">
    <div className="epidemiology-v2">
      {/* 顶部导航栏 */}
      <header className="top-header">
        <div className="header-left">
          <button onClick={() => navigate('/case-study')} className="back-btn">
            ← 返回
          </button>
          <h1 className="module-title">流行病学调查</h1>
        </div>
        <div className="header-right">
          <div className="score-display">
            <span className="label">⭐ 目前得分</span>
            <span className="divider">|</span>
            <span className="value">{score}</span>
          </div>
          <div className="time-display">
            <span className="label">⏱ 操作用时</span>
            <span className="divider">|</span>
            <span className="value">20:00</span>
          </div>
        </div>
      </header>

      {/* 进度条 */}
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="main-container">
        {/* 主内容区 */}
        <main className="content-area">
          {/* 视频播放 */}
          {currentStep.type === 'video' && (
            <div className="video-section">
              <video
                ref={videoRef}
                src={(currentStep as any).videoSrc}
                onEnded={handleVideoEnd}
                className="main-video"
                autoPlay
              />
              {(currentStep as any).subtitle && (
                <div className="video-subtitle">
                  {(currentStep as any).subtitle}
                </div>
              )}
            </div>
          )}

          {/* 选择题 */}
          {currentStep.type === 'question' && (
            <div className="question-section">
              <div className="question-card">
                <h2 className="question-text">
                  {(currentStep as any).question.question}
                </h2>
                <div className="options-container">
                  {(currentStep as any).question.options.map((option: string, index: number) => (
                    <button
                      key={index}
                      className={`option-btn ${selectedAnswer === index ? 'selected' : ''}`}
                      onClick={() => setSelectedAnswer(index)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSubmitAnswer}
                  className="submit-answer-btn"
                  disabled={selectedAnswer === null}
                >
                  提交答案
                </button>
              </div>
            </div>
          )}

          {/* 对话场景 */}
          {currentStep.type === 'dialog' && (
            <div className="dialog-section">
              <div className="dialog-scene">
                <div className={`dialog-message ${(currentStep as any).dialogs[currentDialog].position}`}>
                  <div className="message-avatar">
                    <div className="avatar-circle">
                      {(currentStep as any).dialogs[currentDialog].speaker[0]}
                    </div>
                  </div>
                  <div className="message-bubble">
                    <div className="speaker-name">
                      {(currentStep as any).dialogs[currentDialog].speaker}
                    </div>
                    <div className="message-text">
                      {(currentStep as any).dialogs[currentDialog].text}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleDialogNext} className="dialog-continue-btn">
                {currentDialog < (currentStep as any).dialogs.length - 1 ? '继续' : '完成对话'}
              </button>
            </div>
          )}

          {/* AI交互 */}
          {currentStep.type === 'ai-interaction' && (
            <div className="ai-interaction-section">
              <div className="ai-prompt-card">
                <h3>思考题</h3>
                <p>{(currentStep as any).prompt}</p>
              </div>
              <button onClick={handleAIComplete} className="continue-btn">
                继续学习
              </button>
            </div>
          )}

          {/* 信息面板 */}
          {currentStep.type === 'panel' && (
            <div className="panel-section">
              <div className="info-panel">
                <h2>{(currentStep as any).title}</h2>
                <pre className="panel-text">{(currentStep as any).content}</pre>
              </div>
              <button onClick={nextStep} className="continue-btn">
                继续
              </button>
            </div>
          )}

          {/* 完成页面 */}
          {currentStep.type === 'completion' && (
            <div className="completion-section">
              <div className="completion-card">
                <div className="success-icon">✓</div>
                <h2>{(currentStep as any).title}</h2>
                <p>{(currentStep as any).content}</p>
                <div className="final-score">
                  <span>本模块得分</span>
                  <span className="score-value">{score}</span>
                </div>
                <button onClick={() => navigate('/case-study')} className="back-home-btn">
                  返回案例学习
                </button>
              </div>
            </div>
          )}
        </main>

        {/* AI学伴侧边栏 */}
        {showAI && (
          <aside className="ai-sidebar">
            <div className="ai-header">
              <div className="ai-avatar-large">
                <img src="/images/ai-tutor.png" alt="AI导师" />
              </div>
              <h3>张主任</h3>
              <p className="ai-role">疾控专家</p>
              <button onClick={() => setShowAI(false)} className="close-ai">
                ×
              </button>
            </div>

            <div className="ai-chat-area">
              {aiMessages.map((msg, idx) => (
                <div key={idx} className={`ai-msg ${msg.role}`}>
                  <div className="msg-content">{msg.content}</div>
                </div>
              ))}
            </div>

            <div className="ai-input-section">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAISend()}
                placeholder="向专家提问..."
                className="ai-text-input"
              />
              <button onClick={handleAISend} className="ai-send-btn">
                发送
              </button>
            </div>
          </aside>
        )}

        {/* 显示AI按钮（当侧边栏隐藏时） */}
        {!showAI && (
          <button onClick={() => setShowAI(true)} className="show-ai-btn">
            💬 AI学伴
          </button>
        )}
      </div>

      {/* 模态框 */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>{modalContent.title}</h3>
            <p>{modalContent.content}</p>
            <button onClick={() => setShowModal(false)} className="modal-close-btn">
              确定
            </button>
          </div>
        </div>
      )}
    </div>
    </StageLayout>
  )
}
