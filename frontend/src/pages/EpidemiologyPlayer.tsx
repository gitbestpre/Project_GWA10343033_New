import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StageLayout from '../components/layout/StageLayout'
import PlayerTopBar from '../components/player/PlayerTopBar'
import QuizModal from '../components/player/QuizModal'
import type { QuizOption } from '../components/player/QuizModal'
import './EpidemiologyPlayer.css'

/** #2(171:5493) 知识考核 01/02 的题目数据，取自 Figma 文案 */
const QUESTIONS: { question: string; options: QuizOption[]; answer: number }[] = [
  {
    question: '如果您是接诊医生，您觉得现在最应该做什么?',
    options: [
      { key: 'A', text: '向医院院长报告' },
      { key: 'B', text: '找其他医生来帮忙' },
      { key: 'C', text: '向当地食品安全监督管理、卫生行政部门报告情况' },
      { key: 'D', text: '联系患者所在社区或单位' },
      { key: 'E', text: '联系酒店' },
    ],
    answer: 2,
  },
]

export default function EpidemiologyPlayer() {
  const navigate = useNavigate()

  const [score] = useState(100)
  const qIndex = 0
  const [feedback, setFeedback] = useState<string | null>(null)

  const q = QUESTIONS[qIndex]

  const handleSubmit = (selected: number) => {
    if (selected === q.answer) {
      setFeedback('回答正确')
    } else {
      setFeedback('回答错误，请重新选择')
    }
  }

  return (
    <StageLayout background="#000">
      <div className="epi-stage">
        {/* 视频层（以 #2 场景帧占位，接入时替换为 <video src="/Video/1.mp4" />） */}
        <img className="epi-video" src="/images/epidemiology/scene-1.png" alt="案例视频" />

        {/* 左上角阶段胶囊徽标 */}
        <div className="epi-badge">
          <img
            className="epi-badge-avatar"
            src="/images/epidemiology/stage-avatar.png"
            alt=""
          />
          <span className="epi-badge-pill">案例描述</span>
        </div>

        {/* 顶部状态栏 */}
        <PlayerTopBar score={score} timeText="20:00" onBack={() => navigate('/case-study')} />

        {/* 视频角标 */}
        <span className="epi-video-tag">视频1</span>

        {/* 知识考核弹窗 */}
        <QuizModal
          key={qIndex}
          index={qIndex + 1}
          total={2}
          question={q.question}
          options={q.options}
          onSubmit={handleSubmit}
        />

        {/* 轻量反馈条（非 Figma 元素，仅用于当前可交互验证，后续接入真实判题流程） */}
        {feedback && (
          <button type="button" className="epi-feedback" onClick={() => setFeedback(null)}>
            {feedback}
          </button>
        )}
      </div>
    </StageLayout>
  )
}
