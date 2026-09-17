import { useEffect, useRef, useState } from 'react'
import './DataTableModal.css'

/** 提交判题后、进入知识考核前的结果停留时长（秒） */
const GRADE_HOLD_SECONDS = 5

/* 数据表格弹窗（Figma 191:587 / Group 1171275673，帧内 360,137 1200×856）
 * 标题「数据表格」，学员根据病例/对照四格表逐行计算并填写各菜品 OR 值，
 * 95%CI 由系统按 Woolf 对数法自动生成：
 *   OR = a·d / (b·c)
 *   SE(lnOR) = sqrt(1/a + 1/b + 1/c + 1/d)
 *   CI 下限 = exp(lnOR − 1.96·SE)，上限 = exp(lnOR + 1.96·SE)
 * 其中 a=病例-吃，b=病例-没吃，c=对照-吃，d=对照-没吃。
 * 右上角 X 为唯一出口，关闭即结束本模块返回模块选择页。 */

interface DishRow {
  dish: string
  caseAte: number // a 病例-吃
  caseNot: number // b 病例-没吃
  ctrlAte: number // c 对照-吃
  ctrlNot: number // d 对照-没吃
}

const ROWS: DishRow[] = [
  { dish: '素炒粉干', caseAte: 27, caseNot: 2, ctrlAte: 8, ctrlNot: 21 },
  { dish: '白灼菜心', caseAte: 22, caseNot: 7, ctrlAte: 13, ctrlNot: 16 },
  { dish: '水果罐头拼盘', caseAte: 16, caseNot: 13, ctrlAte: 14, ctrlNot: 15 },
  { dish: '幸福煲仔', caseAte: 20, caseNot: 9, ctrlAte: 19, ctrlNot: 10 },
  { dish: '清蒸鸦片鱼', caseAte: 23, caseNot: 6, ctrlAte: 20, ctrlNot: 9 },
  { dish: '蒜香小排', caseAte: 23, caseNot: 6, ctrlAte: 16, ctrlNot: 13 },
  { dish: '粗粮一品海参', caseAte: 22, caseNot: 7, ctrlAte: 23, ctrlNot: 6 },
  { dish: '蒜蓉粉丝蒸扇贝', caseAte: 24, caseNot: 5, ctrlAte: 23, ctrlNot: 6 },
  { dish: '麻油鸭', caseAte: 24, caseNot: 5, ctrlAte: 20, ctrlNot: 9 },
  { dish: '芝士伊面焗波龙', caseAte: 25, caseNot: 4, ctrlAte: 27, ctrlNot: 2 },
  { dish: '人参花胶炖土鸡', caseAte: 27, caseNot: 2, ctrlAte: 27, ctrlNot: 2 },
  { dish: '鸿运金猪拼盘', caseAte: 22, caseNot: 7, ctrlAte: 24, ctrlNot: 5 },
]

/** 最多保留 3 位小数并去掉末尾多余的 0（如 6.798 / 11.98 / 0.44） */
function fmtCi(n: number): string {
  if (!Number.isFinite(n)) return ''
  const s = n.toFixed(3)
  return s.replace(/\.?0+$/, '')
}

/** 标准答案 OR = a·d / (b·c)，保留 6 位小数并去掉末尾多余 0（如 35.4375 / 3.868132） */
function correctOr(r: DishRow): number {
  return (r.caseAte * r.ctrlNot) / (r.caseNot * r.ctrlAte)
}

function fmtOr(n: number): string {
  if (!Number.isFinite(n)) return ''
  return n.toFixed(6).replace(/\.?0+$/, '')
}

/** Woolf 法：依据四格 a/b/c/d 与学员填写的 OR 计算 95%CI；条件不满足返回 null */
function woolfCi(r: DishRow, orText: string): { low: string; high: string } | null {
  const or = Number.parseFloat(orText)
  const { caseAte: a, caseNot: b, ctrlAte: c, ctrlNot: d } = r
  if (!Number.isFinite(or) || or <= 0) return null
  if (a <= 0 || b <= 0 || c <= 0 || d <= 0) return null
  const se = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
  if (!Number.isFinite(se) || se <= 0) return null
  const lnOr = Math.log(or)
  const low = Math.exp(lnOr - 1.96 * se)
  const high = Math.exp(lnOr + 1.96 * se)
  return { low: fmtCi(low), high: fmtCi(high) }
}

/** 判定学员填写值与标准答案是否一致（相对误差 ≤1%，容差吸收小数取舍） */
function isOrCorrect(r: DishRow, text: string): boolean {
  const v = Number.parseFloat(text)
  if (!Number.isFinite(v) || v <= 0) return false
  const target = correctOr(r)
  return Math.abs(v - target) <= Math.abs(target) * 0.01
}

export default function DataTableModal({
  onClose,
  onGraded,
}: {
  onClose: () => void
  /** 提交判题并停留 5 秒后回调（进入知识考核） */
  onGraded: () => void
}) {
  // 每行一个 OR 输入串；未填写前 95%CI 两列留空
  const [orInputs, setOrInputs] = useState<string[]>(() => ROWS.map(() => ''))
  // 是否已提交判题；提交后输入锁定并显示标准答案/对错
  const [submitted, setSubmitted] = useState(false)
  // 提交后的结果停留倒计时（秒）
  const [holdLeft, setHoldLeft] = useState(GRADE_HOLD_SECONDS)
  const gradedRef = useRef(false)

  const handleChange = (idx: number, raw: string) => {
    if (submitted) return
    // 仅允许数字与小数点
    const v = raw.replace(/[^\d.]/g, '')
    setOrInputs((prev) => {
      const next = prev.slice()
      next[idx] = v
      return next
    })
  }

  const handleSubmit = () => setSubmitted(true)

  // 提交后停留 5 秒，倒计时归零进入知识考核（单次触发，防重入）
  useEffect(() => {
    if (!submitted) return
    if (holdLeft <= 0) {
      if (!gradedRef.current) {
        gradedRef.current = true
        onGraded()
      }
      return
    }
    const t = window.setTimeout(() => setHoldLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, holdLeft])

  return (
    <div className="dt-panel" role="dialog" aria-modal="false" aria-label="数据表格">
      {/* 标题栏（白底 56 高） */}
      <div className="dt-head">
        <span className="dt-head-bar" />
        <span className="dt-head-title">数据表格</span>
        <button type="button" className="dt-close" aria-label="关闭" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M4 4 L16 16 M16 4 L4 16"
              fill="none"
              stroke="#A5B0C5"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* 内容区（#f0f5fb 800 高） */}
      <div className="dt-body">
        <h2 className="dt-subtitle">根据表格，请计算食用不同食物的OR值及95%CI</h2>

        <table className="dt-table">
          <colgroup>
            <col style={{ width: 208 }} />
            <col style={{ width: 89 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 89 }} />
            <col style={{ width: 237 }} />
            <col style={{ width: 171 }} />
            <col style={{ width: 170 }} />
          </colgroup>
          <thead>
            <tr className="dt-tr-group">
              <th className="dt-th dt-th-dish" rowSpan={2}>菜品</th>
              <th className="dt-th dt-th-group" colSpan={2}>病例</th>
              <th className="dt-th dt-th-group" colSpan={2}>对照</th>
              <th className="dt-th" rowSpan={2}>OR</th>
              <th className="dt-th dt-th-group" colSpan={2}>95%CI</th>
            </tr>
            <tr className="dt-tr-sub">
              <th className="dt-th">吃</th>
              <th className="dt-th">没吃</th>
              <th className="dt-th">吃</th>
              <th className="dt-th">没吃</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, idx) => {
              const ansOr = correctOr(r)
              const ansOrText = fmtOr(ansOr)
              // 提交后统一以标准答案为准；未提交实时跟随学员输入
              const ci = submitted
                ? woolfCi(r, ansOrText)
                : woolfCi(r, orInputs[idx])
              const rowOk = submitted && isOrCorrect(r, orInputs[idx])
              const rowBad = submitted && !isOrCorrect(r, orInputs[idx])
              const orClass = [
                'dt-or-input',
                rowOk ? 'is-correct' : '',
                rowBad ? 'is-wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <tr className="dt-tr" key={r.dish}>
                  <td className="dt-td dt-td-dish">{r.dish}</td>
                  <td className="dt-td">{r.caseAte}</td>
                  <td className="dt-td">{r.caseNot}</td>
                  <td className="dt-td">{r.ctrlAte}</td>
                  <td className="dt-td">{r.ctrlNot}</td>
                  <td className="dt-td dt-td-or">
                    <span className="dt-or-box">
                      <input
                        className={orClass}
                        type="text"
                        inputMode="decimal"
                        placeholder="请填写OR值"
                        aria-label={`${r.dish} OR 值`}
                        value={submitted ? ansOrText : orInputs[idx]}
                        readOnly={submitted}
                        onChange={(e) => handleChange(idx, e.target.value)}
                      />
                    </span>
                  </td>
                  <td className="dt-td dt-td-ci">
                    <span className={`dt-ci-box${submitted ? ' is-correct' : ''}`}>{ci ? ci.low : ''}</span>
                  </td>
                  <td className="dt-td dt-td-ci">
                    <span className={`dt-ci-box${submitted ? ' is-correct' : ''}`}>{ci ? ci.high : ''}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* 底部操作：未提交=缩小版「提交」；提交后停留 5 秒倒计时进入知识考核 */}
        <div className="dt-footer">
          {submitted ? (
            <span className="dt-hold-hint">
              判题完成，<b>{holdLeft}</b> 秒后进入知识考核……
            </span>
          ) : (
            <button type="button" className="dt-submit" onClick={handleSubmit}>
              提交
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
