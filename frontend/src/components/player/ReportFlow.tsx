/**
 * 两题知识考核完成后的终页：突发公共卫生事件报告流程（对齐 Figma 180:1054）。
 * 浅蓝灰底 #e8edf5，48px 标题 #494e58，流程位图 1801×674 位于 (60,284)。
 * 右下角“继 续”按钮（Figma 180:1054 新增，178×60 #4c79bd，位于 x871/y962），
 * 点击后进入“开展调查工作”链路（19.mp4）。
 */
const FLOW_IMAGE = '/images/epidemiology/report-flow.png'
const FLOW_TITLE = '突发公共卫生事件报告流程'

export default function ReportFlow({ onContinue }: { onContinue?: () => void }) {
  return (
    <div className="rpt-layer">
      <h2 className="rpt-title">{FLOW_TITLE}</h2>
      <img className="rpt-chart" src={FLOW_IMAGE} alt={FLOW_TITLE} />
      {onContinue && (
        <button type="button" className="rpt-continue" onClick={onContinue}>
          继 续
        </button>
      )}
    </div>
  )
}
