import PromptModal from './PromptModal'

/**
 * 「学习提示」弹窗（Figma 1:7909，负责人 2026-09-18 指定）——
 * 点进**有断点**的模块（状态「学习中」）时弹出，让学员自己选续做还是重来。
 *
 *   重新学习（红）：清掉断点，从头开始全新学习
 *   继续学习（绿）：保留断点，从上次退出位置继续
 *   右上 X        ：不进入模块，留在模块选择页
 *
 * 未学习 / 已学习（无断点）的模块**不弹**本弹窗，直接进入 —— 见 CaseStudyPage。
 */
export default function ResumePromptModal({
  onResume,
  onRestart,
  onCancel,
}: {
  /** 「继续学习」：保留断点进入 */
  onResume: () => void
  /** 「重新学习」：清断点、从第一步进入 */
  onRestart: () => void
  /** 右上 X：取消进入 */
  onCancel: () => void
}) {
  return (
    <PromptModal
      title="学习提示"
      bullets={['继续学习：从上次退出位置继续学习', '重新学习：从头开始全新学习']}
      actions={[
        { label: '重新学习', tone: 'danger', onClick: onRestart },
        { label: '继续学习', tone: 'success', onClick: onResume },
      ]}
      onClose={onCancel}
      closeLabel="取消进入"
    />
  )
}
