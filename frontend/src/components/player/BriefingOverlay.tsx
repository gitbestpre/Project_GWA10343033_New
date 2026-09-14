/**
 * 处置反馈弹窗“我已了解”后的逐级汇报遮罩页（对齐 Figma 289:564）。
 * 静态双人分屏底图 + 顶栏以下 60% 黑色压暗 + 64px 白色标题；
 * 点击顶部栏以外任意区域即进入疾控汇报对话。
 */
const BRIEFING_BG = '/images/epidemiology/briefing-bg.png'
const BRIEFING_TITLE = '疾控值班人员向疾控中心办公室主任尤主任汇报'

export default function BriefingOverlay({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="brf-layer">
      <img className="brf-bg" src={BRIEFING_BG} alt="" aria-hidden="true" />

      {/* 顶栏（高 73）以下压暗 60%，整块可点击进入对话；无可见按钮，点击即继续 */}
      <button
        type="button"
        className="brf-shade"
        aria-label="进入疾控汇报对话"
        onClick={onContinue}
      >
        <h2 className="brf-title">{BRIEFING_TITLE}</h2>
      </button>
    </div>
  )
}
