import { useEffect, useRef, useState } from 'react'
import { FIELD_DIALOGUES } from '../../data/dialogues'

type Side = 'left' | 'right' | 'prompt'

interface ChatMsg {
  id: string
  /** left=疾控值班员/学员（麦克风图标）；right=张医生（头像）；prompt=红色任务提示 */
  side: Side
  text: string
}

/**
 * 关键信息问询项（值班员提问 → 张医生答复）。
 * 问题出现在左侧（麦克风），张医生答复出现在右侧（头像）。逐项完成。
 */
const PRESET_QA: { question: string; answer: string }[] = [
  { question: '请问目前一共有多少人发病？', answer: '约20多人。' },
  { question: '患者主要有哪些症状？', answer: '都有不同程度的呕吐、腹痛、腹泻、发热。' },
  { question: '患者有没有共同就餐史？', answer: '他们都是昨晚共同参加同一场寿宴的家人。' },
  { question: '最早是什么时间开始发病的？', answer: '从今天凌晨4点开始，陆陆续续有患者过来。' },
]

/** 自由提问的占位应答（接入真实 Dify / 数字人前的本地引导） */
const FALLBACK_ANSWER =
  '这个信息我先记录下来。请重点询问发病时间、人数、症状和共同就餐史等主要信息。'

let _seq = 0
const uid = () => `m${++_seq}`

/**
 * 接报通话结束后的问询页右侧面板“疾病预防控制中心”：
 * 值班员（学员）依红色任务提示向张医生询问主要信息，问完后可“结束问询”。
 */
export default function InquiryPanel({ onEnd }: { onEnd?: () => void }) {
  // 初始消息：前序通话记录（值班员开场白在左、张医生报告在右）+ 红色任务提示
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    const seed: ChatMsg[] = FIELD_DIALOGUES.map((d, i) => ({
      id: `seed-${d.id}`,
      side: i === 0 ? 'left' : 'right',
      text: d.text,
    }))
    seed.push({
      id: 'task-prompt',
      side: 'prompt',
      text: '身为市场监督管理局的值班员，请询问主要信息',
    })
    return seed
  })
  const [asked, setAsked] = useState<boolean[]>(() => PRESET_QA.map(() => false))
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing])

  /** 值班员发问（左）→ 张医生答复（右） */
  const ask = (question: string, answer: string) => {
    if (typing) return
    setMessages((prev) => [...prev, { id: uid(), side: 'left', text: question }])
    setTyping(true)
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { id: uid(), side: 'right', text: answer }])
      setTyping(false)
    }, 650)
  }

  const askPreset = (i: number) => {
    if (asked[i] || typing) return
    setAsked((prev) => prev.map((v, idx) => (idx === i ? true : v)))
    ask(PRESET_QA[i].question, PRESET_QA[i].answer)
  }

  const sendFree = () => {
    const q = draft.trim()
    if (!q || typing) return
    setDraft('')
    ask(q, FALLBACK_ANSWER)
  }

  const remaining = PRESET_QA.map((qa, i) => ({ qa, i })).filter(({ i }) => !asked[i])

  return (
    <aside className="inq-panel">
      {/* 头部 */}
      <div className="inq-head">
        <span className="inq-head-icon">💬</span>
        <span className="inq-head-title">疾病预防控制中心</span>
      </div>

      {/* 消息滚动区 */}
      <div className="inq-scroll" ref={scrollRef}>
        {messages.map((m) =>
          m.side === 'prompt' ? (
            <div key={m.id} className="inq-prompt">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className={`inq-msg inq-${m.side}`}>
              {m.side === 'left' && <span className="inq-ava inq-mic">🎙</span>}
              <div className={`inq-bubble ${m.side === 'right' ? 'is-doctor' : ''}`}>{m.text}</div>
              {m.side === 'right' && <span className="inq-ava inq-doc">张</span>}
            </div>
          ),
        )}
        {typing && <div className="inq-typing">对方正在输入…</div>}

        {/* 推荐问题（还有未问项时展示） */}
        {remaining.length > 0 && !typing && (
          <div className="inq-suggest">
            {remaining.map(({ qa, i }) => (
              <button key={i} type="button" className="inq-suggest-item" onClick={() => askPreset(i)}>
                <span className="inq-mic-dot">🎙</span>
                <span className="inq-suggest-text">{qa.question}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 底部：输入 + 发送 + 按住讲话 + 结束问询 */}
      <div className="inq-foot">
        <div className="inq-input-row">
          <input
            className="inq-input"
            type="text"
            value={draft}
            placeholder="请在这里输入想询问的问题"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendFree()
            }}
          />
          <button type="button" className="inq-send" onClick={sendFree} disabled={!draft.trim() || typing}>
            <span className="inq-send-arrow">➤</span> 发送
          </button>
          <button type="button" className="inq-voice">
            🎙 按住讲话
          </button>
        </div>
        <div className="inq-end-row">
          <button type="button" className="inq-end-btn" onClick={() => onEnd?.()}>
            结束问询
          </button>
        </div>
      </div>
    </aside>
  )
}
