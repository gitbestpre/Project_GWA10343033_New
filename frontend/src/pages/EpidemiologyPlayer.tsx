import { useEffect, useRef, useState } from 'react'
import StageLayout from '../components/layout/StageLayout'
import Header from '../components/Header'
import QuizModal from '../components/player/QuizModal'
import { getQuestionById } from '../data/questions'
import './EpidemiologyPlayer.css'

/** 本阶段视频：进入流行病学调查即播放，播完弹出知识考核 */
const VIDEO_SRC = '/Video/1.mp4'

/**
 * 本视频对应的考核题（题号取自《...选择题.xlsx》）。
 * 视频1（案例描述）后考 H_01；后续若按视频配题，把对应题号加入此数组即可，
 * 题目与答案均来自 src/data/questions.ts（由 xlsx 自动生成）。
 */
const QUIZ_IDS = ['H_01']

/** 判断所选集合是否与标准答案集合完全一致（顺序无关，兼容单选/多选） */
function isCorrectAnswer(selected: string[], answerKeys: string[]) {
  if (selected.length !== answerKeys.length) return false
  return answerKeys.every((k) => selected.includes(k))
}

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

  const q = getQuestionById(QUIZ_IDS[qIndex])

  const handleSubmit = (selectedKeys: string[]) => {
    if (q && isCorrectAnswer(selectedKeys, q.answerKeys)) {
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

        {/* 知识考核弹窗：仅在视频播放结束后出现，题目来自 xlsx 题库 */}
        {videoEnded && q && (
          <QuizModal
            key={q.id}
            index={qIndex + 1}
            total={QUIZ_IDS.length}
            question={q}
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
