import { useEffect, useRef, useState } from 'react'
import type { DialogueLine } from '../../data/dialogues'

/** 角色在对话画面中的位置（左=接听方，右=报告方，旁白居中） */
const ROLE_SIDE: Record<string, 'left' | 'right' | 'center'> = {
  王医师: 'left',
  尤主任: 'left',
  张医生: 'right',
  旁白: 'center',
}

/** 角色头像底色（按说话方区分） */
const ROLE_COLOR: Record<string, string> = {
  王医师: '#3f7fd6',
  尤主任: '#3f7fd6',
  张医生: '#e07a4f',
  旁白: '#7a8699',
}

/**
 * 视频2（接报电话）结束后的对话阶段：
 * 背景循环播放 3.mp4（静音），逐条播放语音 mp3 并同步显示角色字幕。
 * 语音播完自动进入下一条；也可点击“继续”立即推进。全部播完停在结束画面。
 */
export default function DialogueOverlay({
  lines,
  onFinish,
}: {
  lines: DialogueLine[]
  /** 全部对话播放完成后的回调（可留空，停留结束画面） */
  onFinish?: () => void
}) {
  const [index, setIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [needTap, setNeedTap] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const finishedRef = useRef(false)
  const advanceTimer = useRef<number | null>(null)

  const clearAdvanceTimer = () => {
    if (advanceTimer.current != null) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
  }

  // 卸载时清理定时器
  useEffect(() => () => clearAdvanceTimer(), [])

  const line = !finished && index < lines.length ? lines[index] : null
  const side = line ? (ROLE_SIDE[line.role] ?? 'left') : 'left'
  const color = line ? (ROLE_COLOR[line.role] ?? '#3f7fd6') : '#3f7fd6'
  // 背景视频随当前条切换（3.mp4 / 4.mp4）；结束后停在最后一条的画面
  const bgVideo = lines[Math.min(index, Math.max(lines.length - 1, 0))]?.video ?? '/Video/3.mp4'

  const playCurrent = () => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = 0
    const p = el.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => setNeedTap(true))
    }
  }

  // 进入对话阶段：尝试自动播放第一条（被浏览器拦截则显示“点击开始”）
  useEffect(() => {
    if (started || lines.length === 0) return
    setStarted(true)
    const t = window.setTimeout(playCurrent, 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 切换到新的一条时自动播放
  useEffect(() => {
    if (!started || finished) return
    playCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, started, finished])

  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    clearAdvanceTimer()
    setFinished(true)
    onFinish?.()
  }

  const advance = () => {
    // 手动推进：停止当前语音与待执行的自动推进
    audioRef.current?.pause()
    clearAdvanceTimer()
    if (index + 1 < lines.length) {
      setNeedTap(false)
      setIndex((i) => i + 1)
    } else {
      finish()
    }
  }

  const handleAudioEnded = () => {
    // 语音自然播完：稍作停顿后自动进入下一条
    if (index + 1 < lines.length) {
      clearAdvanceTimer()
      advanceTimer.current = window.setTimeout(() => setIndex((i) => i + 1), 450)
    } else {
      finish()
    }
  }

  const startByTap = () => {
    setNeedTap(false)
    playCurrent()
  }

  return (
    <div className="dlg-layer">
      {/* 背景视频：随对话条切换（3.mp4 / 4.mp4，本身无音轨），循环铺满舞台 */}
      <video
        key={bgVideo}
        className="dlg-bg"
        src={bgVideo}
        autoPlay
        loop
        playsInline
        preload="auto"
      />
      <div className="dlg-shade" />

      {/* 当前条语音（隐藏控件，仅发声） */}
      {line && <audio ref={audioRef} src={line.audio} preload="auto" onEnded={handleAudioEnded} />}

      {/* 通话状态 + 进度点 */}
      <div className="dlg-top">
        <span className="dlg-call-dot" />
        <span className="dlg-call-title">流行病学调查 · 接报通话</span>
        <span className="dlg-dots">
          {lines.map((l, i) => (
            <span
              key={l.id}
              className={`dlg-dot ${i === index && !finished ? 'is-active' : ''} ${
                i < index || finished ? 'is-done' : ''
              }`}
            />
          ))}
        </span>
      </div>

      {/* 当前对话气泡（左/右/居中） */}
      {line && (
        <div key={`${line.id}-${index}`} className={`dlg-row dlg-${side}`}>
          <div className="dlg-avatar" style={{ background: color }}>
            {line.role.slice(0, 1)}
          </div>
          <div className="dlg-bubble-wrap">
            <div className="dlg-role">{line.role}</div>
            <div className={`dlg-bubble ${side === 'right' ? 'is-light' : ''}`}>{line.text}</div>
          </div>
        </div>
      )}

      {/* 底部操作区 */}
      <div className="dlg-bottom">
        {finished ? (
          <div className="dlg-end">通话结束</div>
        ) : needTap ? (
          <button type="button" className="dlg-start-btn" onClick={startByTap}>
            点击开始对话
          </button>
        ) : (
          <button type="button" className="dlg-next-btn" onClick={advance}>
            {index + 1 < lines.length ? '继续 ▶' : '完成对话 ✓'}
          </button>
        )}
      </div>
    </div>
  )
}
