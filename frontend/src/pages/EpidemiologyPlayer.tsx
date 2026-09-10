import { useEffect, useRef, useState } from 'react'
import StageLayout from '../components/layout/StageLayout'
import Header from '../components/Header'
import QuizModal, { type QuizResult } from '../components/player/QuizModal'
import { getQuestionById } from '../data/questions'
import './EpidemiologyPlayer.css'

/** 答错后正确答案停留时长（秒），到时自动进入下一个视频 */
const WRONG_HOLD_SECONDS = 5

/**
 * 本阶段编排（顺序播放）：
 * 视频1（案例描述 1.mp4）→ 选择题 H_01 → 视频2（接到报告 2.mp4）。
 * 答对立即进入下一视频；答错展示正确答案停留 5 秒后自动进入。
 */
type Phase =
  | { kind: 'video'; stage: number }
  | { kind: 'quiz'; stage: number }

const STAGES = [
  { video: '/Video/1.mp4', badge: '案例描述', quizId: 'H_01' },
  { video: '/Video/2.mp4', badge: '接到报告', quizId: null },
]

/** 判断所选集合是否与标准答案集合完全一致（顺序无关，兼容单选/多选） */
function isCorrectAnswer(selected: string[], answerKeys: string[]) {
  if (selected.length !== answerKeys.length) return false
  return answerKeys.every((k) => selected.includes(k))
}

export default function EpidemiologyPlayer() {
  const [score] = useState(100)

  // 当前阶段（0=视频1及考核，1=视频2）与阶段内是"放视频"还是"答题"
  const [stage, setStage] = useState(0)
  const [phaseKind, setPhaseKind] = useState<'video' | 'quiz'>('video')
  const phase: Phase = { kind: phaseKind, stage }
  const current = STAGES[stage]

  // 判题结果与倒计时
  const [result, setResult] = useState<QuizResult | null>(null)
  const [countdown, setCountdown] = useState(WRONG_HOLD_SECONDS)

  // 视频播放状态：进入视频阶段即播，播放结束后：有题则出题，无题为最后一阶段
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoEnded, setVideoEnded] = useState(false)
  const [needPlay, setNeedPlay] = useState(false)

  // 切到新视频阶段时重置并尝试自动播放
  useEffect(() => {
    if (phaseKind !== 'video') return
    setVideoEnded(false)
    setNeedPlay(false)
    const el = videoRef.current
    if (!el) return
    el.load()
    el.play().catch(() => setNeedPlay(true))
  }, [stage, phaseKind])

  // 答错倒计时：每秒 -1，归零后进入下一视频
  useEffect(() => {
    if (!result || result.correct) return
    if (countdown <= 0) {
      goNextVideo()
      return
    }
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, countdown])

  const handleVideoEnded = () => {
    setVideoEnded(true)
    if (current.quizId) {
      setPhaseKind('quiz') // 本视频后有考核 → 出题
    }
    // 无考核即最后视频，停留在结束画面
  }

  const goNextVideo = () => {
    setResult(null)
    setCountdown(WRONG_HOLD_SECONDS)
    setStage((s) => Math.min(s + 1, STAGES.length - 1))
    setPhaseKind('video')
  }

  const handleSubmit = (selectedKeys: string[]) => {
    const q = current.quizId ? getQuestionById(current.quizId) : null
    const correct = !!q && isCorrectAnswer(selectedKeys, q.answerKeys)
    if (correct) {
      // 答对：立即切到下一个视频（结果条不展示倒计时）
      setResult({ correct: true })
      goNextVideo()
    } else {
      // 答错：锁定并高亮正确答案，停留 5 秒后自动进入下一视频
      setResult({ correct: false, countdown: WRONG_HOLD_SECONDS })
      setCountdown(WRONG_HOLD_SECONDS)
    }
  }

  const q = current.quizId ? getQuestionById(current.quizId) : null
  const showQuiz = phase.kind === 'quiz' && q

  return (
    <StageLayout background="#000">
      <div className="epi-stage">
        {/* 视频层：每个视频阶段铺满 1920x1080 舞台，进入即自动播放 */}
        <video
          key={current.video}
          ref={videoRef}
          className="epi-video"
          src={current.video}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={handleVideoEnded}
          onPlay={() => setNeedPlay(false)}
        />

        {/* 左上角阶段胶囊徽标（随视频阶段变化） */}
        <div className="epi-badge">
          <img
            className="epi-badge-avatar"
            src="/images/epidemiology/stage-avatar.png"
            alt=""
          />
          <span className="epi-badge-pill">{current.badge}</span>
        </div>

        {/* 顶部状态栏（全站统一 Header，含阶段标签） */}
        <Header variant="stats" score={score} timeText="20:00" stageLabel="现场流行病学调查" />

        {/* 自动播放被浏览器拦截时的点击播放提示（正常情况下不出现） */}
        {needPlay && !videoEnded && phaseKind === 'video' && (
          <button
            type="button"
            className="epi-play-hint"
            onClick={() => videoRef.current?.play().catch(() => {})}
          >
            点击播放视频
          </button>
        )}

        {/* 知识考核弹窗：仅在当前视频播放结束、且该视频配有考题时出现 */}
        {showQuiz && (
          <QuizModal
            key={`${stage}-${q.id}`}
            index={stage + 1}
            total={STAGES.filter((s) => s.quizId).length}
            question={q}
            result={result ? { ...result, countdown } : null}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </StageLayout>
  )
}
