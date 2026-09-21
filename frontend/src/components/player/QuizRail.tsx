import { useState } from 'react'
import { getQuestionById, type QuizQuestion } from '../../data/questions'
import { getRecord } from '../../lib/quizScore'
import {
  WRONG_HOLD_SECONDS,
  judgeAndRecord,
  useWrongHoldCountdown,
} from './quizShared'

/** 判题结果：ok=答对、bad=答错（答错时展示正确答案并停留 WRONG_HOLD_SECONDS 秒） */
type RailResult = 'ok' | 'bad'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 右侧「知识考核」侧栏（**非模态、一次一题、自动推进**）。
 *
 * 与全屏 `QuizModal` / `QuizStep` 的差异（此处刻意不复用它们的渲染，理由如下）：
 *   · **非模态**：不遮罩视频（侧栏 z30 低、视频照常可见可播）；
 *   · **挂载时机**：**39.mp4 播完（`quizWait`）才出现** —— 由宿主 `LabTestingPlayer`
 *     的 `QUIZ_RAIL_PHASES` 控制（负责人 2026-09-18：「视频39.mp4播放完再显示选择题」）。
 *     本组件自身无「是否显示」判断，`hidden` 只用于徽标弹窗期间的暂隐；
 *   · **不驱动阶段状态机**：答题只在本栏内推进，答完**自动**返回上一级 ——
 *     本段（鉴定-3 收尾）的后续去向未定（规格「待确认①」，素材里的 40.mp4 是空 3D 场景），
 *     故绝不把视频推进到下一支；
 *   · **无按钮推进**：提交后由组件自己走下一步，不需要学员再点「下一题」「重做本题」
 *     「返回上一级」（负责人 2026-09-18 明确要求）。
 *
 * **判题节奏完全复用《QuizStep / quizShared》的既有口径**（负责人要求「复用之前的
 * 选择题模块的逻辑」）：答对 → 即时前进；答错 → 高亮正确答案 + 倒计时停留 5 秒后前进。
 * 前进 = 非末题切下一题、末题直接返回上一级（`onBack`），全程零点击。
 *
 * 排版与尺寸对齐 Figma 设计稿 node 677:2210「测试弹窗bg」（负责人 2026-09-17 指定为
 *   「选择题弹窗的尺寸参考」）—— **630×660 1:1 采用**，不是按截图缩放估算：
 *   头部一行左对齐 =「知识考核」(蓝 #618dcf, fs28) +「01 / 02」(深灰 #494e58, fs28) +
 *   「单选题」(蓝底 #618dcf 白字, 100×40, r4)；题干前一个 14×14 小圆点；
 *   选项是**白色圆角卡片** 555×56 / r10（#fcfcfc、无描边，节距 66）；卡内圆形字母键 35×35；
 *   **「提交」180×52 在面板底部居中**（距面板底 49）。
 *   「01 / 02」是**当前题序**而非已答数 —— 故本组件一次只渲染一题。
 *   完整几何与量取值见 LabTestingPlayer.css 的 .lab-quiz-rail 段。
 */
export default function QuizRail({
  qids,
  title = '知识考核',
  hidden = false,
  onBack,
}: {
  /** 题库题目 id 列表（如 ['H_12', 'H_17']）；注意不是 xlsx 行号，见 LabTestingPlayer 的 QUIZ_QIDS */
  qids: string[]
  /** 侧栏标题 */
  title?: string
  /**
   * 暂隐（如徽标弹窗打开时）。
   * 用「隐藏」而非「卸载」—— 本组件有作答状态，卸载会丢掉答题进度；
   * 隐藏同时置 pointer-events:none，保证不与上层遮罩抢点击，并**挂起答错倒计时**
   * （否则学员在弹窗里会被悄悄带离本页）。
   */
  hidden?: boolean
  /** 「返回上一级」的去向（案例页 / 调查模块入口），由父组件注入 navigate；末题判完自动调用 */
  onBack?: () => void
}) {
  const questions = qids
    .map((id) => getQuestionById(id))
    .filter((q): q is QuizQuestion => Boolean(q))

  /** 当前题序（一次一题） */
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  /**
   * 判题结果。**懒初始化时把「本次挂载之前已答过」的题直接标成已判** ——
   * 于是重走阶段（断点恢复 / 刷新）进入本栏时，这些题天然是评审态：
   * 回显用户答案与正确答案、停留 5 秒后自动推进，且不再重复计分（每题只做一次）。
   */
  const [result, setResult] = useState<Record<string, RailResult>>(() => {
    const init: Record<string, RailResult> = {}
    for (const item of questions) {
      const rec = getRecord(item.id)
      if (rec) init[item.id] = rec.correct ? 'ok' : 'bad'
    }
    return init
  })
  /**
   * 挂载时**就已作答**的题号集合 —— 评审态的唯一判据。
   * 用「挂载那一刻」的快照而不是实时读记录：本次新答的题也会立刻产生记录，
   * 若实时读，它会被误判成评审态，从而丢掉「答对即时切题」的既有节奏。
   */
  const [preAnswered] = useState(
    () => new Set(questions.filter((item) => getRecord(item.id)).map((item) => item.id)),
  )
  /** 剩余秒数；0 = 未在倒计时。评审态题目从 5 秒起走，故首题即需判断 */
  const [countdown, setCountdown] = useState(() => {
    const first = questions[0]
    return first && preAnswered.has(first.id) ? WRONG_HOLD_SECONDS : 0
  })

  const q = questions[index]
  const state = q ? (result[q.id] ?? null) : null
  const isLast = index === questions.length - 1
  const multiple = q?.type === 'multiple'
  /** 当前题已答过（评审态）：回显「你的答案 + 正确答案」，停留后推进 */
  const review = !!q && state !== null && preAnswered.has(q.id)
  /** 回显用的选项集合：已答过的题以记录为准（本次作答时记录与 selected 一致） */
  const chosenKeys = (q ? getRecord(q.id)?.selected : undefined) ?? selected

  /** 前进：非末题切下一题（清空选中），末题直接返回上一级 —— 两种到达方式都是零点击 */
  const advance = () => {
    if (isLast) {
      onBack?.()
      return
    }
    const next = questions[index + 1]
    setIndex((i) => i + 1)
    setSelected([])
    // 下一题若也是评审态，同样从 5 秒起走；否则 0 = 未在倒计时
    setCountdown(next && preAnswered.has(next.id) ? WRONG_HOLD_SECONDS : 0)
  }

  // 倒计时：评审态一律停留（无论当初对错），首次答错才停留；归零后自动前进
  // （口径与 QuizStep 一致，见 quizShared.ts）
  useWrongHoldCountdown(state === 'bad' || review, countdown, setCountdown, advance, hidden)

  if (!q) return null

  const toggle = (key: string) => {
    if (state !== null) return // 已判题即锁定，不再改动
    setSelected((cur) =>
      multiple ? (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]) : [key],
    )
  }

  const submit = () => {
    if (selected.length === 0) return
    // 判题 + 记账（每题只做一次，幂等）
    if (judgeAndRecord(q, selected)) {
      // 答对：记判题结果后**即时**前进（与 QuizStep 一致）
      setResult((prev) => ({ ...prev, [q.id]: 'ok' }))
      advance()
      return
    }
    setResult((prev) => ({ ...prev, [q.id]: 'bad' }))
    setCountdown(WRONG_HOLD_SECONDS)
  }

  return (
    <aside className="lab-quiz-rail" aria-label={title} data-hidden={hidden ? 'true' : undefined}>
      <div className="lab-quiz-head">
        <span className="lab-quiz-head-title">{title}</span>
        <span className="lab-quiz-head-count" aria-label="答题进度">
          {pad(index + 1)} / {pad(questions.length)}
        </span>
        <span className="lab-quiz-chip">{multiple ? '多选题' : '单选题'}</span>
      </div>

      <div className="lab-quiz-body" data-qid={q.id} data-state={state ?? 'todo'}>
        <h3 className="lab-quiz-question">{q.question}</h3>

        <ul className="lab-quiz-options">
          {q.options.map((opt) => {
            const chosen = chosenKeys.includes(opt.key)
            const correct = state !== null && q.answerKeys.includes(opt.key)
            const wrong = state !== null && chosen && !q.answerKeys.includes(opt.key)
            const mark = [
              'epi-option-key',
              chosen ? 'is-selected' : '',
              correct ? 'is-correct' : '',
              wrong ? 'is-wrong' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  className={[
                    'epi-option',
                    chosen ? 'is-selected' : '',
                    correct ? 'is-correct' : '',
                    wrong ? 'is-wrong' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={state !== null}
                  aria-pressed={chosen}
                  onClick={() => toggle(opt.key)}
                >
                  <span className={mark}>{opt.key}</span>
                  <span className="epi-option-text">{opt.text}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* 底部区：未答=居中的「提交」；评审态=「你的答案 + 正确答案」+ 倒计时；
          答错=判词 + 正确答案 + 倒计时（到时自动下一题 / 末题自动返回上一级）；
          答对=判词（随后即时切题，故通常一闪而过）。
          **无任何推进按钮** —— 推进由组件自己做（负责人 2026-09-18 要求）。 */}
      <div
        className="lab-quiz-foot"
        data-state={state ?? 'todo'}
        data-review={review ? 'true' : 'false'}
        data-countdown={countdown}
        data-last={isLast ? 'true' : 'false'}
      >
        {state === null ? (
          <button
            type="button"
            className="lab-quiz-submit"
            disabled={selected.length === 0}
            onClick={submit}
          >
            提交
          </button>
        ) : review ? (
          <>
            <span className="lab-quiz-verdict is-review">
              已作答 · 你的答案：<b>{q.options.filter((o) => chosenKeys.includes(o.key)).map((o) => o.key).join('、')}</b>
              　正确答案：<b>{q.answerKeys.join('、')}</b>
            </span>
            <span className="lab-quiz-countdown">
              {countdown} 秒后{isLast ? '返回上一级' : '进入下一题'}
            </span>
          </>
        ) : state === 'ok' ? (
          <span className="lab-quiz-verdict is-ok">回答正确</span>
        ) : (
          <>
            <span className="lab-quiz-verdict is-bad">
              回答错误，正确答案：<b>{q.answerKeys.join('、')}</b>
            </span>
            <span className="lab-quiz-countdown">
              {countdown} 秒后{isLast ? '返回上一级' : '进入下一题'}
            </span>
          </>
        )}
      </div>
    </aside>
  )
}
