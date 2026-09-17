import './SummaryTableModal.css'

/**
 * 选择题考核完成、点「我已了解」后的信息整理表弹窗（对齐 Figma 355:1701 / Group 1171275673）。
 * 1200×856 卡（舞台 left360 top151）：白底头条（竖条 + 标题 + X）56px，
 * 主体 #F0F5FB 内放《食品安全事故流行病学调查信息整理表》长图（1049 宽，纵向滚动），
 * 底部固定「确认」栏进入《调查报告提纲》。
 * Figma 该表为整幅位图（image 542，源 1049×3531），此处保持图片原始比例显示以保证表格清晰。
 * 右上角 X 返回模块选择页（onClose）；底部「确认」进入下一弹窗（onConfirm）。
 */

const SUMMARY_TITLE = '食品安全事故流行病学调查信息整理表'
const SUMMARY_IMG = '/images/epidemiology/summary-table-src.png'

export default function SummaryTableModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="st-mask">
      <section
        className="stt-panel"
        role="dialog"
        aria-modal="true"
        aria-label={SUMMARY_TITLE}
      >
        {/* 标题栏（白底 56） */}
        <div className="st-head">
          <span className="st-head-bar" />
          <span className="st-head-title">{SUMMARY_TITLE}</span>
          <button type="button" className="st-close" aria-label="关闭" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3 3L15 15M15 3L3 15" stroke="#A5B0C5" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 主体：长图纵向滚动 */}
        <div className="st-body">
          <img className="st-img" src={SUMMARY_IMG} alt={SUMMARY_TITLE} draggable={false} />
        </div>

        {/* 底部固定确认栏：进入《调查报告提纲》 */}
        <div className="st-footer">
          <button type="button" className="st-confirm-btn" onClick={onConfirm}>
            确认
          </button>
        </div>
      </section>
    </div>
  )
}
