/**
 * 食品卫生学调查 —— “事故调查原则”弹窗（对齐 Figma 188:384，卡片 1200×700）。
 *
 * H_11 考核结束后弹出：标题栏（蓝竖条 + “事故调查原则” + 右上 X）+
 * 四条采样原则（及时性 / 针对性 / 适量性 / 不污染，加粗原则名 + 常规说明）+
 * 底部居中“我已了解”主按钮（浅蓝 #618dcf 大圆角、纯白文字、无图标），点击进入采样工具准备场景（onAck）。
 *
 * 弹窗出现时自动播放一次讲解音效 07.mp3（Audio/食品卫生学调查，与重要环节 06.mp3 同套）。
 *
 * 背景（采样台）由父层播放器提供，本组件只渲染遮罩与卡片。
 */
import { useEffect, useRef } from 'react'

/** “事故调查原则”弹窗讲解音效（打开时自动播放一次） */
const PRINCIPLE_AUDIO = '/Audio/食品卫生学调查/07.mp3'

/** 四条采样原则：[原则名, 说明]（文案取自 Figma 188:384） */
const PRINCIPLES: Array<{ title: string; desc: string }> = [
  {
    title: '及时性原则：',
    desc: '考虑到事故发生后现场有意义的样本有可能不被保留或被人为处理，应尽早采样，提高实验室检出致病因子的机会。',
  },
  {
    title: '针对性原则',
    desc: '根据病人的临床表现和现场流行病学初步调查结果，采集最可能检出致病因子的样本。',
  },
  {
    title: '适量性原则',
    desc: '样本采集的份数应尽可能满足事故调查的需要；采样量应尽可能满足实验室检验和留样需求。当可疑食品及致病因子范围无法判断时，应尽可能多地采集样本。',
  },
  {
    title: '不污染原则',
    desc: '样本的采集和保存过程应避免微生物、化学毒物或其他干扰检验物质的污染，防止样本之间的交叉污染。同时也要防止样本污染环境。',
  },
]

export default function SamplingPrincipleModal({ onAck }: { onAck: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    // 进入弹窗前用户已答题提交（存在用户激活），带声自动播放通常可通过；
    // 个别策略拦截时静默失败（不阻塞流程），不循环、只播一次。
    el.play().catch(() => {})
  }, [])

  return (
    <div className="sp-mask">
      {/* 弹窗讲解音效 07.mp3（打开自动播放一次，无控件） */}
      <audio ref={audioRef} src={PRINCIPLE_AUDIO} preload="auto" />
      <section
        className="sp-card"
        role="alertdialog"
        aria-modal="true"
        aria-label="事故调查原则"
      >
        {/* 标题栏 */}
        <header className="sp-head">
          <span className="sp-head-bar" />
          <h2 className="sp-head-title">事故调查原则</h2>
          <button
            type="button"
            className="sp-close"
            aria-label="关闭"
            onClick={onAck}
          >
            <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="#A5B0C5"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {/* 四条原则 */}
        <div className="sp-body">
          {PRINCIPLES.map((p) => (
            <div className="sp-item" key={p.title}>
              <h3 className="sp-item-title">{p.title}</h3>
              <p className="sp-item-desc">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* 底部主操作：浅蓝大圆角、纯白文字、无图标（对齐参考稿） */}
        <button type="button" className="sp-ack" onClick={onAck}>
          我已了解
        </button>
      </section>
    </div>
  )
}
