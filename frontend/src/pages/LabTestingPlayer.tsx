import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import StageLayout from '../components/layout/StageLayout'
import Header from '../components/Header'
import './EpidemiologyPlayer.css'
import './LabTestingPlayer.css'

/* ------------------------------------------------------------------ *
 * 实验室检测模块 · 样品处理操作链
 *
 *   watch17      查看实验视频 17.mp4（原生控制条，下一步 / 退出视频；徽标「查看实验视频」）
 *   play01       下一步播 01.mp4，同步讲解音 7.mp3
 *   tools        01 播完：右侧 10 件道具栏，提示「把缓冲蛋白胨水(BPW)放至秤上」+提示音 8.mp3
 *                            → 点道具栏 BPW
 *   op02         播 02.mp4（BPW 上秤，末值 362.00g），道具栏常驻
 *   tareWait     02 末帧：画面自带「请点击归零」红箭头引导，叠加秤面橙色 Tare 钮热区 → 点热区
 *   op03         播 03.mp4（归零 0.00g），道具栏常驻
 *   pickFoodWait 03 末帧：提示「点击食品样品」→ 点道具栏「食品样品」
 *   op04         播 04.mp4（食品样品投入 BPW），道具栏常驻
 *   pickHomoWait 04 末帧：提示「点击匀质机」→ 点道具栏「匀质机」
 *   op05         播 05.mp4（匀质机就位），播完停末帧（后续去向待需求）
 *
 * 底部提示胶囊：样品处理阶段（tools 起）容器始终保留（无文案时也在），仅引导步骤显示文案。
 * 道具栏：tools 起常驻；每步仅当前目标道具可点，已用道具保留高亮表示操作顺序。
 * 全程：左上机器人+白胶囊徽标（查看17=「查看实验视频」，其后=「样品处理」）；
 *      顶栏返回弯箭头（/lab-testing -> /case-study）随时退出。
 * ------------------------------------------------------------------ */

type LabPhase =
  | 'watch17'
  | 'play01'
  | 'tools'
  | 'op02'
  | 'tareWait'
  | 'op03'
  | 'pickFoodWait'
  | 'op04'
  | 'pickHomoWait'
  | 'op05'

/** 操作讲解 / 提示配音（Audio/实验室检测/） */
const NARRATE_7 = '/Audio/实验室检测/7.mp3'
const HINT_8 = '/Audio/实验室检测/8.mp3'

/** 操作视频 01..05（Video/操作视频/） */
const OP_SRC: Record<string, string> = {
  play01: '/Video/操作视频/01.mp4',
  op02: '/Video/操作视频/02.mp4',
  op03: '/Video/操作视频/03.mp4',
  op04: '/Video/操作视频/04.mp4',
  op05: '/Video/操作视频/05.mp4',
}

/** 会自动播放操作视频的阶段（等待阶段停在同元素末帧，不重挂） */
const OP_PLAY_PHASES: LabPhase[] = ['play01', 'op02', 'op03', 'op04', 'op05']
/** 操作视频元素需挂载的阶段（播放阶段 + 其后停末帧的等待阶段） */
const OP_VIDEO_PHASES: LabPhase[] = [
  'play01', 'tools',
  'op02', 'tareWait',
  'op03', 'pickFoodWait',
  'op04', 'pickHomoWait',
  'op05',
]
/** 道具栏常驻阶段（tools 起） */
const RAIL_PHASES: LabPhase[] = [
  'tools', 'op02', 'tareWait', 'op03', 'pickFoodWait', 'op04', 'pickHomoWait', 'op05',
]

/** 每个等待阶段「当前可点击的目标道具」 */
const PICK_TARGET: Partial<Record<LabPhase, string>> = {
  tools: 'bpw',
  pickFoodWait: 'food-sample',
  pickHomoWait: 'homogenizer',
}

/** 到达某阶段时已使用、需保持高亮的道具（记录操作顺序） */
const USED_BY_PHASE: Record<string, string[]> = {
  tools: [],
  op02: ['bpw'], tareWait: ['bpw'], op03: ['bpw'], pickFoodWait: ['bpw'],
  op04: ['bpw', 'food-sample'], pickHomoWait: ['bpw', 'food-sample'],
  op05: ['bpw', 'food-sample', 'homogenizer'],
}

/** 各引导阶段底部提示胶囊文案（无键则只保留空胶囊容器） */
const HINT_TEXT: Partial<Record<LabPhase, string>> = {
  tools: '提示：把缓冲蛋白胨水（BPW）放至秤上',
  pickFoodWait: '提示：点击食品样品',
  pickHomoWait: '提示：点击匀质机',
}

/**
 * 02.mp4 末帧秤面右侧橙色 Tare（归零）按钮热区。
 * 像素实测橙钮 bbox x1117..1171 / y728..751（中心 1144,739），外扩为 100×64 容错热区，
 * 右缘 1194 避开末帧自带的红色引导箭头。
 */
const TARE_HOTSPOT = { left: 1094, top: 707, width: 100, height: 64 }

/** 右侧道具栏的 10 件道具（5 行 × 2 列）。
 *  id 驱动交互：bpw / food-sample / homogenizer 在不同阶段可点，其余暂为展示。 */
const LAB_TOOLS: { id: string; img: string; label: string }[] = [
  { id: 'homogenizer', img: '/images/lab-tools/homogenizer.png', label: '匀质机' },
  { id: 'incubator', img: '/images/lab-tools/incubator.png', label: '隔水式恒温培养箱' },
  { id: 'food-sample', img: '/images/lab-tools/food-sample.png', label: '食品样品' },
  { id: 'bpw', img: '/images/lab-tools/bpw.png', label: '缓冲蛋白胨水（BPW）' },
  { id: 'sc-broth', img: '/images/lab-tools/sc-broth.png', label: 'SC增菌液' },
  { id: 'ttb-broth', img: '/images/lab-tools/ttb-broth.png', label: 'TTB增菌液' },
  { id: 'inoculating-loop', img: '/images/lab-tools/inoculating-loop.png', label: '接种环' },
  { id: 'tsi-agar', img: '/images/lab-tools/tsi-agar.png', label: '三糖铁（TSI）琼脂' },
  { id: 'petri-dish', img: '/images/lab-tools/petri-dish.png', label: '平皿' },
  { id: 'o-antiserum', img: '/images/lab-tools/o-antiserum.png', label: '多价菌体（O）抗血清' },
]

const PILL_H = 64
const CAP_R = 31.614 // 右端圆头半径（与食品卫生 stage-pill 同几何）
const TEXT_LEFT = 34
const TEXT_RIGHT_PAD = 46
const PILL_FONT =
  '500 26px "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'

function buildPillPath(width: number): string {
  const t = width - CAP_R
  return [
    `M ${t.toFixed(3)} 0`,
    `C ${(t + 17.46).toFixed(3)} 0 ${width.toFixed(3)} 14.154 ${width.toFixed(3)} 31.614`,
    `C ${width.toFixed(3)} 49.074 ${(t + 17.46).toFixed(3)} 63.228 ${t.toFixed(3)} 63.228`,
    'H 0',
    'C 8.358 53.378 13.375 40.780 13.375 27.050',
    'C 13.375 17.263 10.826 8.051 6.335 0',
    'Z',
  ].join(' ')
}

function StagePill({ text }: { text: string }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [textW, setTextW] = useState(() => text.length * 27)
  useLayoutEffect(() => {
    if (textRef.current) setTextW(textRef.current.offsetWidth)
  }, [text])
  const width = Math.ceil(TEXT_LEFT + textW + TEXT_RIGHT_PAD)
  const d = buildPillPath(width)
  return (
    <span className="lab-badge-pill" style={{ width, height: PILL_H }}>
      <svg
        className="lab-pill-svg"
        width={width}
        height={PILL_H}
        viewBox={`0 0 ${width} ${PILL_H}`}
        aria-hidden="true"
      >
        <defs>
          <mask id="lab-pill-inside" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={width} height={PILL_H} fill="black" />
            <path d={d} fill="white" stroke="white" strokeWidth="4" />
          </mask>
        </defs>
        <path d={d} fill="#ffffff" />
        <path d={d} fill="none" stroke="#1949A9" strokeWidth="4" mask="url(#lab-pill-inside)" />
      </svg>
      <span ref={textRef} className="lab-badge-text" style={{ font: PILL_FONT, left: TEXT_LEFT }}>
        {text}
      </span>
    </span>
  )
}

export default function LabTestingPlayer() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<LabPhase>('watch17')
  const [needPlay, setNeedPlay] = useState(false)

  // 17.mp4（查看，原生控制条）
  const watchRef = useRef<HTMLVideoElement>(null)
  // 操作视频（01 / 02，自动播放，同一元素按 src 切换）
  const opRef = useRef<HTMLVideoElement>(null)
  // 讲解 / 提示配音
  const narrRef = useRef<HTMLAudioElement>(null)

  const playAudio = (src: string) => {
    const el = narrRef.current
    if (!el) return
    if (el.src !== src) el.src = src
    el.currentTime = 0
    el.play().catch(() => {}) // 答题/点击后一般已获用户激活；被拦截则静默不阻塞
  }

  // 进入页面尝试有声自动播放 17.mp4；被拦截则显示点击播放提示
  useEffect(() => {
    if (phase !== 'watch17') return
    const el = watchRef.current
    if (!el) return
    el.play().catch((err: DOMException) => {
      if (err?.name !== 'AbortError' && el.paused) setNeedPlay(true)
    })
  }, [phase])

  // 操作视频自动播放：进入任一操作视频阶段（01..05）即播对应 mp4。
  // 元素带 key 重挂、src 已在 JSX 上，浏览器自动 load，切勿再手动 el.load()——
  // StrictMode 双调用 effect 时二次 load() 会中止首次 play()（AbortError），误弹点播遮罩。
  useEffect(() => {
    if (!OP_PLAY_PHASES.includes(phase)) return
    setNeedPlay(false)
    const el = opRef.current
    if (!el) return
    el.play().catch((err: DOMException) => {
      // 被后续 load/切源中止（AbortError）时视频实际仍会播放，不弹遮罩；仅确仍暂停才提示手动播放
      if (err?.name !== 'AbortError' && el.paused) setNeedPlay(true)
    })
    const au = narrRef.current
    if (phase === 'play01') {
      playAudio(NARRATE_7) // 01 同步讲解音
    } else if (au) {
      au.pause() // 02 起不再叠加配音；若 8.mp3 在响则停止，避免与视频音叠加
    }
  }, [phase])

  // tools：01.mp4 播完进入，播放提示音 8.mp3（仅进入时一次）
  useEffect(() => {
    if (phase === 'tools') playAudio(HINT_8)
  }, [phase])

  const startWatch = () => {
    const el = watchRef.current
    if (!el) return
    el.muted = false
    setNeedPlay(false)
    el.play().catch(() => {})
  }

  const startOp = () => {
    const el = opRef.current
    if (!el) return
    el.muted = false
    setNeedPlay(false)
    el.play().catch(() => {})
    if (phase === 'play01') playAudio(NARRATE_7)
  }

  // 点道具栏：仅当前等待阶段的目标道具生效，进入对应操作视频
  const handlePickTool = (id: string) => {
    if (PICK_TARGET[phase] !== id) return
    setNeedPlay(false)
    if (id === 'bpw') setPhase('op02')
    else if (id === 'food-sample') setPhase('op04')
    else if (id === 'homogenizer') setPhase('op05')
  }

  // 点秤面橙色 Tare 归零热区（02 末帧）→ 播 03.mp4
  const handleTare = () => setPhase('op03')

  // 各操作视频播完去向（05 播完停末帧，后续待需求）
  const handleOpEnded = () => {
    if (phase === 'play01') setPhase('tools')
    else if (phase === 'op02') setPhase('tareWait')
    else if (phase === 'op03') setPhase('pickFoodWait')
    else if (phase === 'op04') setPhase('pickHomoWait')
  }

  // —— 渲染派生值 ——
  const showRail = RAIL_PHASES.includes(phase)
  const pickTarget = PICK_TARGET[phase]
  const usedTools = USED_BY_PHASE[phase] ?? []
  const hintText = HINT_TEXT[phase] // undefined 时只保留空胶囊容器
  // 等待阶段沿用上一段视频停末帧：tareWait<-02、pickFoodWait<-03、pickHomoWait<-04、tools<-01
  const opSrc =
    OP_SRC[phase] ??
    (phase === 'tareWait' ? OP_SRC.op02
      : phase === 'pickFoodWait' ? OP_SRC.op03
      : phase === 'pickHomoWait' ? OP_SRC.op04
      : OP_SRC.play01)
  // key 与「源视频」一致：同一源的播放+末帧等待共用一个元素（不重挂），换源才重挂
  const opKey =
    opSrc === OP_SRC.op02 ? 'op02'
    : opSrc === OP_SRC.op03 ? 'op03'
    : opSrc === OP_SRC.op04 ? 'op04'
    : opSrc === OP_SRC.op05 ? 'op05'
    : 'op01'

  return (
    <StageLayout background="#000">
      <div className="epi-stage lab-stage">
        {/* —— 阶段一：17.mp4 查看视频（原生控制条，不自动跳转） —— */}
        {phase === 'watch17' && (
          <video
            ref={watchRef}
            className="epi-video lab-video"
            src="/Video/17.mp4"
            controls
            autoPlay
            playsInline
            preload="auto"
            onPlay={() => setNeedPlay(false)}
          />
        )}

        {/* —— 操作视频 01..05：等待阶段停在同一元素末帧（不重挂），换源靠 key —— */}
        {OP_VIDEO_PHASES.includes(phase) && (
          <video
            key={opKey}
            ref={opRef}
            className="epi-video lab-video"
            src={opSrc}
            autoPlay
            playsInline
            preload="auto"
            onPlay={() => setNeedPlay(false)}
            onEnded={handleOpEnded}
          />
        )}

        {/* 讲解 / 提示配音：随阶段换源（7.mp3 伴 01，8.mp3 伴道具栏提示），单元素复用 */}
        <audio ref={narrRef} preload="auto" />

        {/* 自动播放被拦截时的点击播放提示（17 与 01/02 阶段共用；tools 为静态末帧不需要） */}
        {needPlay && phase !== 'tools' && (
          <button
            type="button"
            className="epi-play-hint"
            onClick={phase === 'watch17' ? startWatch : startOp}
          >
            点击播放视频
          </button>
        )}

        {/* 左上角阶段徽标：机器人头像 + 白胶囊「查看实验视频」 */}
        <div className="lab-badge">
          <img
            className="lab-badge-avatar"
            src="/images/epidemiology/stage-robot.png"
            alt=""
            aria-hidden="true"
          />
          <span className="lab-badge-pill-slot">
            <StagePill text={phase === 'watch17' ? '查看实验视频' : '样品处理'} />
          </span>
        </div>

        {/* 阶段一右下操作区：下一步（播 01）+ 退出视频 */}
        {phase === 'watch17' && (
          <div className="lab-actions">
            <button type="button" className="lab-next-btn" onClick={() => setPhase('play01')}>
              下一步
            </button>
            <button
              type="button"
              className="lab-exit-btn"
              onClick={() => navigate('/case-study')}
            >
              退出视频
            </button>
          </div>
        )}

        {/* 阶段二/三不再显示右下「退出视频」；退出统一走顶栏返回弯箭头（/lab-testing -> /case-study） */}

        {/* —— 样品处理：右侧 10 件道具栏常驻（tools 起，排版对齐 Figma 355:482）。
            每步仅当前目标道具可点；已用道具保留高亮表示操作顺序，其余全程仅展示。 —— */}
        {showRail && (
          <aside className="lab-tools-rail" aria-label="道具栏">
            <div className="lab-tools-head">
              <span className="lab-tools-head-bar" aria-hidden="true" />
              <span className="lab-tools-head-title">道具栏</span>
            </div>
            <div className="lab-tools-grid">
              {LAB_TOOLS.map((t) => {
                const clickable = pickTarget === t.id
                const hot = clickable || usedTools.includes(t.id)
                return (
                  <div
                    key={t.id}
                    className={`lab-tool${clickable ? ' lab-tool--clickable' : ''}`}
                    {...(clickable
                      ? { role: 'button', tabIndex: 0, onClick: () => handlePickTool(t.id),
                          onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handlePickTool(t.id)
                            }
                          } }
                      : {})}
                  >
                    <span className={`lab-tool-chip${hot ? ' lab-tool-chip--hot' : ''}`}>
                      <img className="lab-tool-img" src={t.img} alt={t.label} draggable={false} />
                    </span>
                    <span className="lab-tool-label">{t.label}</span>
                  </div>
                )
              })}
            </div>
          </aside>
        )}

        {/* 02.mp4 末帧：秤面橙色 Tare 归零按钮热区（末帧自带「请点击归零」红箭头，热区透明脉冲） */}
        {phase === 'tareWait' && (
          <button
            type="button"
            className="lab-tare-hotspot"
            style={{
              left: TARE_HOTSPOT.left,
              top: TARE_HOTSPOT.top,
              width: TARE_HOTSPOT.width,
              height: TARE_HOTSPOT.height,
            }}
            aria-label="归零"
            onClick={handleTare}
          />
        )}

        {/* 底部引导提示胶囊：样品处理阶段（tools 起）容器始终保留，无文案时仅留空胶囊；
            有文案时显示黄灯泡 + 提示文字（黑胶囊+灯泡延用食品卫生 .st-hint 同款）。 */}
        {showRail && (
          <div className="lab-hint" role="status" data-empty={hintText ? undefined : 'true'}>
            {hintText && (
              <>
                <svg className="lab-hint-bulb" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
                  <path
                    d="M20 6a10 10 0 00-6 18c1.4 1 2 2 2 3.5h8c0-1.5.6-2.5 2-3.5A10 10 0 0020 6z"
                    fill="#FDB806"
                    stroke="#FDB806"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path d="M17.5 31.5h5M18.5 35h3" fill="none" stroke="#FDB806" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="lab-hint-text">{hintText}</span>
              </>
            )}
          </div>
        )}

        {/* 顶部状态栏（阶段标签：实验室检测；返回弯箭头映射回 /case-study） */}
        <Header variant="stats" score={100} timeText="20:00" stageLabel="实验室检测" />
      </div>
    </StageLayout>
  )
}
