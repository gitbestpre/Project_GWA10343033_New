import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StageLayout from '../components/layout/StageLayout'
import Header from '../components/Header'
import QuizModal, { type QuizResult } from '../components/player/QuizModal'
import DialogueOverlay from '../components/player/DialogueOverlay'
import InquiryPanel from '../components/player/InquiryPanel'
import { getQuestionById } from '../data/questions'
import { FIELD_DIALOGUES } from '../data/dialogues'
import type { DialogueLine } from '../data/dialogues'
import './EpidemiologyPlayer.css'

/** 答错后正确答案停留时长（秒），到时自动进入下一个视频 */
const WRONG_HOLD_SECONDS = 5

/**
 * 本阶段编排（顺序）：
 * 视频1（案例描述 1.mp4）→ 选择题 H_01 → 视频2（接到报告 2.mp4）→ 接报通话对话
 * （背景 3.mp4 循环 + 语音 + 字幕，2 条）。
 * 答对立即进入下一视频；答错展示正确答案停留 5 秒后自动进入。
 */
type PhaseKind = 'video' | 'quiz' | 'dialog' | 'inquiry'

/** 问询页背景视频（4.mp4 双人分屏，本身无音轨）与左上徽标文案 */
const INQUIRY_VIDEO = '/Video/4.mp4'

interface Stage {
  video: string
  badge: string
  quizId?: string | null
  /** 该视频结束后播放的对话（无则停留在结束画面） */
  dialogues?: DialogueLine[]
}

const STAGES: Stage[] = [
  { video: '/Video/1.mp4', badge: '案例描述', quizId: 'H_01' },
  { video: '/Video/2.mp4', badge: '接到报告', quizId: null, dialogues: FIELD_DIALOGUES },
]

/** 判断所选集合是否与标准答案集合完全一致（顺序无关，兼容单选/多选） */
function isCorrectAnswer(selected: string[], answerKeys: string[]) {
  if (selected.length !== answerKeys.length) return false
  return answerKeys.every((k) => selected.includes(k))
}

export default function EpidemiologyPlayer() {
  const navigate = useNavigate()
  const [score] = useState(100)

  const [stage, setStage] = useState(0)
  const [phaseKind, setPhaseKind] = useState<PhaseKind>('video')
  const current = STAGES[stage]

  // 判题结果与倒计时
  const [result, setResult] = useState<QuizResult | null>(null)
  const [countdown, setCountdown] = useState(WRONG_HOLD_SECONDS)

  // 视频播放状态：进入视频阶段即播，播放结束后：有题出题，有对话进对话，否则停留
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoEnded, setVideoEnded] = useState(false)
  const [needPlay, setNeedPlay] = useState(false)

  // 切到新视频阶段时重置并尝试有声自动播放；
  // 首次进入若被浏览器自动播放策略拦截（带声音需用户手势），显示“点击播放视频”。
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
    } else if (current.dialogues && current.dialogues.length > 0) {
      setPhaseKind('dialog') // 视频2 → 接报通话对话
    }
    // 否则停留在结束画面
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
      // 答对：立即切到下一个视频
      setResult({ correct: true })
      goNextVideo()
    } else {
      // 答错：锁定并高亮正确答案，停留 5 秒后自动进入下一视频
      setResult({ correct: false, countdown: WRONG_HOLD_SECONDS })
      setCountdown(WRONG_HOLD_SECONDS)
    }
  }

  const q = current.quizId ? getQuestionById(current.quizId) : null
  const showQuiz = phaseKind === 'quiz' && q
  const showDialog = phaseKind === 'dialog' && current.dialogues
  const showInquiry = phaseKind === 'inquiry'
  const quizTotal = STAGES.filter((s) => s.quizId).length

  // 接报通话对话全部播完 → 进入问询交互页
  const handleDialogFinish = () => {
    setPhaseKind('inquiry')
  }

  // 结束问询 → 返回案例模块页
  const handleInquiryEnd = () => {
    navigate('/case-study')
  }

  return (
    <StageLayout background="#000">
      <div className="epi-stage">
        {/* 主视频层：仅视频/答题阶段用主视频铺满舞台 */}
        {(phaseKind === 'video' || phaseKind === 'quiz') && (
          <video
            key={current.video}
            ref={videoRef}
            className="epi-video"
            src={current.video}
            autoPlay
            playsInline
            preload="auto"
            onEnded={handleVideoEnded}
            onPlay={() => setNeedPlay(false)}
          />
        )}

        {/* 问询阶段：背景 4.mp4 无声循环，右侧停靠问询面板（视频区域让出右侧） */}
        {showInquiry && (
          <>
            <video
              key="inquiry-bg"
              className="epi-video inq-bg-video"
              src={INQUIRY_VIDEO}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
            <InquiryPanel onEnd={handleInquiryEnd} />
          </>
        )}

        {/* 左上角阶段胶囊徽标（随阶段变化） */}
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
            onClick={() => {
              const el = videoRef.current
              if (!el) return
              el.muted = false // 用户手势后带声音播放
              el.play().catch(() => {})
            }}
          >
            点击播放视频
          </button>
        )}

        {/* 知识考核弹窗：仅在当前视频播放结束、且该视频配有考题时出现 */}
        {showQuiz && q && (
          <QuizModal
            key={`${stage}-${q.id}`}
            index={stage + 1}
            total={quizTotal}
            question={q}
            result={result ? { ...result, countdown } : null}
            onSubmit={handleSubmit}
          />
        )}

        {/* 视频2 结束后的接报通话对话：背景 3/4.mp4 循环 + 语音 + 字幕（2 条），播完进入问询页 */}
        {showDialog && <DialogueOverlay lines={current.dialogues!} onFinish={handleDialogFinish} />}
      </div>
    </StageLayout>
  )
}
