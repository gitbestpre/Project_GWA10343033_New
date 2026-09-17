/**
 * 食品卫生学调查 —— “重要环节”提示弹窗（对齐 Figma 184:3003 内卡片 184:3117，1000×696）。
 *
 * 结构：白色标题栏（左侧蓝色竖条 + 标题 + 右上关闭 X）+ 浅蓝正文区
 * （说明段落 + 居中副标题 + “不同致病因子类型调查重点环节”表格配图）。
 *
 * 弹窗出现时自动播放一次讲解音效 06.mp3（Audio/食品卫生学调查，与现场对话同套音频）。
 *
 * 注意：Figma 原弹窗只有右上 X，没有主操作按钮；按需求在底部居中新增“确 定”按钮，
 * 点击进入下一阶段（onConfirm）。背景视频末帧由父层播放器提供，本组件只渲染遮罩与卡片。
 */
import { useEffect, useRef } from 'react'

/** “重要环节”弹窗讲解音效（H_10 后弹出时自动播放一次） */
const KEY_STEP_AUDIO = '/Audio/食品卫生学调查/06.mp3'

export default function KeyStepModal({ onConfirm }: { onConfirm: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    // 进入此弹窗前用户已多次点击（答题/提交），存在用户激活，play 通常可带声自动播放；
    // 个别策略拦截时静默失败（不阻塞流程），不循环、只播一次。
    el.play().catch(() => {})
  }, [])

  return (
    <div className="ks-mask">
      {/* 弹窗讲解音效（自动播放一次，无控件） */}
      <audio ref={audioRef} src={KEY_STEP_AUDIO} preload="auto" />
      <section
        className="ks-card"
        role="alertdialog"
        aria-modal="true"
        aria-label="重要环节"
      >
        {/* 标题栏 */}
        <header className="ks-head">
          <span className="ks-head-bar" />
          <h2 className="ks-head-title">不同致病因子类型食品卫生学调查重点环节</h2>
          <button
            type="button"
            className="ks-close"
            aria-label="关闭"
            onClick={onConfirm}
          >
            <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="#9AA7BD"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {/* 浅蓝正文区 */}
        <div className="ks-body">
          <p className="ks-para">
            在访谈和查阅资料基础上，可绘制流程图，标出可能的危害环节和危害因素，初步分析污染原因和途径，便于进行现场勘查和采样。现场勘查应当重点围绕可疑食品从原材料、生产加工、成品存放等环节存在的问题进行。
          </p>
          <p className="ks-subtitle">不同致病因子类型食品卫生学调查重点环节</p>
          <img
            className="ks-table"
            src="/images/food-hygiene/key-link-table.png"
            alt="不同致病因子类型食品卫生学调查重点环节对照表"
          />
        </div>
      </section>

      {/* 新增主操作：确 定。独立悬浮在白卡下方的视频画面上（对应需求截图的亮蓝圆角钮），
          与 .ks-card 同级，避免被卡片 overflow:hidden 裁切。 */}
      <button type="button" className="ks-confirm" onClick={onConfirm}>
        确&nbsp;定
      </button>
    </div>
  )
}
