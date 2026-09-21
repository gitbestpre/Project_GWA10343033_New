import type { ReactNode } from 'react'
import './PromptModal.css'

/**
 * 通用「提示」弹窗骨架 —— 严格对齐 Figma 组件库的两个 520×374 提示卡：
 *   · 1:7909「学习提示」（继续学习 / 重新学习）
 *   · 1:7889「退出提示」（保存进度并退出 / 直接退出）
 *
 * 两者结构逐像素一致，只是标题、说明与按钮文案/配色不同，故抽出骨架复用，
 * 避免两份重复 CSS。几何全部取自 Figma REST API（node 1:7909 / 1:7889）：
 *
 *   卡片 520×374 · r15 · #FCFCFC，舞台居中（left700 top353）
 *   顶部条 520×64 #F4F8FD，下沿分隔线 1px #D7DFEB（y66）
 *   「提示」fs20/w700 #395BA8 @(23,20) ｜ 关闭 X 32×32 @(465,17)，图标 20×20 #A5B0C5
 *   感叹号圆圈 48×48 #F76560，水平居中 @y76
 *   标题 fs18 #494E58 居中 @y132
 *   说明 fs18 #717989 @(53,176) 宽 415（行首圆点）
 *   按钮 180×52 r5 @y289，左右边距 53/52（flex space-between + padding 0 53）
 *
 * 按钮配色（Figma 原值）：红 #F1534F ／ 绿 #65C178 ／ 蓝 #558EF5。
 */

export type PromptAction = {
  /** 按钮文案 */
  label: string
  /** 配色：danger=红、success=绿、primary=蓝（均为 Figma 原值） */
  tone: 'danger' | 'success' | 'primary'
  onClick: () => void
}

export default function PromptModal({
  title,
  bullets,
  actions,
  onClose,
  closeLabel = '关闭',
}: {
  /** 卡片标题（如「学习提示」「是否退出案例学习」） */
  title: string
  /** 说明行（逐行渲染，行首带圆点） */
  bullets: string[]
  /** 底部两个按钮：左、右 */
  actions: [PromptAction, PromptAction]
  /** 右上 X（各调用方自行决定语义：取消进入 / 取消退出） */
  onClose: () => void
  closeLabel?: string
}): ReactNode {
  return (
    <div className="pm-mask">
      <section className="pm-card" role="alertdialog" aria-modal="true" aria-label={title}>
        {/* 顶部浅蓝条 +「提示」 */}
        <div className="pm-head" />
        <span className="pm-head-title">提示</span>

        {/* 右上关闭 */}
        <button type="button" className="pm-close" aria-label={closeLabel} onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 4L16 16M16 4L4 16" stroke="#A5B0C5" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* 分隔线 */}
        <div className="pm-divider" />

        {/* 感叹号圆圈（Figma tips/exclamation-circle，红 #F76560） */}
        <svg className="pm-tip-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="21" stroke="#F76560" strokeWidth="4" />
          <path d="M24 13.5V27" stroke="#F76560" strokeWidth="4" strokeLinecap="round" />
          <circle cx="24" cy="34.5" r="2.6" fill="#F76560" />
        </svg>

        {/* 标题 */}
        <h2 className="pm-title">{title}</h2>

        {/* 说明 */}
        <ul className="pm-bullets">
          {bullets.map((b) => (
            <li key={b} className="pm-bullet">
              {b}
            </li>
          ))}
        </ul>

        {/* 底部双按钮 */}
        <div className="pm-actions">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={`pm-btn pm-btn--${a.tone}`}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
