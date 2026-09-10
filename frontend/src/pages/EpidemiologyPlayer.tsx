import { useEffect, useRef, useState } from 'react'
import StageLayout from '../components/layout/StageLayout'
import Header from '../components/Header'
import QuizModal from '../components/player/QuizModal'
import type { QuizOption } from '../components/player/QuizModal'
import './EpidemiologyPlayer.css'

/** 本阶段视频：进入流行病学调查即播放，播完弹出知识考核 */
const VIDEO_SRC = '/Video/1.mp4'

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
  const [score] = useState(100)
  const qIndex = 0
  const [feedback, setFeedback] = useState<string | null>(null)

  // 视频播放状态：进入即播，播放结束后才出现选择题
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoEnded, setVideoEnded] = useState(false)
  const [needPlay, setNeedPlay] = useState(false)

  // 自动播放（muted 以满足浏览器自动播放策略；个别情况下仍被拦截则显示播放提示）
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.play().catch(() => setNeedPlay(true))
  }, [])

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
        {/* 视频层：进入页面即自动播放 1.mp4，铺满 1920x1080 舞台 */}
        <video
          ref={videoRef}
          className="epi-video"
          src={VIDEO_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => setVideoEnded(true)}
          onPlay={() => setNeedPlay(false)}
        />

        {/* 左上角阶段胶囊徽标 */}
        <div className="epi-badge">
          <img
            className="epi-badge-avatar"
            src="/images/epidemiology/stage-avatar.png"
            alt=""
          />
          <span className="epi-badge-pill">案例描述</span>
        </div>

        {/* 顶部状态栏（全站统一 Header，含阶段标签） */}
        <Header variant="stats" score={score} timeText="20:00" stageLabel="现场流行病学调查" />

        {/* 视频角标 */}
        <span className="epi-video-tag">视频1</span>

        {/* 自动播放被浏览器拦截时的点击播放提示（正常情况下不出现） */}
        {needPlay && !videoEnded && (
          <button
            type="button"
            className="epi-play-hint"
            onClick={() => videoRef.current?.play().catch(() => {})}
          >
            点击播放视频
          </button>
        )}

        {/* 知识考核弹窗：仅在视频播放结束后出现 */}
        {videoEnded && (
          <QuizModal
            key={qIndex}
            index={qIndex + 1}
            total={2}
            question={q.question}
            options={q.options}
            onSubmit={handleSubmit}
          />
        )}

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
