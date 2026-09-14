/**
 * 左上角徽标「机器人头像」点击后弹出的 AI 学伴对话窗（对齐 Figma 230:288 / 遮罩 230:500）。
 * 结构（1920×1080 舞台坐标）：
 *  - 全屏黑色 50% 遮罩；
 *  - 639×680 白色卡片（#fcfcfc，圆角 10，位于 641,206）：
 *    顶部 60px 头部（#f4f8fd + 底分割线 #d7dfeb）：小梦图标 + “AI学伴”(20px/700/#4c79bd)
 *    + 小头像 + “与学伴对话中...” + 右上圆形关闭；
 *    消息区动态滚动：学员气泡（右，#618dcf 白字）+ 学伴气泡（左，#e7f0ff #494e58 字）；
 *  - 卡片下方悬浮 923×60 白色输入栏（圆角 16），支持两种输入模式（左侧灰色按钮切换）：
 *    语音模式（默认，对齐 Figma）：左“按住说话 ▾”(#98b0d2@80%)、中部蓝色语音区(#4c79bd)、
 *    右“结束帮助”(#bfbfbf@70%)；
 *    文字模式：左切换按钮变为“文字输入 ▾”，中部为白色输入框 + 蓝色发送按钮。
 * 点击遮罩、右上 X 或“结束帮助”关闭。
 */
import { useEffect, useRef, useState } from 'react'

type MsgSide = 'user' | 'ai'
interface ChatMsg {
  id: number
  side: MsgSide
  text: string
}

const INITIAL_MSGS: ChatMsg[] = [
  { id: 1, side: 'user', text: '发现了突发应急事件首先应该做什么？' },
  { id: 2, side: 'ai', text: '这是由AI输出对应的回答内容：XXXXXXXXXXXX\nXXXXXXXXXXXXXXXXXXXX' },
]

/** 文字输入的占位回复（AI 学伴后端未接入前的本地兜底，与稿面 XXXX 占位一致） */
const FALLBACK_REPLY = '这是由AI输出对应的回答内容：已收到你的问题，我会结合现场流行病学调查的处置流程给出参考建议。'
type InputMode = 'voice' | 'text'

export default function AiCompanionModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<InputMode>('voice')
  const [msgs, setMsgs] = useState<ChatMsg[]>(INITIAL_MSGS)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(INITIAL_MSGS.length + 1)

  // 新消息（含学伴回复）后滚到底部
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs])

  /** 发送文字消息：学员气泡立即上屏，随后学伴给出一条回复 */
  const sendText = () => {
    const text = draft.trim()
    if (!text) return
    const userId = idRef.current++
    setMsgs((prev) => [...prev, { id: userId, side: 'user', text }])
    setDraft('')
    const aiId = idRef.current++
    window.setTimeout(() => {
      setMsgs((prev) => [...prev, { id: aiId, side: 'ai', text: FALLBACK_REPLY }])
    }, 500)
  }

  return (
    <div className="ac-mask" onClick={onClose}>
      {/* 对话卡片 */}
      <section
        className="ac-card"
        role="dialog"
        aria-modal="true"
        aria-label="AI学伴"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <header className="ac-head">
          <svg className="ac-head-icon" width="27" height="26" viewBox="0 0 27 26" fill="none" aria-hidden="true">
            <rect x="3" y="2" width="21" height="17" rx="6" stroke="#4c79bd" strokeWidth="2.4" />
            <circle cx="9.5" cy="10.5" r="1.8" fill="#4c79bd" />
            <circle cx="17.5" cy="10.5" r="1.8" fill="#4c79bd" />
            <path d="M9 16.5c2.4 1.6 6.6 1.6 9 0" stroke="#4c79bd" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M8.5 19v3M18.5 19v3M5.5 22.5h16" stroke="#4c79bd" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="ac-head-title">AI学伴</span>
          <img className="ac-head-avatar" src="/images/epidemiology/stage-robot.png" alt="" aria-hidden="true" />
          <span className="ac-head-status">与学伴对话中...</span>
          <button type="button" className="ac-close" aria-label="关闭" onClick={onClose}>
            <span className="ac-close-disc" />
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="#a5b0c5" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* 消息区（动态滚动） */}
        <div className="ac-msgs" ref={listRef}>
          {msgs.map((m) =>
            m.side === 'user' ? (
              <div key={m.id} className="ac-row ac-row--user ac-row--flow">
                <div className="ac-bubble ac-bubble--user">
                  <span>{m.text}</span>
                </div>
                <span className="ac-user-avatar" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" fill="#ffffff" />
                    <path d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
            ) : (
              <div key={m.id} className="ac-row ac-row--ai ac-row--flow">
                <img className="ac-ai-avatar" src="/images/epidemiology/stage-robot.png" alt="" aria-hidden="true" />
                <div className="ac-bubble ac-bubble--ai">
                  <span>{m.text}</span>
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {/* 底部悬浮输入栏：左侧切换语音/文字模式，中部随模式切换内容 */}
      <div className="ac-dock" onClick={(e) => e.stopPropagation()}>
        {/* 输入模式切换按钮 */}
        <button
          type="button"
          className="ac-hold-btn"
          aria-label={mode === 'voice' ? '切换到文字输入' : '切换到语音输入'}
          onClick={() => setMode(mode === 'voice' ? 'text' : 'voice')}
        >
          <span>{mode === 'voice' ? '按住说话' : '文字输入'}</span>
          <svg width="11" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="rgba(45,45,45,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="ac-dock-sep" />

        {mode === 'voice' ? (
          /* 语音模式：中部蓝色语音区 */
          <button type="button" className="ac-voice-btn" aria-label="按住说话">
            <svg width="26" height="30" viewBox="0 0 26 30" fill="none" aria-hidden="true">
              <rect x="7" y="1" width="12" height="18" rx="6" stroke="#fff" strokeWidth="2.2" />
              <path d="M2.5 13.5c0 6 4.7 10 10.5 10s10.5-4 10.5-10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M13 23.5V28M8.5 28h9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          /* 文字模式：输入框 + 发送 */
          <div className="ac-text-area">
            <input
              className="ac-text-input"
              type="text"
              value={draft}
              placeholder="请输入..."
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendText()
              }}
              autoFocus
            />
            <button
              type="button"
              className="ac-send-btn"
              aria-label="发送"
              disabled={!draft.trim()}
              onClick={sendText}
            >
              发送
            </button>
          </div>
        )}

        <span className="ac-dock-sep" />
        <button type="button" className="ac-end-btn" onClick={onClose}>
          结束帮助
        </button>
      </div>
    </div>
  )
}
