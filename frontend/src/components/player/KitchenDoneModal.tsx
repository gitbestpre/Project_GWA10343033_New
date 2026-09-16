/**
 * 食品卫生学调查 —— “你已完成后厨采样工作”提示弹窗（对齐 Figma 307:1576，卡片 550×340）。
 *
 * 标本采集类型提示弹窗点“确 定”后弹出：白色卡片（标题栏“提示” + 居中正文 +
 * 底部蓝色“我已了解”主按钮）。点“我已了解”进入视频12（onAck）。
 *
 * 背景（后厨采样末帧）由父层播放器提供，本组件只渲染遮罩与卡片。
 */
export default function KitchenDoneModal({ onAck }: { onAck: () => void }) {
  return (
    <div className="kd-mask">
      <section className="kd-card" role="alertdialog" aria-modal="true" aria-label="提示">
        <header className="kd-head">
          <span className="kd-head-bar" />
          <h2 className="kd-head-title">提示</h2>
        </header>
        <p className="kd-text">你已完成后厨采样工作</p>
        <button type="button" className="kd-ack" onClick={onAck}>
          我已了解
        </button>
      </section>
    </div>
  )
}
