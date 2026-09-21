/* ------------------------------------------------------------------ *
 * moduleProgress —— 四大调查模块的「学习状态 + 断点续做」单一存储源
 *
 * 负责人 2026-09-18 需求：
 *   ① 模块选择页每张卡片显示学习状态：**未学习 / 学习中 / 已学习**；
 *      「只要点击进去了，就是学习中，只有完整走到最后返回这一级才是已学习」；
 *   ② 还没走到最后就返回上一级时，**下次点击进入该模块要继续之前的进度**。
 *
 * 三态语义（本文件是唯一定义处，页面不得自行推断）：
 *   idle     · 未学习 —— 从未点进过（或「直接退出」后本次不予记录而退回）
 *   studying · 学习中 —— 点进去过、尚未走到终点；`step` 存着断点
 *   done     · 已学习 —— 完整走到模块终点后返回；`step` 清空
 *
 * 断点是**步骤级**的（负责人 2026-09-18 确认）：只记「上次停在哪一步」，
 * 恢复时回到该步骤开头重播，不恢复视频播放到第几秒。
 * step 的具体编码由各模块自定义（如 lab-testing 存 LabPhase、epidemiology 存
 * `stage:phaseKind`），本文件只当作不透明字符串存取，合法值校验由各模块负责。
 *
 * 持久化：localStorage。所有读写都 try/catch —— 隐私模式 / 禁用存储时
 * localStorage 会直接抛异常，此处降级为「本次会话内存态」，绝不让页面崩。
 * ------------------------------------------------------------------ */

/** 四大调查模块 id（与 CaseStudyPage / Header.STAGE_MODULES 一致） */
export type ModuleId = 'epidemiology' | 'food-hygiene' | 'lab-testing' | 'analysis'

/** 未学习 / 学习中 / 已学习 */
export type ModuleStatus = 'idle' | 'studying' | 'done'

export type ModuleProgress = {
  status: ModuleStatus
  /** 断点（步骤级）：上次所在步骤；已学习 / 未学习时为 null */
  step: string | null
}

export const MODULE_IDS: readonly ModuleId[] = [
  'epidemiology',
  'food-hygiene',
  'lab-testing',
  'analysis',
] as const

/**
 * 每个模块的「第一步」——首次进入与「重新学习」的起点，也是各模块恢复时
 * 的兜底值。编码规则与各模块自定义的 step 保持一致：
 *   · epidemiology 走 `stage:phaseKind`（见 EpidemiologyPlayer 的 makeStep）
 *   · 其余三个模块直接存各自的 phase 名
 */
export const MODULE_FIRST_STEP: Record<ModuleId, string> = {
  epidemiology: '0:video',
  'food-hygiene': 'video21',
  'lab-testing': 'watch17',
  analysis: 'video15',
}

/** 三态的中文文案（页面直接取用，避免多处硬编码） */
export const STATUS_LABEL: Record<ModuleStatus, string> = {
  idle: '未学习',
  studying: '学习中',
  done: '已学习',
}

/** 三态对应的场景类名后缀（与 CaseStudyPage.css 的 .status-dot.* 对应） */
export const STATUS_CLASS: Record<ModuleStatus, string> = {
  idle: 'not-started',
  studying: 'in-progress',
  done: 'completed',
}

const STORAGE_KEY = 'gwa10343033.module-progress.v1'

/**
 * 由「阶段常量表」生成类型安全的断点校验器。
 *
 * 各模块的阶段联合类型统一写成 `type Phase = (typeof PHASES)[number]`，
 * 于是 `makeStepGuard(PHASES)` 天然返回 `v is Phase` —— 校验白名单与类型定义
 * 共享同一份数据，新增阶段时不可能忘记同步（手抄白名单迟早会漂移）。
 * 从 localStorage 读回的脏值 / 旧版本残留一律被拦下，当作「无断点」。
 */
export function makeStepGuard<T extends string>(values: readonly T[]) {
  const set: ReadonlySet<string> = new Set<string>(values)
  return (v: string | null | undefined): v is T => v != null && set.has(v)
}

function emptyProgress(): ModuleProgress {
  return { status: 'idle', step: null }
}

function emptyAll(): Record<ModuleId, ModuleProgress> {
  return {
    epidemiology: emptyProgress(),
    'food-hygiene': emptyProgress(),
    'lab-testing': emptyProgress(),
    analysis: emptyProgress(),
  }
}

/**
 * 会话内降级存储：localStorage 不可用（隐私模式/被禁用）时兜底，保证功能仍可用。
 *
 * ⚠ 两者必须成对使用 `storageUnavailable` 开关，**不能**用「读不到就回退内存态」的写法：
 *   localStorage 可用但**根本没有记录**（首次使用 / 用户清了站点数据）时，
 *   「回退内存态」会把本次会话早先的快照复活出来 —— 表现为：清掉存储后旧进度仍显示、
 *   上一题的模块状态串到下一个场景（真实踩坑：RTL 用例间互相污染，根因即此）。
 *   故：只有在**确认存储不可用**时才走内存态，否则「读不到 = 确实没有进度」。
 */
let memoryFallback: Record<string, unknown> | null = null
let storageUnavailable = false

function readRaw(): Record<string, unknown> {
  if (storageUnavailable) return memoryFallback ?? {}
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    storageUnavailable = true // 存储不可用（隐私模式/被禁用）→ 本次会话一律走内存态
    return memoryFallback ?? {}
  }
  if (raw == null) return {} // 存储可用但没有记录 = 确实没有任何进度
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {} // 记录损坏：当作无进度（**不回退内存态**，否则旧快照会复活）
  }
}

function writeRaw(next: Record<string, ModuleProgress>): void {
  memoryFallback = next as unknown as Record<string, unknown>
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 写入失败（典型：Safari 隐私模式 getItem 正常、setItem 抛错）→ 本次会话改走内存态
    storageUnavailable = true
  }
}

/** 把任意脏数据规范化成合法 ModuleProgress —— 非法一律退回「未学习」 */
function normalize(value: unknown): ModuleProgress {
  if (!value || typeof value !== 'object') return emptyProgress()
  const v = value as { status?: unknown; step?: unknown }
  const status: ModuleStatus =
    v.status === 'studying' || v.status === 'done' || v.status === 'idle' ? v.status : 'idle'
  const step = typeof v.step === 'string' && v.step ? v.step : null
  // 「学习中」必须带断点（否则会弹「学习提示」却没有可续的进度）；
  // 「已学习」允许带断点 —— 表示该模块已完成过、其后又重新进入学习且尚未学完。
  if (status === 'studying' && !step) return emptyProgress()
  return { status, step }
}

/** 读取全部模块进度（缺失/损坏的条目自动补齐为「未学习」） */
export function readAllProgress(): Record<ModuleId, ModuleProgress> {
  const raw = readRaw()
  const all = emptyAll()
  for (const id of MODULE_IDS) all[id] = normalize(raw[id])
  return all
}

/** 读取单个模块进度 */
export function readProgress(id: ModuleId): ModuleProgress {
  return readAllProgress()[id]
}

/** 是否有可续的断点 → 决定点卡片时是否弹「学习提示」 */
export function hasResume(id: ModuleId): boolean {
  return Boolean(readProgress(id).step)
}

function update(id: ModuleId, next: ModuleProgress): void {
  const all = readAllProgress()
  all[id] = next
  writeRaw(all)
}

/**
 * 记录断点 —— 点进模块的那一刻、以及模块内每推进一步都调用。
 *
 * 状态迁移：未学习 → 「学习中」；已是「已学习」则**保持「已学习」不降级**
 * （完成成绩不该因为又进去看了一遍就消失），但断点照常记录，
 * 这样已学习的模块重学到一半退出，下次仍能续上。
 */
export function markStudying(id: ModuleId, step: string): void {
  const cur = readProgress(id)
  update(id, { status: cur.status === 'done' ? 'done' : 'studying', step })
}

/** 标记「已学习」并清空断点 —— 完整走到模块终点返回上一级时调用 */
export function markDone(id: ModuleId): void {
  update(id, { status: 'done', step: null })
}

/**
 * 「直接退出：本次学习成绩不予记录」—— 清掉本次断点。
 * 已完成过（「已学习」）的模块保留完成成绩，只清断点；
 * 否则退回「未学习」，下次进入从头开始。
 */
export function discardSession(id: ModuleId): void {
  const cur = readProgress(id)
  update(id, { status: cur.status === 'done' ? 'done' : 'idle', step: null })
}
