/**
 * MiniMax 云端语音合成 —— 浏览器侧客户端
 *
 * 口径来源：Unity 端 `MiniMaxTTS.SpeakWav_url`（非流式的 HTTP 路径，也是脚本中真正被调用的那条）。
 * 保留的调用语义：
 *   POST {endpoint}?GroupId=…
 *   { model, text, stream:false, output_format:'hex',
 *     voice_setting:{ voice_id, speed, vol, pitch, emotion },
 *     audio_setting:{ sample_rate, bitrate, format, channel },
 *     language_boost:'Chinese' }
 *   → 响应 data.audio 为整段音频的 HEX 字符串 → 转字节 → 落盘（Unity）/ 转 Blob（浏览器）
 *
 * 与 Unity 端的差异（均为运行环境所迫，逐条说明）：
 *   1. 鉴权：Unity 客户端直连并自带 Auth；浏览器把凭据交给同源 /api/tts 由服务端代发，
 *      否则 API Key 会随 JS 产物泄露给任何访客。见 vite.config.ts 的 minimax-tts-proxy。
 *   2. 落盘 → 内存：Unity 写 `Application.temporaryCachePath/download_{md5}.wav`；
 *      浏览器改为 Blob + objectURL，不触碰用户磁盘。
 *   3. 缓存键：Unity 用 MD5(text) 命名文件；浏览器没有 WebCrypto MD5，改用 FNV-1a 双轮
 *      32 位散列（只为去重，不承担安全职责）。
 *   4. 整段 → 分块：Unity 一次性提交全文等一个完整音频；浏览器按行/句切块并预取下一块，
 *      既压低首帧延迟，也让「朗读到哪一段」可高亮、可定位。
 *   5. 音频格式：Unity 在 HTTP 路径上强制 wav；浏览器默认 mp3（同采样率下体积约为 1/4，
 *      否则缓存几段就会吃掉百兆内存），格式仍是音色表的可配置字段。
 *   6. 未实现 WebSocket 流式路径：浏览器 WebSocket API 不允许自定义请求头，
 *      无法带上 MiniMax 要求的 Authorization，故只走 HTTP 非流式。
 */

/* ─────────────────────────── 音色表 ─────────────────────────── */

export type TtsEmotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised'

export type TtsVoice = {
  /** 前端内部标识（可安全用作 select value） */
  key: string
  label: string
  /** 说明文案，用于 title 提示 */
  note: string
  voiceId: string
  model: string
  emotion: TtsEmotion
  speed: number
  pitch: number
  vol: number
  sampleRate: number
  bitrate: number
  format: 'mp3' | 'wav'
}

/**
 * 音色表。
 * - `narrator-female`：知识宣教页的默认讲解音色（需求方控制台配置口径：
 *   presenter_female / speech-02-turbo / neutral / 32000Hz / mp3）。
 * - 其余五项逐条对应 Unity 脚本 `switch (index)` 的 0~4 分支，参数原样照搬
 *   （含 pitch/speed 差异），供后续角色对话场景复用。
 */
export const TTS_VOICES: readonly TtsVoice[] = [
  {
    key: 'narrator-female',
    label: '女主持人',
    note: '专业亲和，适合知识讲解',
    voiceId: 'presenter_female',
    model: 'speech-02-turbo',
    emotion: 'neutral',
    speed: 1,
    pitch: 0,
    vol: 1,
    sampleRate: 32000,
    bitrate: 128000,
    format: 'mp3',
  },
  
]

export const DEFAULT_VOICE_KEY = TTS_VOICES[0].key

export function findVoice(key: string): TtsVoice {
  return TTS_VOICES.find((v) => v.key === key) ?? TTS_VOICES[0]
}

/* ─────────────────────── 文本 → 可朗读化 ─────────────────────── */

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
const CIRCLED_RE = new RegExp(`[${CIRCLED}]`, 'g')

/**
 * 把「排版用文本」转成「朗读用文本」。
 * 只影响送进 TTS 的字符串，**不改变页面上的渲染文本**（正文用 6 空格做视觉缩进、
 * 用 （1） 和 ① 做编号，这些在屏幕上必要，但念出来只会添乱）。
 */
export function toSpeakable(raw: string): string {
  let t = raw
  // 行首编号（（1）/（一））→ 省略
  t = t.replace(/^\s*[（(]\s*\d+\s*[）)]\s*/, '')
  t = t.replace(/^\s*[（(]\s*[一二三四五六七八九十]+\s*[）)]\s*/, '')
  // 圈码 → 逗号（保留枚举停顿，但不念符号名）
  t = t.replace(CIRCLED_RE, '，')
  // 符号 → 中文读法
  t = t.replace(/≥/g, '大于等于')
  t = t.replace(/≤/g, '小于等于')
  t = t.replace(/℃/g, '摄氏度')
  t = t.replace(/[~～]/g, '到')
  t = t.replace(/×/g, '乘以')
  // 缩进与连续空白
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

/**
 * 去掉 Markdown 排版标记，只留下可朗读的正文。
 *
 * 为什么不并进 `toSpeakable`：本页正文是手写的纯文本（编号用 （1）/①），而**导师回答
 * 来自 Dify**，常带回 `**加粗**`、`# 标题`、`- 列表`、`[文字](链接)`。这些符号念出来
 * 是噪音，但对正文既不存在也无从谈起，所以只在朗读回答时单独套一层。
 *
 * 落单的 `* _ ~ \`` 统一删除：宁可少一个下划线，也好过把「星号星号」念出来。
 */
export function stripMarkdown(raw: string): string {
  let t = raw
  // 行首标题 / 无序列表 / 有序列表标记（连同其后的空格）
  t = t.replace(/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)/, '')
  // 链接与图片：保留可见文字，丢掉地址
  t = t.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
  // 成对强调标记：去标记留文字（*** 先于 ** 处理）
  t = t.replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1')
  t = t.replace(/\*([^*\n]+)\*/g, '$1')
  t = t.replace(/__([^_]+)__/g, '$1')
  t = t.replace(/~~([^~]+)~~/g, '$1')
  // 行内代码的反引号，以及所有落单的标记符号
  t = t.replace(/[*_~`]/g, '')
  return t
}

/* ───────────────────────── 分段（切块） ───────────────────────── */

export type TtsSegment = {
  /** 送进 TTS 的文本 */
  text: string
  /** 该块覆盖的行下标（对应调用方给的行数组，用于同步高亮） */
  lines: number[]
}

/** 单块目标字数：偏小 → 首帧快、切点密；偏大 → 请求少、跨段停顿少 */
export const SEGMENT_MAX_CHARS = 220

/** 超长单行按句读切分：句末标点优先，兜底按长度硬切 */
function splitLongLine(text: string, max: number): string[] {
  const out: string[] = []
  const soft = Math.floor(max * 0.6)
  let cur = ''
  for (const ch of text) {
    cur += ch
    const atSentence = '。！？；!?;'.includes(ch) && cur.length >= soft
    if (atSentence || cur.length >= max) {
      out.push(cur)
      cur = ''
    }
  }
  if (cur) out.push(cur)
  return out
}

/**
 * 按行切块：行是天然的语义边界，尽量多行合并成一块，块内不跨行切断。
 * 返回的 `lines` 保留原始行下标，空行会被跳过但**不打断下标对应关系**。
 */
export function segmentLines(lines: readonly string[], max = SEGMENT_MAX_CHARS): TtsSegment[] {
  const segments: TtsSegment[] = []
  let buf = ''
  let bufLines: number[] = []

  const flush = () => {
    const text = buf.trim()
    if (text) segments.push({ text, lines: [...new Set(bufLines)] })
    buf = ''
    bufLines = []
  }

  lines.forEach((raw, i) => {
    const speakable = toSpeakable(raw)
    if (!speakable) return
    const parts = speakable.length > max ? splitLongLine(speakable, max) : [speakable]
    for (const part of parts) {
      if (buf && buf.length + 1 + part.length > max) flush()
      buf = buf ? `${buf} ${part}` : part
      bufLines.push(i)
    }
  })
  flush()

  return segments
}

/* ─────────────────────────── 请求与缓存 ─────────────────────────── */

/** 同源代理路由。凭据不在客户端，改这里只是改路径。 */
export const TTS_ENDPOINT: string = import.meta.env.VITE_TTS_PATH || '/api/tts'

/** 缓存上限（按块计）。mp3 单块约 200~600KB，30 块 ~ 十几兆，够一轮复习且不失控 */
const CACHE_LIMIT = 30

const audioCache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

/** FNV-1a 32 位 ×2 轮：仅用于缓存去重（Unity 端此处用的是 MD5 文件名，浏览器无 WebCrypto MD5） */
export function textKey(text: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 0x01000193) >>> 0
    h2 = (h2 + c * (i + 1)) >>> 0
    h2 = Math.imul(h2 ^ (h2 >>> 15), 0x2545f491) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

/** 送进 /api/tts 的请求体；字段口径与 Unity 端一致，故单独建型便于比对 */
export type MiniMaxTtsPayload = {
  model: string
  text: string
  stream: boolean
  output_format: 'hex'
  language_boost: 'Chinese'
  voice_setting: {
    voice_id: string
    speed: number
    vol: number
    pitch: number
    emotion: TtsEmotion
  }
  audio_setting: {
    sample_rate: number
    bitrate: number
    format: TtsVoice['format']
    channel: number
  }
}

export function buildPayload(text: string, voice: TtsVoice): MiniMaxTtsPayload {
  return {
    model: voice.model,
    text,
    stream: false,
    output_format: 'hex',
    language_boost: 'Chinese',
    voice_setting: {
      voice_id: voice.voiceId,
      speed: voice.speed,
      vol: voice.vol,
      pitch: voice.pitch,
      emotion: voice.emotion,
    },
    audio_setting: {
      sample_rate: voice.sampleRate,
      bitrate: voice.bitrate,
      format: voice.format,
      channel: 1,
    },
  }
}

/** HEX 字符串 → 字节数组（对齐脚本 HexStringToByteArray，追加了合法性校验） */
export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.trim()
  if (clean.length === 0 || clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
    throw new Error('音频 HEX 数据格式非法')
  }
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return bytes
}

const MIME: Record<TtsVoice['format'], string> = { mp3: 'audio/mpeg', wav: 'audio/wav' }

type MiniMaxResponse = {
  data?: { audio?: string }
  base_resp?: { status_code?: number; status_msg?: string }
}

/** 取一块音频的可播放 URL：命中缓存直接返回，同块并发只发一次请求 */
async function fetchSegmentUrl(text: string, voice: TtsVoice, signal: AbortSignal): Promise<string> {
  const cacheKey = `${voice.key}::${textKey(text)}`
  const hit = audioCache.get(cacheKey)
  if (hit) return hit
  const running = inflight.get(cacheKey)
  if (running) return running

  const task = (async () => {
    const res = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(text, voice)),
      signal,
    })
    const raw = await res.text()

    let parsed: MiniMaxResponse
    try {
      parsed = JSON.parse(raw) as MiniMaxResponse
    } catch {
      throw new Error(`语音服务返回非 JSON（HTTP ${res.status}）`)
    }

    const code = parsed.base_resp?.status_code
    if (typeof code === 'number' && code !== 0) {
      throw new Error(parsed.base_resp?.status_msg || `语音合成失败（错误码 ${code}）`)
    }
    const hex = parsed.data?.audio
    if (!hex) throw new Error('语音服务未返回音频数据')

    const url = URL.createObjectURL(new Blob([hexToBytes(hex)], { type: MIME[voice.format] }))
    audioCache.set(cacheKey, url)
    if (audioCache.size > CACHE_LIMIT) {
      const oldest = audioCache.keys().next().value
      if (typeof oldest === 'string') {
        const stale = audioCache.get(oldest)
        audioCache.delete(oldest)
        if (stale) URL.revokeObjectURL(stale)
      }
    }
    return url
  })()

  inflight.set(cacheKey, task)
  try {
    return await task
  } finally {
    inflight.delete(cacheKey)
  }
}

/** 仅供测试：清空缓存并释放 objectURL */
export function resetTtsCache(): void {
  for (const url of audioCache.values()) URL.revokeObjectURL(url)
  audioCache.clear()
  inflight.clear()
}

/* ─────────────────────────── 播放控制器 ─────────────────────────── */

export type TtsStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export type TtsSnapshot = {
  status: TtsStatus
  /** 当前块下标（0 起） */
  index: number
  total: number
  muted: boolean
  error: string
  /** 起播被浏览器自动播放策略拦下（该文档尚未获得用户手势授权） */
  blocked: boolean
}

const IDLE: TtsSnapshot = { status: 'idle', index: 0, total: 0, muted: false, error: '', blocked: false }

/**
 * 顺序播放器：一次一块，播到块尾自动取下一块；当前块开始播放时即预取下一块。
 * 暂停不打断 for 循环 —— 循环停在 await 上，`resume()` 让音频继续，循环自然接上。
 */
export class TtsController {
  private snap: TtsSnapshot = IDLE
  private listeners = new Set<() => void>()
  private audio: HTMLAudioElement | null = null
  private segments: TtsSegment[] = []
  private voice: TtsVoice = TTS_VOICES[0]
  /** 代纪：每次 stop/start 自增，用来作废旧的异步链 */
  private epoch = 0
  private abort: AbortController | null = null
  /** 放行当前 await 的钩子（stop 时调用） */
  private release: (() => void) | null = null

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getSnapshot = (): TtsSnapshot => this.snap

  private emit(patch: Partial<TtsSnapshot>): void {
    const next = { ...this.snap, ...patch }
    const keys = Object.keys(next) as (keyof TtsSnapshot)[]
    if (keys.every((k) => next[k] === this.snap[k])) return
    this.snap = next
    for (const fn of this.listeners) fn()
  }

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.muted = this.snap.muted
      this.audio = audio
    }
    return this.audio
  }

  get active(): boolean {
    return this.snap.status === 'loading' || this.snap.status === 'playing' || this.snap.status === 'paused'
  }

  toggleMute(): void {
    const muted = !this.snap.muted
    if (this.audio) this.audio.muted = muted
    this.emit({ muted })
  }

  /** 从头播放一段（会自动打断上一次播放） */
  async play(segments: readonly TtsSegment[], voice?: TtsVoice): Promise<void> {
    this.stop()
    if (!segments.length) return
    this.segments = [...segments]
    if (voice) this.voice = voice
    const epoch = ++this.epoch
    this.abort = new AbortController()
    this.emit({ status: 'loading', index: 0, total: this.segments.length, error: '', blocked: false })

    for (let i = 0; i < this.segments.length; i++) {
      if (epoch !== this.epoch) return
      this.emit({ status: 'loading', index: i })

      let url: string
      try {
        url = await fetchSegmentUrl(this.segments[i].text, this.voice, this.abort.signal)
      } catch (e) {
        if (epoch !== this.epoch) return
        this.emit({ status: 'error', error: e instanceof Error ? e.message : String(e), blocked: false })
        return
      }
      if (epoch !== this.epoch) return

      // 预取下一块：当前块正在播的这几秒足够把下一块取回来
      const next = this.segments[i + 1]
      if (next) void fetchSegmentUrl(next.text, this.voice, this.abort.signal).catch(() => {})

      const audio = this.ensureAudio()
      audio.muted = this.snap.muted
      audio.src = url
      this.emit({ status: 'playing' })

      // 三种收尾：播完 / 被打断（stop 或换页）/ 被自动播放策略拦下
      const outcome = await new Promise<'ended' | 'interrupted' | 'blocked'>((resolve) => {
        const onEnd = (): void => {
          audio.removeEventListener('ended', onEnd)
          resolve('ended')
        }
        audio.addEventListener('ended', onEnd)
        this.release = () => {
          audio.removeEventListener('ended', onEnd)
          resolve('interrupted')
        }
        // 老浏览器 / 无媒体实现的宿主里 play() 返回 undefined，不能无条件 .catch
        const started = audio.play() as Promise<void> | undefined
        if (started && typeof started.catch === 'function') {
          started.catch(() => {
            audio.removeEventListener('ended', onEnd)
            this.release = null
            resolve('blocked')
          })
        }
      })
      this.release = null

      if (outcome === 'interrupted' || epoch !== this.epoch) return
      if (outcome === 'blocked') {
        // 自动播放被拦下不是「坏了」，而是需要一次用户手势。单独标记 blocked，
        // 好让按钮显示成「播放文字」引导点击，而不是「重新播放」这种像是出错的措辞。
        audio.removeAttribute('src')
        this.emit({ status: 'error', blocked: true, error: '浏览器阻止了自动播放，请点击「播放文字」开始' })
        return
      }
    }

    if (epoch === this.epoch) this.emit({ status: 'idle', index: 0, error: '' })
  }

  pause(): void {
    if (this.snap.status !== 'playing') return
    this.audio?.pause()
    this.emit({ status: 'paused' })
  }

  resume(): void {
    if (this.snap.status !== 'paused') return
    this.emit({ status: 'playing' })
    void this.audio?.play().catch(() => this.release?.())
  }

  stop(): void {
    this.epoch++
    this.abort?.abort()
    this.abort = null
    const release = this.release
    this.release = null
    release?.()
    if (this.audio) {
      this.audio.pause()
      this.audio.removeAttribute('src')
    }
    this.segments = []
    this.emit({ status: 'idle', index: 0, total: 0, error: '', blocked: false })
  }
}
