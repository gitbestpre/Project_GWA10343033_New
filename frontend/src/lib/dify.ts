/**
 * Dify 对话 —— 浏览器侧通用客户端（一套调用，服务多个应用）
 *
 * 口径来源：仓库根 `AI对接.xlsx`。四个「使用阶段」对应四个 Dify 应用，
 * 基础 URL 均为 `http://line.doctoru.net/v1`：
 *
 *   | 阶段 | 用途           | 应用                        |
 *   |------|----------------|-----------------------------|
 *   | 01   | 知识宣教       | app-hXS4umBTugbHphNsViAe9Gow |
 *   | 02   | 流行病学调查_1 | app-guwldq2RbQkztLYpq3pTI33G |
 *   | 03   | 流行病学调查_1 | app-Njp94jy9tbRF73N6426TfM4K |
 *   | 04   | 结案报告       | app-C1osaQLh0Q2upEDdDr9V7y05 |
 *
 * 四个应用**实测均为聊天 / Chatflow 型**（用「空 inputs 打 /workflows/run」零成本判别，
 * 四个都回 `400 not_workflow_app`），故一律走 `POST /chat-messages`。
 * 响应模式默认 `streaming`，可按调用方要求切 `blocking`（见 `DifyChatParams.responseMode`）——
 * 两种模式的返回值与失败形态差别都写在那个字段的注释里，**切换不影响本文件的解析**：
 * 非 SSE 的 JSON 走同一条「分流二」处理（`extractAnswerFromJson`）。
 * 这也是本文件**不实现 `/workflows/run` 路由**的原因 —— 不是漏了，是当前没有工作流型应用可走；
 * 哪天 xlsx 里加了工作流应用，这里需要补的是「路由选择」+ `workflow_finished` 的 `data.outputs` 抽取。
 * （另两条已实测排除：`/completion-messages` → 400 `app_unavailable`，不是文本生成型应用。）
 *
 * ⚠️ 「不实现 /workflows/run 路由」≠「不认 workflow_* 事件」。Chatflow 跑在同一条
 * `/chat-messages` 上，本来就会推 `workflow_started` / `node_*` / `workflow_finished`；
 * 其中 `workflow_finished.data.outputs` 是**部分编排下回答的唯一出处**，必须处理（见 drain）。
 *
 * 与参考实现（`E:\XWJ\LCSB10001006\frontend-demo\app.js` 的 `callDify` / `readDifyStream`）
 * 的两处**刻意不同**：
 *   1. **密钥不在客户端**。参考实现把 app-* 密钥放在浏览器 localStorage、前端直连 Dify，
 *      那是原型 demo 的做法。这里浏览器只向同源 `/api/dify/<阶段>` 发纯 JSON，
 *      `Authorization: Bearer app-…` 由 vite.config.ts 的 difyProxy 在 Node 侧补上。
 *      故 app-* 密钥既不进浏览器产物，也不进 Git（写在被忽略的 .env.local，且不带 VITE_ 前缀）。
 *   2. **输入变量的键名照搬，但发送时机不同**：参考实现每轮都发 `inputs`；
 *      这里只在调用方显式给了 `inputs` 时才发（当前知识宣教无上下文变量，发空对象无意义）。
 */

/** 同源代理前缀。凭据不在客户端，改这里只是改路径。 */
export const DIFY_ENDPOINT: string = import.meta.env.VITE_DIFY_PATH || '/api/dify'

/* ─────────────────────────── 应用注册表 ─────────────────────────── */

/** 使用阶段（即 `AI对接.xlsx` 的行号）。与 vite.config.ts 的密钥槽位一一对应。 */
export const DIFY_STAGES = ['01', '02', '03', '04'] as const
export type DifyStage = (typeof DIFY_STAGES)[number]

/** 阶段 → 用途。仅用于错误提示与调试，密钥不在客户端自然也不在这张表里。 */
export const DIFY_STAGE_LABELS: Record<DifyStage, string> = {
  '01': '知识宣教',
  '02': '流行病学调查_1',
  '03': '流行病学调查_1',
  '04': '结案报告',
}

/** 默认阶段：知识宣教（第一个接入页）。 */
export const DIFY_DEFAULT_STAGE: DifyStage = '01'

/**
 * 阶段对应的同源代理地址。
 *
 * 阶段放进**路径**而不是请求体，有三个理由：
 *   1. 代理要按阶段挑不同的密钥，路径是最自然的选路依据；
 *   2. 日志 / 抓包一眼能看出这条请求打的是哪个应用；
 *   3. 与参考实现的「一个 Agent 一条路由」同构。
 */
export function difyUrl(stage: DifyStage = DIFY_DEFAULT_STAGE): string {
  return `${DIFY_ENDPOINT}/${stage}`
}

/* ───────────────────────── 匿名用户标识 ───────────────────────── */

const USER_KEY = 'gwa10343033.dify-user.v2'

/** localStorage 不可用时的内存兜底（隐私模式 / 存储被禁用） */
let memoryUser = ''

/**
 * GUID（UUID v4）的形状。
 *
 * 存下来的值也要过这一关：换格式后若只管生成、不管读取，**老用户手里那个
 * 旧格式 id 仍会被原样返回**，格式要求就形同虚设。故读到的值形状不对时
 * 一律视为「没存过」，重新生成。
 */
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * 生成一个 GUID（UUID v4）。
 *
 * 三级退路，缺一不可：
 *  1. `crypto.randomUUID()` —— 最标准，但它**要求安全上下文**（https 或 localhost）。
 *     本项目部署在 http 域名下时它就是 undefined，不能当作必然可用。
 *  2. `crypto.getRandomValues()` —— 自己拼 v4（打上版本位 4 与变体位 10xx），
 *     随机源仍是 CSPRNG。
 *  3. `Math.random()` —— 仅在前两者都缺失时兜底。
 *
 * 这个 id 只用于让 Dify 把同一学员的会话归到一起，**不承担鉴权**，
 * 所以退到第 3 级也只损失「唯一性强度」，不构成安全问题。
 */
function newGuid(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  if (typeof c?.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40 // version 4
    b[8] = (b[8] & 0x3f) | 0x80 // variant 10xx
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * Dify 要求每次请求带一个 `user`，用于隔离会话与统计。本页没有登录态，
 * 用一个本地持久化的匿名 **GUID**：同一浏览器多次进入会命中同一个 user，
 * 便于在 Dify 侧把同一学员的对话归到一起。
 *
 * 为什么用 GUID 而不是可读前缀（如 `stu-xxxxxxxx`）：Dify 侧对 user 的用法
 * 是「当主键用」，GUID 与其余系统（服务端日志、会话导出、后续可能接入的
 * 统一身份）拼接时不会撞形状，也便于按类型校验（见 GUID_RE）。
 *
 * ⚠️ 存储不可用（隐私模式 / 被策略禁用）时必须降级为内存 id 而不是抛错 ——
 * 拿不到 id 不该让对话整个发不出去。内存 id 也只在**本次页面加载内**稳定即可。
 */
export function difyUser(): string {
  try {
    const hit = globalThis.localStorage?.getItem(USER_KEY)
    if (hit && GUID_RE.test(hit)) return hit
  } catch {
    // 读取被拒：直接走内存兜底
  }
  if (!memoryUser) {
    memoryUser = newGuid()
    try {
      globalThis.localStorage?.setItem(USER_KEY, memoryUser)
    } catch {
      // 落盘失败不影响本次会话继续对话
    }
  }
  return memoryUser
}

/* ─────────────────────────── 错误文案 ─────────────────────────── */

/**
 * 把 Dify 的错误码翻成「下一步该做什么」。
 * 直接用上游英文原文（如 `app_unavailable`）对使用者毫无帮助，
 * 而这两类恰恰是接入期最常撞到的，故在此收口成可执行的中文。
 */
const ERROR_HINTS: Record<string, string> = {
  app_unavailable: 'Dify 应用当前不可用（应用未发布或已停用），请在 Dify 控制台确认后重试',
  // 2026-09-20 定案（单变量对照脚本：仓库根 `_probe-user-format.cjs`）：
  //   **`user` 必须是合法 UUID**。只改 user、其余字段全同 ——
  //     UUID   → 200 并产出真实回答
  //     非 UUID → 500，耗时仅 76~103ms（响应头之前就断，回网关 HTML）
  //   也就是说 500 的成因是**调用方自己发的 user 格式不合法**，不是 Dify 侧故障。
  //   ⚠️ 之前一版结论写成「该应用的编排执行有问题 / 已发布快照坏了」，是**错的**：
  //   那两条推断都建立在探测脚本用 `healthcheck-probe` 当 user 的前提上，
  //   即「用错误的输入测出了正确的 500，却归因给了上游」。
  //   前端 `difyUser()` 现在固定给出 UUID v4，故正常链路不会再撞到这个 500。
  // 保留这条 hint 是因为它仍会在**别的调用方**（curl / Postman / 新接入的页面）身上出现，
  // 而 500 是网关 HTML、body 里看不出所以然，提示必须直接指向 user。
  internal_server_error:
    'Dify 返回内部错误：多半是请求里的 user 不是合法 UUID（Dify 只接受 UUID 形式的 user），请检查后再试；若 user 已是 UUID，再到 Dify 控制台查看该应用的运行日志',
  not_configured: '尚未配置该阶段的 DIFY_API_KEY，请在 frontend/.env.local 填写后重启 dev server',
  upstream_unreachable: '对话服务不可达，请检查网络或 Dify 地址',
  empty_query: '请输入要询问的内容',
  bad_json: '请求格式有误（请求体不是合法 JSON）',
  method_not_allowed: '请求方式有误（该接口仅支持 POST）',
  unknown_stage: '请求了未在 AI对接.xlsx 中登记的使用阶段',
}

/** 上游把「工作流未发布」放在 message 里而不是 code 里，需要按文本再判一次 */
function hintFor(code: string, message: string): string {
  if (/not published/i.test(message)) {
    return '该 Dify 应用的工作流尚未发布，请在控制台点「发布」后再试'
  }
  return ERROR_HINTS[code] || ''
}

/** 判断一段文案里是否已有中文 */
const hasChinese = (s: string): boolean => /[\u4e00-\u9fa5]/.test(s)

/**
 * 判断响应体是不是一个 HTML 文档（网关/框架的错误页）。
 *
 * 为什么单独判：Dify 在工作进程里崩掉时，HTTP 层会回自己的 500 页而不是
 * Dify 的结构化错误体（`{"code":...}`）。若不拦这一手，页面上会显示一段
 * `<html><head><title>Internal Server Error…`，对使用者零信息量。
 */
const looksLikeHtml = (s: string): boolean => /^\s*<(!doctype|html|head|body)/i.test(s)

/**
 * 从一段（可能不是 JSON 的）响应体里抽出可展示的错误文案。
 *
 * 两类来源要区别对待：
 *   - **上游 Dify** 的 `message` 是英文（`App unavailable` / `Workflow not published`），
 *     对我们的人毫无帮助 → 按 `code` 换成可执行的中文提示。
 *   - **同源代理** 返回的 `message` 本来就是中文，而且更具体（会带上是哪个阶段没配密钥），
 *     → 原样保留，不要被通用提示顶掉。
 * 判据就是「message 里有没有中文」，简单且不会两头不讨好。
 */
function readErrorMessage(raw: string, status?: number): string {
  const text = raw.trim()
  if (!text) return ''
  try {
    const parsed = JSON.parse(text) as { code?: string; message?: string; status?: number }
    const code = parsed.code || ''
    const message = parsed.message || ''
    if (message && !hasChinese(message)) {
      const hint = hintFor(code, message)
      if (hint) return hint
    }
    if (message) return message
    return hintFor(code, '') || (code ? `对话服务返回错误（${code}）` : '')
  } catch {
    // 非 JSON：可能是 HTML 错误页、半截 SSE 或纯文本
    if (looksLikeHtml(text)) {
      return `上游 Dify 返回了网页错误页（HTTP ${status ?? '?'}），应用内部报错而非请求有误，请到 Dify 控制台查看该应用的运行日志`
    }
  }
  return text.length > 200 ? `${text.slice(0, 200)}…` : text
}

/* ─────────────────────────── 请求与解析 ─────────────────────────── */

export type DifyChatParams = {
  query: string
  /** 走哪个应用。缺省为知识宣教（01）。 */
  stage?: DifyStage
  /**
   * Dify 应用的上下文变量（「提示词编排」里定义的会话变量 / 表单变量）。
   * 与 `query` 的区别：`query` 是用户这句话，`inputs` 是每轮都要带上的背景设定。
   * 当前四个应用都无必填变量（`GET /parameters` 的 `user_input_form` 均为空），
   * 故调用方通常不传；留给 02/03/04 接入时使用。
   * 不传是安全的：代理会补 `{}` 再转发（Dify 把该键当必填，省略会 400）。
   */
  inputs?: Record<string, unknown>
  /** 上一轮拿到的会话 id；首轮留空，由 Dify 下发 */
  conversationId?: string
  /** 匿名用户标识。缺省用 `difyUser()`（一个本地持久化的 GUID）。 */
  user?: string
  /**
   * 响应模式。默认 `streaming`，**本页即用默认值**（见 KnowledgePage 的说明）。
   *
   * - `streaming`：SSE 逐帧返回。可做逐字上屏，且能拿到 `node_started` 的节点进度
   *   （`onNode` 只在流式下有值）。**Dify 官方推荐**。
   * - `blocking`：一次性返回一条 JSON（形如 `{event:'message', answer, conversation_id, metadata}`）。
   *   没有逐字、没有节点进度（`onNode` 永不触发），但上游失败时拿到的是**应用层 JSON 错误体**
   *   （带 `code` 与 `x-version`），比 streaming 的网关 HTML 500 更有诊断价值。
   *   留作可选项：排查上游故障时换它跑一次，能拿到更具体的错误体。
   *
   * ⚠️ 实测（2026-09-20）**两种模式在上游故障时都会 500**，切 blocking 不能绕开故障，
   * 只改变错误的暴露形态。选型要按「是否要逐字/节点进度」来定，而不是按「哪个能通」。
   */
  responseMode?: 'streaming' | 'blocking'
}

export type DifyChatHandlers = {
  /**
   * 每收到一个上游内容事件回调一次，参数是**「到目前为止的完整回答」**而不是增量片段。
   * 这样调用方直接 `setState(text)` 即可，无需自己拼接；也顺带免疫了上游
   * 「answer 是增量还是累计」这个版本差异（见 mergeAnswer）。
   * 同一批到达的多个事件会连续回调（几次 setState 由 React 合批成一次渲染）。
   */
  onUpdate?: (text: string) => void
  /** 拿到 conversation_id（首轮 Dify 下发，后续轮次回传以保持上下文） */
  onConversation?: (id: string) => void
  /**
   * Chatflow 的节点进度：`node_started` 到达时回调该节点的标题（如「知识检索」「LLM」）。
   *
   * 用途是**填住首字前的空窗**。实测该应用从提问到第一个字要 2~3 秒
   * （控制台「追踪」面板：开始 7ms → 知识检索 381ms → LLM 2275ms），
   * 这段静默期界面上若什么都不显示，观感就等同「点了没反应」。
   *
   * 只是**提示性**回调：聊天助手型应用不推 `node_*`，调用方必须容忍它一次都不触发
   * （页面的兜底文案不依赖此回调）。标题是应用作者填的中文，故不外传做展示以外的用途。
   */
  onNode?: (title: string) => void
  onError?: (message: string) => void
}

type DifySseFrame = {
  event?: string
  answer?: string
  conversation_id?: string
  message?: string
  code?: string
  status?: number
  data?: {
    /** `text_chunk` 事件把正文放在这里 */
    text?: string
    /** `workflow_finished` 事件把各节点的最终输出放在这里 */
    outputs?: unknown
    /** `workflow_finished` 的执行结果：succeeded / failed / stopped */
    status?: string
    /** `workflow_finished` 失败时的原因 */
    error?: string
    /** `node_started` / `node_finished` 的节点标题（应用作者填的中文，如「知识检索」） */
    title?: string
  }
}

/**
 * 收敛上游 answer 的两种口径：
 *   - 增量（绝大多数情况）：chunk = '世界'，acc = '你好' → '你好世界'
 *   - 累计（部分节点的实现）：chunk = '你好世界'，acc = '你好' → 直接替换
 * 判据是「chunk 是否以已有内容开头」。极端情况下若某个**真正的增量**恰好
 * 以全文为前缀（如 acc='哈'、真实下一个增量='哈哈'），会被误判成累计而少一个字符——
 * 概率极低，且代价远小于「把累计当增量」导致的整段重复。
 */
export function mergeAnswer(acc: string, chunk: string): string {
  if (!chunk) return acc
  if (acc && chunk.startsWith(acc)) return chunk
  return acc + chunk
}

/** 解析一个 SSE 事件块（以 `data:` 承载 JSON；Dify 也会发 `event:` 行，以 JSON 内的 event 为准） */
export function parseSseFrame(block: string): DifySseFrame | null {
  const dataLines = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
  if (!dataLines.length) return null
  const payload = dataLines.join('\n')
  // Dify 流末会发一条裸 `data: [DONE]` 哨兵，它不是 JSON，按「无事件」跳过
  if (payload === '[DONE]') return null
  try {
    return JSON.parse(payload) as DifySseFrame
  } catch {
    return null
  }
}

/**
 * 从「输出对象」里挑出可朗读的文本。
 *
 * 两类来源都用它：
 *   - 非流式 JSON 响应体的 `data.outputs`；
 *   - 流式终帧 `workflow_finished.data.outputs`。
 *
 * 为什么按候选键逐个试而不是 `Object.values` 取第一个字符串：输出对象里除了正文，
 * 常混着 `status` / `elapsed_time` 之类的过程字段，随便取一个会把过程量当回答念出去。
 * 只认约定俗成的正文键，认不出就返回空串，交给调用方报错 —— 宁可报错，不可念错。
 */
export function pickTextFromOutputs(outputs: unknown): string {
  if (typeof outputs === 'string') return outputs.trim() ? outputs : ''
  if (!outputs || typeof outputs !== 'object') return ''
  const o = outputs as Record<string, unknown>
  for (const key of ['answer', 'text', 'output', 'result', 'content']) {
    const v = o[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}

/**
 * 从**非流式**响应体里抽出回答文本（参考实现 `extractDifyText` 的收窄版）。
 *
 * 上游网关有时会把 SSE 降级成一次性 JSON；此时内容其实是全的，当成错误丢掉很可惜。
 * 与参考实现的差别：它认不出形态时会把整个对象 `JSON.stringify` 出来当回答；
 * 这里**只认已知字段**，认不出就返回空串交给调用方报错 —— 否则一个 HTML 错误页
 * 或结构陌生的响应会被当成「回答」念给学员听。
 */
export function extractAnswerFromJson(raw: string): { answer: string; conversationId?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { answer: '' }
  }
  if (!parsed || typeof parsed !== 'object') return { answer: '' }
  const p = parsed as { answer?: unknown; conversation_id?: unknown; data?: { outputs?: unknown } }
  const conversationId = typeof p.conversation_id === 'string' ? p.conversation_id : undefined
  if (typeof p.answer === 'string') return { answer: p.answer, conversationId }
  const fromOutputs = pickTextFromOutputs(p.data?.outputs)
  if (fromOutputs) return { answer: fromOutputs, conversationId }
  return { answer: '', conversationId }
}

/** 一次 read 的结果：只带「是否结束 / 是否报错」；内容更新一律就地回调 */
type FrameOutcome = {
  error?: string
  done?: boolean
}

/**
 * 发起一轮对话并流式返回。
 *
 * 返回值是**完整回答**（正常结束时 resolve），出错时 reject 并已回调 onError。
 * 中止（AbortSignal / 切页）会以 AbortError reject，调用方按需忽略即可。
 */
export async function streamChat(
  params: DifyChatParams,
  handlers: DifyChatHandlers = {},
  signal?: AbortSignal,
): Promise<string> {
  const mode = params.responseMode || 'streaming'
  const res = await fetch(difyUrl(params.stage), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 与代理侧同一口径：按模式要给对应的 Accept
      Accept: mode === 'blocking' ? 'application/json' : 'text/event-stream',
    },
    body: JSON.stringify({
      query: params.query,
      // 调用方没给上下文变量时这里就不带这个键；但代理会补回 `{}`（Dify 视其为必填）。
      // 别把这里的省略读成「上游也收不到 inputs」——见文件头第 2 条。
      ...(params.inputs ? { inputs: params.inputs } : {}),
      conversation_id: params.conversationId || undefined,
      user: params.user || difyUser(),
      response_mode: mode,
    }),
    signal,
  })

  // 分流一：应用不可用 / 未发布 / 代理未配置密钥时，上游回的是普通 JSON 错误体，不是 SSE。
  // 不先判这里的话，错误体会被当成「流解析出 0 个事件」而静默变成空回答。
  if (!res.ok) {
    const message =
      readErrorMessage(await res.text(), res.status) || `对话服务返回异常（HTTP ${res.status}）`
    handlers.onError?.(message)
    throw new Error(message)
  }

  // 分流二：2xx 但不是 SSE —— 上游网关把流式降级成了一次性 JSON。
  // 内容仍然是全的，按成功处理（参考实现同此口径）。认不出回答字段则照旧报错，
  // 免得把网关的 HTML 错误页当作回答。
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    const raw = await res.text()
    const { answer, conversationId } = extractAnswerFromJson(raw)
    if (!answer) {
      const message = readErrorMessage(raw, res.status) || `对话服务返回异常（HTTP ${res.status}）`
      handlers.onError?.(message)
      throw new Error(message)
    }
    if (conversationId) handlers.onConversation?.(conversationId)
    handlers.onUpdate?.(answer)
    return answer
  }

  if (!res.body) {
    const message = '对话服务未返回内容'
    handlers.onError?.(message)
    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''

  /**
   * 把缓冲区里**所有**已完整的事件逐个消费掉。
   *
   * ⚠️ 必须逐个事件回调，不能「循环完只把最终值回调一次」：Dify 常把多个
   * `message` 事件打进同一个 TCP 段，一次 read 就拿到好几个字的增量。
   * 只回调最终值虽然内容没错，但打字机会退化成一跳好几个字。
   * （同一 tick 内的多次 setState 会被 React 自动合批成一次渲染，这是预期内的。）
   */
  const drain = (): FrameOutcome => {
    const outcome: FrameOutcome = {}
    for (;;) {
      // SSE 事件以空行分隔：\n\n 或 \r\n\r\n
      const cut = buffer.search(/\r?\n\r?\n/)
      if (cut < 0) break
      const block = buffer.slice(0, cut)
      buffer = buffer.slice(cut + (buffer[cut] === '\r' ? 4 : 2))

      const frame = parseSseFrame(block)
      if (!frame) continue
      if (frame.conversation_id) handlers.onConversation?.(frame.conversation_id)

      /**
       * 节点进度：只取 `node_started`（进入某节点），不取 `node_finished`。
       * 两者都推的话，界面上会先显示「正在检索知识库」再跳回上一个节点的文案，
       * 而用户关心的是「现在跑到哪了」，不是「刚才跑完了什么」。
       */
      if (frame.event === 'node_started' && frame.data?.title) {
        handlers.onNode?.(frame.data.title)
        continue
      }

      if (frame.event === 'error') {
        outcome.error =
          hintFor(frame.code || '', frame.message || '') || frame.message || '对话服务返回错误'
        return outcome
      }

      /**
       * Chatflow 的终帧。处理它的理由不是「顺手多认一种事件」，而是一个实测过的
       * 空白回答形态：**LLM 节点不向客户端流式吐字时，全文只出现在这一帧的
       * `data.outputs` 里**。此前忽略该帧的后果是，凡遇到这种编排，页面上就是一个
       * 空气泡外加一句「对话服务未返回任何内容」—— 上游明明成功，用户却什么都没拿到。
       *
       * 兜底写在「一个字都没收到」时：若 `message` 事件已经吐过内容，那是更细的
       * 流式结果，不应被终帧的整段文本覆盖（覆盖会让打字机在末尾突然整体重置）。
       */
      if (frame.event === 'workflow_finished') {
        if (frame.data?.status === 'failed') {
          outcome.error =
            frame.data.error ||
            '对话生成失败（工作流执行中断），请到 Dify 控制台查看该应用的运行日志'
          return outcome
        }
        if (!answer) {
          const text = pickTextFromOutputs(frame.data?.outputs)
          if (text) {
            answer = text
            handlers.onUpdate?.(answer)
          }
        }
        continue
      }

      // `message_replace` 是**替换**语义：上游（通常是内容审核钩子）判定前面已吐出的
      // 内容不合规，用这一条把整段回答顶掉。若按增量 merge 处理，会得到「旧文 + 新文」
      // 的拼接结果 —— 这正是参考实现单独判这个事件的原因。
      if (frame.event === 'message_replace' && typeof frame.answer === 'string') {
        answer = frame.answer
        handlers.onUpdate?.(answer)
        continue
      }

      const chunk =
        (frame.event === 'message' || frame.event === 'agent_message') && frame.answer
          ? frame.answer
          : frame.event === 'text_chunk' && typeof frame.data?.text === 'string'
            ? frame.data.text
            : ''
      if (chunk) {
        answer = mergeAnswer(answer, chunk)
        handlers.onUpdate?.(answer)
      }

      if (frame.event === 'message_end') outcome.done = true
    }
    return outcome
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const outcome = drain()
    if (outcome.error) {
      handlers.onError?.(outcome.error)
      throw new Error(outcome.error)
    }
    if (outcome.done) {
      // ⚠️ 这里必须再守一次空回答，不能直接 return answer。
      // `message_end` 会提前跳出读循环，从而绕过函数末尾那道 `!answer` 守卫；
      // 于是「上游发了 message_end 但一个字都没吐」（模型返回空、内容审核清空、
      // 编排里 Answer 节点没接上）就会 resolve 出一个空串。调用方拿到空串既不会
      // 走成功分支（没内容可念）也不会走错误分支（没有异常），页面上表现为
      // 字幕条直接消失 —— 使用者看到的正是「空气泡 / 点了没反应」。
      if (!answer) {
        const message = '对话服务未返回任何内容'
        handlers.onError?.(message)
        throw new Error(message)
      }
      return answer
    }
  }

  // 收尾：上游若省略了结尾空行，flush 一次，避免最后一段被留在 buffer 里
  buffer += decoder.decode()
  const tail = drain()
  if (tail.error) {
    handlers.onError?.(tail.error)
    throw new Error(tail.error)
  }
  if (!answer) {
    const message = '对话服务未返回任何内容'
    handlers.onError?.(message)
    throw new Error(message)
  }
  return answer
}
