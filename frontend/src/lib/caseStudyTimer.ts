/* ------------------------------------------------------------------ *
 * caseStudyTimer —— 案例学习「操作用时」的**单一计时源**
 *
 * 负责人 2026-09-20 需求：
 *   「进入案例学习后操作用时开始计时，返回首页就停止」。
 *   追加确认：① 从首页**再次**进入案例学习 → 归零重新计时；
 *             ② 案例学习中途刷新页面（F5）→ 接着已用时长继续。
 *
 * 计时域（进入其中即计时，域内互相切换不打断）：
 *   /case-study ⇄ /epidemiology ⇄ /food-hygiene ⇄ /lab-testing ⇄ /analysis
 * 起点：**从域外真正导航进域内**（首页 / 知识宣教 → 案例学习）→ 清零重算。
 * 终点：**导航回域外**（首页 / 知识宣教）→ 停止累计，保留已用时长。
 *
 * 与 lib/moduleProgress 的关系：两者**互相独立**。moduleProgress 记「学到哪一步」（长期、
 * localStorage）；本文件记「本次训练用了多久」（本次会话、sessionStorage）。
 * 故用 sessionStorage 而非 localStorage —— 关掉标签页即结束本次训练，不会留下陈旧用时。
 *
 * 刷新为何能延续：本模块在**被 import 时**就从 sessionStorage 恢复（见文件末尾 load()），
 * 且 running 状态下存的是**绝对起算时间戳**，`now - startedAt` 天然把刷新耗时也算进去。
 * 因此 Header 首帧渲染即可显示正确值，不存在「先 00:00 再跳到真实值」的闪烁。
 * ------------------------------------------------------------------ */

/** 案例学习域路由（与 App.tsx 的路由表一致；/epidemiology-v2 属独立页面，不计入） */
const CASE_STUDY_ROUTES: readonly string[] = [
  '/case-study',
  '/epidemiology',
  '/food-hygiene',
  '/lab-testing',
  '/analysis',
]

export function isCaseStudyRoute(pathname: string): boolean {
  return CASE_STUDY_ROUTES.includes(pathname)
}

const STORAGE_KEY = 'gwa10343033.case-study-timer.v1'

type TimerState = {
  /** 已累计毫秒（**不含**当前正在走的这一段） */
  accumulatedMs: number
  running: boolean
  /** 本段起算的**绝对时间戳**；未运行为 null */
  startedAt: number | null
}

let state: TimerState = { accumulatedMs: 0, running: false, startedAt: null }

/**
 * 上一帧所在路径（null = 尚未做过路由同步）。
 * 用它区分三种情形：**首次挂载**（刷新/直接打开）/ **从域外进入** / **域内切换** ——
 * 三者的处理完全不同，只看当前路径是分不出来的。
 */
let lastPath: string | null = null

let ticker: number | null = null
let lastNotifiedSecond = -1
const listeners = new Set<() => void>()

function elapsedMs(): number {
  const live = state.running && state.startedAt !== null ? Date.now() - state.startedAt : 0
  return Math.max(0, state.accumulatedMs + live)
}

/* ---------------- 持久化 ---------------- *
 * 写失败只影响「刷新后能否延续」，内存态照常工作 —— 故不必像 moduleProgress 那样
 * 引入 storageUnavailable 双开关：这里内存态是权威值，存储只是它的备份，
 * 「读不到」天然等价于「没有存档」，不存在旧快照复活的问题。
 */
function persist(): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 隐私模式 / 存储被禁用：静默降级，本次会话内计时仍完全正常
  }
}

function load(): void {
  if (typeof window === 'undefined') return
  let raw: string | null = null
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return // 读不到 = 没有存档，从 0 起算
  }
  if (raw == null) return
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
    const v = parsed as { accumulatedMs?: unknown; running?: unknown; startedAt?: unknown }
    const accumulatedMs =
      typeof v.accumulatedMs === 'number' && Number.isFinite(v.accumulatedMs) && v.accumulatedMs >= 0
        ? v.accumulatedMs
        : 0
    const startedAt =
      typeof v.startedAt === 'number' && Number.isFinite(v.startedAt) ? v.startedAt : null
    // running 与 startedAt 必须成对：只有时间戳缺失的脏存档一律判为「已停止」
    const running = v.running === true && startedAt !== null
    state = { accumulatedMs, running, startedAt: running ? startedAt : null }
  } catch {
    state = { accumulatedMs: 0, running: false, startedAt: null }
  }
}

/* ---------------- 通知 ---------------- *
 * 显示精度到秒，故 250ms tick 即可（最坏 250ms 延迟），且**秒未变化时不通知**，
 * 避免订阅者每 250ms 白重渲一次。
 */
function ensureTicker(): void {
  if (ticker !== null) return
  ticker = window.setInterval(() => emit(false), 250)
}

function stopTicker(): void {
  if (ticker === null) return
  window.clearInterval(ticker)
  ticker = null
}

function emit(force: boolean): void {
  const sec = Math.floor(elapsedMs() / 1000)
  // 状态切换（起/停/归零）时秒数可能没变，必须 force，否则订阅者收不到通知
  if (!force && sec === lastNotifiedSecond) return
  lastNotifiedSecond = sec
  listeners.forEach((l) => l())
}

/* ---------------- 对 React 的读取接口 ---------------- */

/** 订阅计时变化（配合 useSyncExternalStore） */
export function subscribeCaseTimer(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 当前已用秒数。
 * ⚠️ 作为 useSyncExternalStore 的 getSnapshot 使用，**必须同一秒内返回恒等值**，
 * 否则会触发无限重渲 —— 故取整到秒，不可返回毫秒。
 */
export function getCaseTimerSeconds(): number {
  return Math.floor(elapsedMs() / 1000)
}

/* ---------------- 内部状态迁移 ---------------- */

/** 直接打开 / 刷新落在案例学习域内：沿用存档接着算（无存档则从 0 起） */
function resume(): void {
  if (state.running) {
    ensureTicker()
    return
  }
  state = { accumulatedMs: state.accumulatedMs, running: true, startedAt: Date.now() }
  persist()
  ensureTicker()
  emit(true)
}

/** 从域外真正导航进来：本次训练**归零**重新计时 */
function restart(): void {
  state = { accumulatedMs: 0, running: true, startedAt: Date.now() }
  persist()
  ensureTicker()
  emit(true)
}

/** 离开案例学习域（返回首页 / 去知识宣教）：停止累计，保留已用时长 */
function stop(): void {
  if (state.running) {
    state = { accumulatedMs: elapsedMs(), running: false, startedAt: null }
    persist()
  }
  stopTicker()
  emit(true)
}

/**
 * 路由迁移的结果 —— 供上层据此联动其它「本次训练」级状态
 * （如 quizScore 的答题记录与得分：新一次训练开始时一并清空）。
 */
export type TimerAction = 'stop' | 'resume' | 'restart' | 'continue'

/**
 * 路由迁移入口 —— 由 App 层的 watcher 在 pathname 变化时调用。
 *
 * ⚠️ 必须**幂等**：React StrictMode 下 effect 会跑两遍，同一个 pathname 会被同步两次。
 *   第二次时 lastPath 已是当前路径 → 落进「域内切换」分支（不动），不会把计时重置。
 *
 * 返回值即本次迁移属于哪一种，'restart' 表示「新一次训练开始」。
 */
export function syncCaseTimerWithRoute(pathname: string): TimerAction {
  const inDomain = isCaseStudyRoute(pathname)
  const isFirstSync = lastPath === null
  const wasInDomain = lastPath !== null && isCaseStudyRoute(lastPath)
  lastPath = pathname

  if (!inDomain) {
    // 首页 / 知识宣教 / 其它页面 → 停止计时（返回首页即停止）
    stop()
    return 'stop'
  }
  if (isFirstSync) {
    // 刷新或直接打开：接着已用时长继续（负责人确认）
    resume()
    return 'resume'
  }
  if (!wasInDomain) {
    // 从首页等域外页面进入案例学习：归零重新计时（负责人确认）
    restart()
    return 'restart'
  }
  // 域内切换（模块选择页 ⇄ 四个模块）→ 持续累计，不打断本次计时
  return 'continue'
}

/* ---------------- 显示格式化 ---------------- */

/**
 * 秒 → `MM:SS`（分钟补零两位，如 `00:00` / `05:23`）。
 * 超过 99 分钟时分钟位自然变为三位（`100:00`），不截断 —— 顶栏数字区能容纳。
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** 模块初始化即恢复存档：保证 Header 首帧就能显示刷新前的用时 */
load()
