/**
 * 食品卫生学调查 —— 重要环节“确 定”后的提示弹窗（对齐 Figma 帧 184:3516 内卡组 184:4012）。
 *
 * 550×340 白卡（圆角20）@(685,370)：
 *   - 头部 64px 浅蓝圆角顶（左右上 20）：蓝竖条 + “提示” + 右上 X；
 *   - 正文：“采样前穿戴个人防护设备”（28px，#494E58）；
 *   - 底部居中“我已了解”蓝钮（191×60 圆角12，#618DCF），点击进入 7 图叠加阶段。
 * 无暗遮罩：Figma 原帧弹窗直接浮在 20% 黑蒙的场景图上。
 */
export default function PpeHintModal({ onAck }: { onAck: () => void }) {
  return (
    <div className="ph-mask">
      <section className="ph-card" role="alertdialog" aria-modal="true" aria-label="提示">
        {/* 头部 64px 浅蓝 */}
        <header className="ph-head">
          <span className="ph-head-bar" />
          <span className="ph-head-title">提示</span>
          <button type="button" className="ph-close" aria-label="关闭" onClick={onAck}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
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

        {/* 正文 */}
        <p className="ph-body">采样前穿戴个人防护设备</p>

        {/* 主操作 */}
        <button type="button" className="ph-ack" onClick={onAck}>
          我已了解
        </button>
      </section>
    </div>
  )
}
