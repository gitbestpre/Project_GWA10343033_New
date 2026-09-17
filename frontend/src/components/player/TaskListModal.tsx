/**
 * 左上角徽标「胶囊文字」点击后弹出的任务列表面板（对齐 Figma 393:499 / 169:5226）。
 * 1920×1080 舞台中，顶部 0~73 为全局 Header（已由外层常驻），本面板覆盖 73 以下区域：
 *  - 背景 #e8edf5；标题“任务列表” 36px/500/#031a79 + 7×33 蓝色竖条 #6883bb；
 *  - 1785×850 白色卡片（圆角 10，位于 81,187）：59px 表头 #8ab1eb
 *    （排序 / 任务名称 / 记录 / 执行，26px 白色），下方 4 个 67px 任务行；
 *  - “记录”列按需求留空（不渲染任何图标）；
 *  - 当前所处任务行高亮：底 #b5cdff + 3px 描边 #7f9cd8（Figma 169:5285）；
 *  - “执行”列按钮均可点击：已完成“重新开始”灰、当前“进行中”蓝、未开始“开始执行”绿。
 *    点“重新开始/开始执行”通过 onJump(taskName) 跳转到对应任务阶段；
 *    点当前行“进行中”关闭面板、回到正在进行的任务；
 *  - 右上 140×56 蓝色“返 回”按钮（#618dcf，圆角 10）关闭面板。
 */
export interface TaskListItem {
  no: string
  name: string
}

export const TASK_LIST: TaskListItem[] = [
  { no: '01', name: '案例描述' },
  { no: '02', name: '接到报案' },
  { no: '03', name: '开展调查工作' },
  { no: '04', name: '现场调查' },
]

export default function TaskListModal({
  currentTask,
  onBack,
  onJump,
  tasks = TASK_LIST,
}: {
  /** 当前所处任务名称（与徽标文案一致），对应行高亮 */
  currentTask: string
  /** 右上角“返回”与当前行“进行中”：关闭面板回到当前任务 */
  onBack: () => void
  /** 点击其它行“开始执行/重新开始”：跳转到目标任务 */
  onJump: (taskName: string) => void
  /** 任务项列表：默认现场流行病学调查 4 项；食品卫生学调查传入自身 3 阶段 */
  tasks?: TaskListItem[]
}) {
  const currentIdx = tasks.findIndex((t) => t.name === currentTask)

  return (
    <div className="tl-layer" role="dialog" aria-modal="true" aria-label="任务列表">
      {/* 标题 */}
      <span className="tl-title-bar" aria-hidden="true" />
      <h2 className="tl-title">任务列表</h2>

      {/* 右上返回 */}
      <button type="button" className="tl-back" onClick={onBack}>
        <span className="tl-back-disc" aria-hidden="true">
          <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
            <path d="M9.5 2.5L2.5 10l7 7.5M2.5 10h13c3.6 0 6-2.4 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>返&nbsp;&nbsp;回</span>
      </button>

      {/* 任务表卡片 */}
      <section className="tl-card">
        {/* 表头 */}
        <header className="tl-head">
          <span className="tl-col tl-col--no">排序</span>
          <span className="tl-col tl-col--name">任务名称</span>
          <span className="tl-col tl-col--record">记录</span>
          <span className="tl-col tl-col--action">执行</span>
          <span className="tl-head-caret" aria-hidden="true">
            <svg width="22" height="29" viewBox="0 0 22 29" fill="none">
              <path d="M3 9.5L11 3l8 6.5M3 19.5L11 26l8-6.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="11" cy="14.5" r="2.6" fill="#fff" />
            </svg>
          </span>
        </header>

        {/* 任务行 */}
        <div className="tl-rows">
          {tasks.map((task, i) => {
            const state = i < currentIdx ? 'past' : i === currentIdx ? 'current' : 'future'
            return (
              <div key={task.no} className={`tl-row tl-row--${state}`}>
                <span className="tl-drag" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="tl-no">{task.no}</span>
                <span className="tl-name">{task.name}</span>
                {/* 记录列：按需求留空 */}
                <span className="tl-record" aria-hidden="true" />
                <span className="tl-action">
                  {state === 'past' && (
                    <button
                      type="button"
                      className="tl-btn tl-btn--restart"
                      onClick={() => onJump(task.name)}
                    >
                      <svg className="tl-btn-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M20 12a8 8 0 1 1-2.34-5.66M20 3v4.5h-4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      重新开始
                    </button>
                  )}
                  {state === 'current' && (
                    <button type="button" className="tl-btn tl-btn--running" onClick={onBack}>
                      <svg className="tl-btn-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2" />
                        <path d="M12 7v5l3.5 2.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      进行中
                    </button>
                  )}
                  {state === 'future' && (
                    <button
                      type="button"
                      className="tl-btn tl-btn--start"
                      onClick={() => onJump(task.name)}
                    >
                      <svg className="tl-btn-ico" width="20" height="22" viewBox="0 0 22 24" fill="none" aria-hidden="true">
                        <path d="M4 12.5l11-7v14z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
                        <path d="M15 5.5l3.5-2v18L15 19.5" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                      开始执行
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
