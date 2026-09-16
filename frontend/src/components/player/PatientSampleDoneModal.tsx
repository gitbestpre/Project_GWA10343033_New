/**
 * 食品卫生学调查 —— 从业人员生物样本采样完成提示弹窗（对齐 Figma 324:806，卡片 550×340）。
 *
 * 16.mp4 播完后，停在 16.mp4 末帧上弹出：白色卡片（浅蓝标题栏“提示” + 右上 X +
 * 居中两行正文 + 底部蓝色“我已了解”）。正文按 Figma 字符样式覆盖，将
 * “肛拭子(粪便样本)”“尿液样本”“血液样本”标红，其余 #494E58。
 *
 * 按负责人要求：本提示弹窗内【不出现任何“播放视频”字样或视频元素】，
 * 仅作采样完成告知；点“我已了解”/ X 后由父层播放 14.mp4（onAck）。
 *
 * 背景（16.mp4 末帧）由父层播放器提供，本组件只渲染遮罩与卡片。
 */
export default function PatientSampleDoneModal({ onAck }: { onAck: () => void }) {
  return (
    <div className="pdone-mask">
      <section className="pdone-card" role="alertdialog" aria-modal="true" aria-label="提示">
        <header className="pdone-head">
          <span className="pdone-head-bar" />
          <h2 className="pdone-head-title">提示</h2>
          <button type="button" className="pdone-close" aria-label="关闭" onClick={onAck}>
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
        <div className="pdone-divider" />

        {/* 正文严格按 Figma 324:806 原始字符串（无顿号，自然折行两行）。
            characterStyleOverrides：肛拭子(粪便样本)[6..13]、尿液样本[14..17]、
            血液样本[19..22] 标红 #f22626，其余 #494e58。 */}
        <p className="pdone-text">
          采样后厨人员
          <span className="pdone-hl">肛拭子(粪便样本)</span>
          <span className="pdone-hl">尿液样本</span>
          和<span className="pdone-hl">血液样本</span>完成
        </p>

        <button type="button" className="pdone-ack" onClick={onAck}>
          我已了解
        </button>
      </section>
    </div>
  )
}
