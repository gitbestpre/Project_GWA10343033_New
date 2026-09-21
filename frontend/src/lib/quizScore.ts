/* ------------------------------------------------------------------ *
 * quizScore —— 知识考核「目前得分」的**单一计分源**
 *
 * 负责人 2026-09-20 需求：
 *   「单选每题做对 6 分，多选做对 5 分」（0 分起累加）。
 *   追加确认：**每题只做一次** —— 即使阶段被重置/重走，已做过的题不再重复计分，
 *   而是以「评审态」回显用户答案与正确答案，停留 5 秒后自动进入下一步
 *   （评审态的实现见 components/player/quizShared.ts 的 reviewResultOf）。
 *
 * 满分推导：题库 19 题 = 单选 5 题 × 6 + 多选 14 题 × 5 = 30 + 70 = **100**。
 *   MAX_SCORE 由题库实时推导而非写死，题库增删题时自动跟随，不会与题目脱节。
 *
 * 数据模型：**以「每题一条答题记录」为唯一数据源**，得分是记录的派生值
 *   （`getScore()` = 记录中答对题目分值的求和）。这样「每题只做一次」天然成立：
 *   recordAnswer 对已有记录**幂等不覆盖** → 同一题无论被触发多少次，分值只计一次。
 *   相比「累加一个分数变量」，这种写法不怕阶段重走、不怕 StrictMode 双跑、不怕刷新。
 *
 * 生命周期与 lib/caseStudyTimer **完全一致**（负责人确认「与操作用时一致」）：
 *   · sessionStorage（关标签页即结束本次训练，不留陈旧成绩）；
 *   · 域内切换（模块选择页 ⇄ 四模块）持续保留；
 *   · 刷新接着保留（模块初始化即 load 恢复，顶栏首帧即显示正确值）；
 *   · 从首页**再次**进入案例学习 = 新一次训练 → 计时归零的同时 `resetQuizScore()`
 *     清空答题记录与得分（见 App.tsx 的 CaseStudyTimerWatcher）。
 * ------------------------------------------------------------------ */
import { QUESTIONS, getQuestionById, type QuizQuestion, type QuizType } from '../data/questions'

const STORAGE_KEY = 'gwa10343033.quiz-score.v1'

/** 每题分值：单选 6 分、多选 5 分（负责人指定） */
export const POINTS: Record<QuizType, number> = {
  single: 6,
  multiple: 5,
}

/** 单条答题记录：用户所选项 + 是否答对 + 作答时刻 */
export interface QuizRecord {
  /** 用户提交的选项字母（单选 1 个，多选多个） */
  selected: string[]
  correct: boolean
  /** 作答时间戳（便于排查，也便于日后做「答题时长」类需求） */
  at: number
}

/** 题目 → 分值；题库缺题时返回 0（不抛错，避免一处脏数据打崩整个顶栏） */
export function pointsOf(question: QuizQuestion | undefined): number {
  if (!question) return 0
  return POINTS[question.type] ?? 0
}

/**
 * 满分：由**题库实时推导**（单选 5×6 + 多选 14×5 = 100）。
 * 题库调整后此值自动跟随，无需手改，也不会与 POINTS 脱节。
 */
export const MAX_SCORE = QUESTIONS.reduce((sum, q) => sum + pointsOf(q), 0)

/* ---------------- 内存态 + 持久化 ---------------- *
 * 内存态是权威值，sessionStorage 只是它的备份（与 caseStudyTimer 同一取舍）：
 * 写失败只影响「刷新后能否延续」，「读不到」天然等价于「还没答过题」，
 * 不存在旧快照复活的问题，故不需要 moduleProgress 那套 storageUnavailable 双开关。
 */
type RecordMap = Record<string, QuizRecord>

let records: RecordMap = {}
const listeners = new Set<() => void>()

function persist(): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // 隐私模式 / 存储被禁用：静默降级，本次会话内计分仍完全正常
  }
}

function isRecord(v: unknown): v is QuizRecord {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const r = v as { selected?: unknown; correct?: unknown; at?: unknown }
  return (
    Array.isArray(r.selected) &&
    r.selected.every((k) => typeof k === 'string') &&
    typeof r.correct === 'boolean'
  )
}

function load(): void {
  if (typeof window === 'undefined') return
  let raw: string | null = null
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return // 读不到 = 没有存档，从 0 分起
  }
  if (raw == null) return
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
    const next: RecordMap = {}
    for (const [qid, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isRecord(value)) {
        next[qid] = {
          selected: [...value.selected],
          correct: value.correct,
          at: typeof value.at === 'number' && Number.isFinite(value.at) ? value.at : 0,
        }
      }
    }
    records = next
  } catch {
    records = {}
  }
}

function emit(): void {
  listeners.forEach((l) => l())
}

/* ---------------- 对 React 的读取接口 ---------------- */

/** 订阅得分变化（配合 useSyncExternalStore）；得分只在作答/重置时变化，故无需轮询 tick */
export function subscribeQuizScore(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 得分 = 记录中**答对**题目分值的求和（派生值，天然满足「每题只做一次」）。
 * ⚠️ 作为 useSyncExternalStore 的 getSnapshot 使用，返回值必须是原始值（number），
 * 不可返回新对象，否则每次比较都不相等 → 无限重渲。
 */
export function getScore(): number {
  let sum = 0
  for (const [qid, rec] of Object.entries(records)) {
    if (!rec.correct) continue
    sum += pointsOf(getQuestionById(qid))
  }
  return sum
}

/** 已作答题数（供验证脚本与「进度」类展示使用） */
export function getAnsweredCount(): number {
  return Object.keys(records).length
}

/** 取某题记录；未作答返回 undefined（评审态判定的依据） */
export function getRecord(qid: string): QuizRecord | undefined {
  return records[qid]
}

/** 清空所有答题记录与得分（新一次训练开始时调用） */
export function resetQuizScore(): void {
  if (Object.keys(records).length === 0) return
  records = {}
  persist()
  emit()
}

/**
 * 记录一次作答 —— **每题只做一次**：已有记录则原样保留、直接返回 `'exists'`。
 *
 * 调用方无需自己判断是否重复：判题处一律走本函数或 `quizShared.judgeAndRecord`，
 * 重复触发（阶段重走、StrictMode 双跑、判题函数被调两次）都不会重复计分。
 */
export function recordAnswer(
  qid: string,
  selected: string[],
  correct: boolean,
): 'new' | 'exists' {
  if (records[qid]) return 'exists'
  records[qid] = { selected: [...selected], correct, at: Date.now() }
  persist()
  emit()
  return 'new'
}

/** 模块初始化即恢复存档：保证 Header 首帧就显示刷新前的得分（与 caseStudyTimer 一致） */
load()
