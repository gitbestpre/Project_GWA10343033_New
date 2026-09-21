import PromptModal from './PromptModal'

/**
 * 「退出提示」弹窗（Figma 1:7889，负责人 2026-09-18 指定）——
 * 在模块内**未走到终点**就返回上一级（顶栏返回弯箭头 / 模块内 X / 实验室检测的
 * 「退出视频」）时弹出。已走到终点返回时不弹（那是完成，不是中途退出）。
 *
 *   保存进度并退出（蓝）：断点保留，模块状态维持「学习中」，再次进入可接续学习
 *   直接退出（红）      ：清掉本次断点、本次学习成绩不予记录；若该模块此前已是
 *                        「已学习」则保持「已学习」（完成成绩不被一次中途退出抹掉）
 *   右上 X             ：取消退出，留在当前模块继续
 */
export default function ExitConfirmModal({
  onSaveAndExit,
  onDiscardAndExit,
  onCancel,
}: {
  /** 「保存进度并退出」 */
  onSaveAndExit: () => void
  /** 「直接退出」 */
  onDiscardAndExit: () => void
  /** 右上 X：取消退出，继续学习 */
  onCancel: () => void
}) {
  return (
    <PromptModal
      title="是否退出案例学习"
      bullets={[
        '保存进度并退出：系统留存学习进度与成绩，再次进入可接续学习',
        '直接退出：本次学习成绩不予记录',
      ]}
      actions={[
        { label: '直接退出', tone: 'danger', onClick: onDiscardAndExit },
        { label: '保存进度并退出', tone: 'primary', onClick: onSaveAndExit },
      ]}
      onClose={onCancel}
      closeLabel="取消退出"
    />
  )
}
