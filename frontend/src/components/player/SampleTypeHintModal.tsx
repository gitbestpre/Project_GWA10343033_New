/**
 * 食品卫生学调查 —— 后厨采样结束后的“常见的食品安全事故标本和样品采集类型”提示弹窗
 * （对齐 Figma 307:1368，卡片 1070×646）。
 *
 * 过渡视频 22.mp4 播完后弹出：标题栏（蓝竖条 + “提示” + 右上 X）+
 * 蓝色小标题 + 两列五行表格（样本来源 / 可采集的标本和样品类型）。
 * Figma 原稿只有右上 X，本次按需求在底部新增“确 定”主按钮，点击进入“你已完成后厨采样工作”弹窗。
 *
 * 背景（后厨采样末帧）由父层播放器提供，本组件只渲染遮罩与卡片。
 */

/** 表格行：[样本来源, 可采集的标本和样品类型]（文案取自 Figma 307:1368，按内容拆分为 5 行） */
const ROWS: Array<{ source: string; types: string }> = [
  { source: '病人', types: '粪便、尿液、血液、呕吐物、洗胃液、肛拭子、咽拭子；' },
  { source: '从业人员', types: '粪便、肛拭子、咽拭子、皮肤化脓性病灶标本；' },
  {
    source: '可疑食品',
    types:
      '可疑食品剩余部分及同批次产品、半成品、原料；加工单位剩余的同批次食品，使用相同加工工具、同期制作的其他食品；使用相同原料制作的其他食品；',
  },
  {
    source: '食品制作环境',
    types: '加工设备、工用具、容器、餐饮具上的残留物或物体表面涂抹样品或冲洗液样品；食品加工用水；',
  },
  { source: '其他', types: '由毒蕈、河豚等有毒动植物造成的中毒，要搜索废弃食品进行形态鉴别；' },
]

export default function SampleTypeHintModal({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="sth-mask">
      <section className="sth-card" role="alertdialog" aria-modal="true" aria-label="提示">
        {/* 标题栏 */}
        <header className="sth-head">
          <span className="sth-head-bar" />
          <h2 className="sth-head-title">提示</h2>
          <button type="button" className="sth-close" aria-label="关闭" onClick={onConfirm}>
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

        <div className="sth-body">
          <h3 className="sth-subtitle">常见的食品安全事故标本和样品采集类型</h3>

          <table className="sth-table">
            <thead>
              <tr>
                <th className="sth-col-source">样本来源</th>
                <th className="sth-col-types">可采集的标本和样品类型</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.source}>
                  <td className="sth-col-source">{r.source}</td>
                  <td className="sth-col-types">{r.types}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 新增主操作：确定 → “你已完成后厨采样工作”弹窗 */}
        <div className="sth-actions">
          <button type="button" className="sth-confirm" onClick={onConfirm}>
            确 定
          </button>
        </div>
      </section>
    </div>
  )
}
