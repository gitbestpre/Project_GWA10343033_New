/**
 * AI 问询结束后的“相关信息”提示弹窗（对齐 Figma 184:2015）。
 * 550×340 白卡：头部“相关信息”（浅蓝底 + 蓝色竖条）+ 正文“接下来调查下一个患者”
 * + 居中蓝色“我已了解”按钮。背景为 8.mp4 末帧（由父层提供），本组件只渲染遮罩卡片。
 */
export default function RelatedInfoModal({ onAck }: { onAck: () => void }) {
  return (
    <div className="ri-mask">
      <section
        className="ri-card"
        role="alertdialog"
        aria-modal="true"
        aria-label="相关信息"
      >
        {/* 头部 */}
        <div className="ri-head">
          <span className="ri-head-bar" />
          <span className="ri-head-title">相关信息</span>
        </div>

        {/* 正文 */}
        <p className="ri-body">接下来调查下一个患者</p>

        {/* 主操作 */}
        <button type="button" className="ri-ack-btn" onClick={onAck}>
          <span>我已了解</span>
        </button>
      </section>
    </div>
  )
}
