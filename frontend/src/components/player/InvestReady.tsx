/**
 * H_05 考核完成后的过渡页（对齐 Figma 184:1286 / 184:1344）。
 * 全屏 sc_04 静态图，底部 30px 白色字幕（(287,995)），右下角“继 续”按钮
 * （178×60 #4c79bd，(1664,965)），点击进入“现场调查”链路（20.mp4）。
 * 顶栏与左上角徽标由 EpidemiologyPlayer 常驻提供，本组件只铺画面内容。
 */
const READY_IMAGE = '/images/epidemiology/invest-ready.png'
const READY_SUBTITLE = '调查组各个小组都已经准备好，流行病学调查人员准备前往医院访问患者和医生。'

export default function InvestReady({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="ird-layer">
      <img className="ird-bg" src={READY_IMAGE} alt="" aria-hidden="true" />
      <p className="ird-subtitle">{READY_SUBTITLE}</p>
      <button type="button" className="ird-continue" onClick={onContinue}>
        继 续
      </button>
    </div>
  )
}
