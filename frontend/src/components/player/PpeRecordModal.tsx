import { PPE_ITEMS, CORRECT_KEY_ORDER } from './PpeDressingScene'

/**
 * 采样前 PPE 穿戴记录对比弹窗（对齐 Figma 帧 Group 599:1953，1060×700）。
 *
 * 提交穿戴后弹出：
 *   - 顶部“操作提示”栏（浅蓝 64px + 信息图标 + 分隔线）；
 *   - 结果标题：穿戴顺序恰好等于标准 3 步 →“恭喜您，穿戴顺序全部正确！”，
 *     否则 →“很遗憾，您没有回答正确！”；
 *   - 左卡“你的穿戴记录”：按学员实际点击（穿戴）先后顺序逐行列出，
 *     与该位置标准步骤一致 = 绿勾，不一致 = 橙叉；
 *   - 右卡“正确穿戴记录”：标准 3 项（1.手消毒 / 2.一次性口罩 / 3.一次性手套），
 *     其余行按 Figma 留空（虚线槽位共 8 行）；
 *   - 底部“我已了解”关闭。
 *
 * Figma 原稿为“脱卸”流程示例（左栏 8 项摘/脱序列、右栏仅填 3 行占位），
 * 负责人 2026-09-14 确认：正确穿戴记录以截图为准、仅此 3 项；道具角标为选择顺序。
 * 几何/配色沿用原稿：卡 1060×700 r20 白；记录卡 465×424 r19 底 #E8EFFA、
 * 标题条 40px #5C8CD2；行高 48 虚线分隔；正文 24px；错 #FF780D、对 #40C29E。
 */

const NAME_BY_KEY = new Map(PPE_ITEMS.map((it) => [it.key, it.name]))
const CORRECT_NAMES = CORRECT_KEY_ORDER.map((k) => NAME_BY_KEY.get(k) ?? k)
/** Figma 记录卡固定 8 行虚线槽位（填不满的行留空，最后一行无虚线） */
const ROW_SLOTS = 8

/** 绿色对勾（Figma Union，23×23，#40C29E） */
function CheckIcon() {
  return (
    <svg width="26" height="23" viewBox="0 0 26 23" fill="none" aria-hidden="true">
      <path
        d="M2.5 12.6L9.4 19.5L23.2 2.8"
        stroke="#40C29E"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 橙色叉（Figma Union，23×23，#FF780D） */
function CrossIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 23 23" fill="none" aria-hidden="true">
      <path
        d="M3.5 3.5L19.5 19.5M19.5 3.5L3.5 19.5"
        stroke="#FF780D"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 头部白色 T 恤小图标（Figma image 233，30×29） */
function ShirtIcon() {
  return (
    <svg width="30" height="29" viewBox="0 0 30 29" fill="none" aria-hidden="true">
      <path
        d="M11.6 1.2L8.9 3.1L2.2 6.4L.6 10.9L4.4 13.5L6.4 11.9V28.2H23.6V11.9L25.6 13.5L29.4 10.9L27.8 6.4L21.1 3.1L18.4 1.2C17.5 2.7 15.9 3.6 15 3.6C14.1 3.6 12.5 2.7 11.6 1.2Z"
        fill="#ffffff"
      />
    </svg>
  )
}

/** 顶部“操作提示”信息气泡图标（Figma image 24，40×39，#5C8CD2） */
function InfoIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 40 39" fill="none" aria-hidden="true">
      <path
        d="M20 2.2C10.2 2.2 2.2 9.2 2.2 17.8C2.2 22.6 4.7 26.9 8.7 29.7V36.8L15.3 33.1C16.8 33.5 18.4 33.7 20 33.7C29.8 33.7 37.8 26.6 37.8 18C37.8 9.3 29.8 2.2 20 2.2Z"
        fill="#EAF1FB"
        stroke="#5C8CD2"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect x="18.1" y="11" width="3.8" height="3.8" rx="1.9" fill="#5C8CD2" />
      <rect x="18.1" y="17.4" width="3.8" height="10.4" rx="1.9" fill="#5C8CD2" />
    </svg>
  )
}

function RecordRow({ index, name, ok }: { index: number; name: string; ok: boolean }) {
  return (
    <div className="pr-row">
      <span className={ok ? 'pr-row-text pr-row-text--ok' : 'pr-row-text pr-row-text--bad'}>
        {index + 1}.{name}
      </span>
      <span className="pr-row-icon">{ok ? <CheckIcon /> : <CrossIcon />}</span>
    </div>
  )
}

/** 空槽位行：仅虚线分隔，无内容（对齐 Figma 记录卡未填满的行） */
function EmptyRow() {
  return <div className="pr-row" aria-hidden="true" />
}

export default function PpeRecordModal({
  wornKeyOrder,
  onAck,
}: {
  wornKeyOrder: string[]
  onAck: () => void
}) {
  const isPass =
    wornKeyOrder.length === CORRECT_KEY_ORDER.length &&
    wornKeyOrder.every((k, i) => k === CORRECT_KEY_ORDER[i])

  // 左卡：实际穿戴顺序逐行填入（最多 8 行），空槽留白
  const mineRows = wornKeyOrder.slice(0, ROW_SLOTS).map((k, i) => (
    <RecordRow
      key={`${i}-${k}`}
      index={i}
      name={NAME_BY_KEY.get(k) ?? k}
      ok={wornKeyOrder[i] === CORRECT_KEY_ORDER[i]}
    />
  ))
  while (mineRows.length < ROW_SLOTS) mineRows.push(<EmptyRow key={`e${mineRows.length}`} />)

  // 右卡：正确穿戴记录 3 项填入，其余槽位留白
  const stdRows = CORRECT_NAMES.map((name, i) => (
    <RecordRow key={name} index={i} name={name} ok={true} />
  ))
  while (stdRows.length < ROW_SLOTS) stdRows.push(<EmptyRow key={`e${stdRows.length}`} />)

  return (
    <div className="pr-mask" role="dialog" aria-modal="true" aria-label="穿戴记录">
      <div className="pr-card">
        {/* 顶部操作提示栏 */}
        <div className="pr-head">
          <span className="pr-head-icon">
            <InfoIcon />
          </span>
          <span className="pr-head-title">操作提示</span>
        </div>

        {/* 结果标题 */}
        <h3 className={`pr-result${isPass ? ' pr-result--ok' : ''}`}>
          {isPass ? '恭喜您，穿戴顺序全部正确！' : '很遗憾，您没有回答正确！'}
        </h3>

        {/* 左：你的穿戴记录（实际顺序，逐位与标准对照） */}
        <div className="pr-panel pr-panel--mine">
          <div className="pr-panel-head">
            <span className="pr-panel-shirt">
              <ShirtIcon />
            </span>
            <span className="pr-panel-title">你的穿戴记录</span>
          </div>
          <div className="pr-rows">
            {wornKeyOrder.length === 0 ? (
              <>
                <p className="pr-empty">尚未穿戴任何防护用品</p>
                {Array.from({ length: ROW_SLOTS - 1 }, (_, i) => (
                  <EmptyRow key={`e${i}`} />
                ))}
              </>
            ) : (
              mineRows
            )}
          </div>
        </div>

        {/* 右：正确穿戴记录（标准 3 项 + 空槽） */}
        <div className="pr-panel pr-panel--std">
          <div className="pr-panel-head">
            <span className="pr-panel-shirt">
              <ShirtIcon />
            </span>
            <span className="pr-panel-title">正确穿戴记录</span>
          </div>
          <div className="pr-rows">{stdRows}</div>
        </div>

        {/* 底部确认 */}
        <button type="button" className="pr-ack" onClick={onAck}>
          我已了解
        </button>
      </div>
    </div>
  )
}
