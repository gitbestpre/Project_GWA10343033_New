import './ConclusionHintModal.css'

/**
 * 知识考核 5 题完成后的「如何给这起事件下结论?」提示卡（对齐 Figma 355:1547 / Group 1171275683）。
 * 950×560 白卡 r20：浅蓝头条（竖条 +「提示」+ X）、蓝色标题、两段结论正文、
 * 底部 191×60「我已了解」主按钮。点「我已了解」或右上 X 进入信息整理表（onAck）。
 */

const HINT_TITLE = '如何给这起事件下结论?'

/** 两段正文（Figma 原文按语义修正了「沙门\r氏菌」换行与「整理。资料」误断句） */
const HINT_PARAGRAPHS = [
  '根据现场流行病学和实验室检测结果，结合临床表现，判定该事件是一起沙门氏菌引起的食物中毒事件，可疑食物为素炒粉干。',
  '调查机构可参考《食品安全事故流行病学调查信息整理表》的格式和内容整理资料，按《食品安全事故流行病学调查报告提纲》的框架和内容撰写调查报告，向同级卫生行政部门提交对本次事故的流行病学调查报告。',
]

export default function ConclusionHintModal({ onAck }: { onAck: () => void }) {
  return (
    <div className="ch-mask">
      <section className="ch-card" role="alertdialog" aria-modal="true" aria-label={HINT_TITLE}>
        {/* 头条：浅蓝底 64px */}
        <div className="ch-head">
          <span className="ch-head-bar" />
          <span className="ch-head-title">提示</span>
        </div>
        <div className="ch-divider" />

        {/* 右上关闭（等同「我已了解」，进入整理表） */}
        <button type="button" className="ch-close" aria-label="关闭" onClick={onAck}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 3L15 15M15 3L3 15" stroke="#A5B0C5" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* 标题 */}
        <h2 className="ch-title">{HINT_TITLE}</h2>

        {/* 两段正文 */}
        <div className="ch-body">
          {HINT_PARAGRAPHS.map((p) => (
            <p key={p.slice(0, 8)} className="ch-para">
              {p}
            </p>
          ))}
        </div>

        {/* 主操作 */}
        <button type="button" className="ch-ack-btn" onClick={onAck}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="30" height="30" rx="7" fill="#FCFCFC" />
            <path
              d="M10 13.5h14M10 17.5h14M10 21.5h9"
              stroke="#618DCF"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span>我已了解</span>
        </button>
      </section>
    </div>
  )
}
