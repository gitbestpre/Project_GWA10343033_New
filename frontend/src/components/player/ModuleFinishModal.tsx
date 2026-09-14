/**
 * 10.mp4 播放结束后的“模块完成”提示弹窗（对齐 Figma 301:627）。
 * 550×340 白卡（几何/配色与“相关信息”卡一致，复用 .ri-* 样式）：
 * 头部“提示” + 居中正文“你已完成此模块，请返回后选择其他模块”
 * + 居中蓝色“我已了解”按钮，点击返回模块选择页。
 */
export default function ModuleFinishModal({ onAck }: { onAck: () => void }) {
  return (
    <div className="ri-mask">
      <section
        className="ri-card"
        role="alertdialog"
        aria-modal="true"
        aria-label="提示"
      >
        {/* 头部 */}
        <div className="ri-head">
          <span className="ri-head-bar" />
          <span className="ri-head-title">提示</span>
        </div>

        {/* 正文 */}
        <p className="ri-body mf-body">你已完成此模块，请返回后选择其他模块</p>

        {/* 主操作 */}
        <button type="button" className="ri-ack-btn" onClick={onAck}>
          <span>我已了解</span>
        </button>
      </section>
    </div>
  )
}
