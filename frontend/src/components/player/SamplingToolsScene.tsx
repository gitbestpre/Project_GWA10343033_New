import { useEffect, useRef, useState } from 'react'

/**
 * 食品卫生学调查 —— 采样工具准备 / 采样操作场景（对齐 Figma 188:411、307:451、307:551、
 * 307:653、307:755、307:856、307:958、307:1161、612:1951）。
 *
 * “事故调查原则”弹窗点“我已了解”后进入：采样台空台面背景（采样箱 + 三盘待采样食材）
 * + 右侧 260×760「道具栏」面板（标题栏 + 2 列 × 5 行共 9 件采样工具，每件 88×88
 * #f0f3fa 图标底 + 18px #618dcf 名称）。
 *
 * 引导式采样（步骤数组驱动，9 件道具全程可点，仅当前步骤道具触发视频）。
 * 每段视频如何“开始”（trigger）：
 *  - trigger='tool'：停在空台面或上一段停住的末帧上，提示点击对应道具，点中才播本段；
 *  - trigger='auto'：上一段末帧点视频自带按钮后无需点道具，立即链式播放本段。
 *
 * 统一规则：本阶段所有视频播完都【停在最后一帧、不关闭页面】（不再自动收起/推进）。
 * 末帧如何“结束”（end）：
 *  - 'button'：视频末帧自带按钮（金色「继续」，或采样6 / 采样11 知识面板蓝色「确定」，已烘焙），
 *    在 endAt 放一个透明热区承接点击；点击后按下一步 trigger 决定：下一步 auto 立即播下一段，
 *    下一步 tool 则收起视频回到空台面、提示点对应道具。
 *  - 'hold'：末帧没有按钮（采样1/4/13/14/15），视频停在最后一帧不关，提示条直接切换为
 *    “下一步道具”的引导，学员在右侧道具栏点击该道具后就地播放下一段；采样15 停帧后提示完成。
 *
 * 底部深色胶囊提示条（Figma 612:1951 同款：722×65 #2b2c2e + 黄灯泡 + 26px 白字）
 * 全程常显，视频播放/末帧期间浮于视频上方；道具栏同样常显（z 高于视频，停帧时可直接点道具）。
 */

/** 9 件采样工具（按 Figma 道具栏行优先顺序）+ 对应切图（来自 031_UI设计/UI图） */
const TOOLS: { name: string; icon: string }[] = [
  { name: '勺子', icon: '/images/food-hygiene/tools/spoon.png' },
  { name: '镊子', icon: '/images/food-hygiene/tools/tweezers.png' },
  { name: '酒精灯', icon: '/images/food-hygiene/tools/alcohol-lamp.png' },
  { name: '无菌棉签', icon: '/images/food-hygiene/tools/swab.png' },
  { name: '试管', icon: '/images/food-hygiene/tools/tube.png' },
  { name: '无菌剪刀', icon: '/images/food-hygiene/tools/scissors.png' },
  { name: '酒精棉球', icon: '/images/food-hygiene/tools/cotton-ball.png' },
  { name: '采集针', icon: '/images/food-hygiene/tools/needle.png' },
  { name: '无菌密封袋', icon: '/images/food-hygiene/tools/sealed-bag.png' },
]

type ToolName = (typeof TOOLS)[number]['name']

/** 末帧结束方式：button=视频自带按钮（透明热区承接）/ hold=无按钮停帧等点下一件道具 */
type EndKind = 'button' | 'hold'

interface SampleStep {
  /** 本段视频路径（采样1 … 采样15） */
  video: string
  /** 'tool' = 等待点击 tool；'auto' = 上一段点按钮后链式自动播放 */
  trigger: 'tool' | 'auto'
  /** trigger='tool' 时需点击的道具 */
  tool?: ToolName
  /** 空台面等待道具 / 链式播放时提示条文案 */
  hint: string
  /** 末帧结束方式 */
  end: EndKind
  /** end='button' 时承接视频自带按钮的透明热区（1920×1080 全帧坐标） */
  endAt?: { left: number; top: number; width: number; height: number }
  /** 热区无障碍名（默认「继续」；采样6 知识面板为「确定」） */
  endLabel?: string
  /** 末帧停住后自动播放的讲解音效（/Audio/...）；点该末帧按钮 / 离开本段时停止 */
  endAudio?: string
}

/**
 * 15 段采样完整线性链路（依据 Figma 307:551/653/755/856/958/1161 标注）。
 * 末帧自带按钮（透明热区）：金色「继续」采样2/3/5/7/8/9/10/12；蓝色「确定」采样6（米饭的采样）、
 * 采样11（素炒粉干样品采集，按钮在视频最后约 0.02s 才淡入）。采样1/4/13/14/15 无按钮，停末帧等下一件道具。
 */
const SAMPLE_STEPS: SampleStep[] = [
  {
    video: '/Video/采样视频/采样1.mp4',
    trigger: 'tool',
    tool: '酒精灯',
    hint: '提示：请点击酒精灯。',
    // 无按钮：播完停末帧（点燃的酒精灯），直接提示点勺子
    end: 'hold',
  },
  {
    video: '/Video/采样视频/采样2.mp4',
    trigger: 'tool',
    tool: '勺子',
    hint: '提示：请点击勺子。',
    end: 'button',
    endAt: { left: 417, top: 196, width: 91, height: 38 },
  },
  {
    video: '/Video/采样视频/采样3.mp4',
    trigger: 'auto',
    hint: '提示：请观看采样操作演示。',
    end: 'button',
    endAt: { left: 391, top: 579, width: 91, height: 37 },
  },
  {
    video: '/Video/采样视频/采样4.mp4',
    trigger: 'auto',
    hint: '提示：请观看采样操作演示。',
    // 无按钮：停在勺子舀米饭末帧不关，等点无菌密封袋
    end: 'hold',
  },
  {
    video: '/Video/采样视频/采样5.mp4',
    trigger: 'tool',
    tool: '无菌密封袋',
    hint: '提示：请点击无菌密封袋。',
    end: 'button',
    endAt: { left: 570, top: 441, width: 91, height: 37 },
  },
  {
    video: '/Video/采样视频/采样6.mp4',
    trigger: 'auto',
    hint: '提示：请观看采样操作演示。',
    // 采样6 末帧为「米饭的采样」知识面板，自带蓝色「确定」按钮：放透明确认热区，
    // 学员阅读后点击「确定」回台面，进入采样7（等待点镊子）。
    end: 'button',
    endAt: { left: 888, top: 797, width: 144, height: 53 },
    endLabel: '确定',
    // 末帧「米饭的采样」知识面板：停帧后播放 08 讲解，点「确定」停止
    endAudio: '/Audio/食品卫生学调查/08.mp3',
  },
  {
    video: '/Video/采样视频/采样7.mp4',
    trigger: 'tool',
    tool: '镊子',
    hint: '提示：请点击镊子。',
    end: 'button',
    endAt: { left: 1122, top: 547, width: 91, height: 37 },
  },
  {
    video: '/Video/采样视频/采样8.mp4',
    trigger: 'auto',
    hint: '提示：请观看采样操作演示。',
    end: 'button',
    endAt: { left: 975, top: 429, width: 91, height: 37 },
  },
  {
    video: '/Video/采样视频/采样9.mp4',
    trigger: 'tool',
    tool: '无菌密封袋',
    hint: '提示：请点击无菌密封袋。',
    end: 'button',
    endAt: { left: 975, top: 429, width: 91, height: 37 },
  },
  {
    video: '/Video/采样视频/采样10.mp4',
    trigger: 'auto',
    hint: '提示：请观看采样操作演示。',
    end: 'button',
    endAt: { left: 1096, top: 604, width: 91, height: 37 },
  },
  {
    video: '/Video/采样视频/采样11.mp4',
    trigger: 'auto',
    hint: '提示：请观看采样操作演示。',
    // 采样11 末帧为「素炒粉干样品采集」知识面板，蓝色「确定」按钮在最后约 0.02s 淡入：
    // 放透明确认热区，点击后回台面进入采样12（等待点无菌棉签）。
    end: 'button',
    endAt: { left: 900, top: 774, width: 146, height: 53 },
    endLabel: '确定',
    // 末帧「素炒粉干样品采集」知识面板：停帧后播放 09 讲解，点「确定」停止
    endAudio: '/Audio/食品卫生学调查/09.mp3',
  },
  {
    video: '/Video/采样视频/采样12.mp4',
    trigger: 'tool',
    tool: '无菌棉签',
    hint: '提示：请点击无菌棉签。',
    end: 'button',
    endAt: { left: 540, top: 403, width: 91, height: 37 },
  },
  {
    video: '/Video/采样视频/采样13.mp4',
    trigger: 'auto',
    hint: '提示：请观看采样操作演示。',
    // 无按钮：停末帧不关，等点试管
    end: 'hold',
  },
  {
    video: '/Video/采样视频/采样14.mp4',
    trigger: 'tool',
    tool: '试管',
    hint: '提示：请点击试管。',
    // 无按钮：停末帧不关，等点无菌剪刀
    end: 'hold',
  },
  {
    video: '/Video/采样视频/采样15.mp4',
    trigger: 'tool',
    tool: '无菌剪刀',
    hint: '提示：请点击无菌剪刀。',
    // 末段：停末帧不关，提示采样完成
    end: 'hold',
  },
]

const DONE_HINT = '提示：采样操作已完成。'

/** 采样台底图（1920×1080，object-fit:fill）：
 *  - 默认：空台面 + 三盘待采样食材；
 *  - 采样6 知识面板点「确定」后（进入采样7）：米饭碗标注「已采样」；
 *  - 采样11 知识面板点「确定」后（进入采样12）：三盘食材均标注「已采样」，并保持到结束。
 *  切换阈值用 stepIndex：步骤 n 的下标为 n-1，点确定后 advance 到下一步下标。 */
const BG_DEFAULT = '/images/food-hygiene/sampling-tools-bg.png'
const BG_AFTER_6 = '/images/food-hygiene/sampling-bg-6.jpg'
const BG_AFTER_11 = '/images/food-hygiene/sampling-bg-11.jpg'
/** 底图切换的步骤下标阈值：stepIndex>=IDX_AFTER_6（进入采样7）显示米饭已采样；
 *  >=IDX_AFTER_11（进入采样12）显示三菜已采样。 */
const IDX_AFTER_6 = SAMPLE_STEPS.findIndex((s) => s.video.endsWith('采样7.mp4'))
const IDX_AFTER_11 = SAMPLE_STEPS.findIndex((s) => s.video.endsWith('采样12.mp4'))

// 模块加载即预取两张“已采样”底图，保证点「确定」切换 src 时图片已缓存、不闪旧帧/空白。
if (typeof Image !== 'undefined') {
  for (const src of [BG_AFTER_6, BG_AFTER_11]) {
    const img = new Image()
    img.src = src
  }
}

export default function SamplingToolsScene({ onSamplingComplete }: { onSamplingComplete?: () => void }) {
  // 当前步骤序号（=== SAMPLE_STEPS.length 时为全部完成态）
  const [stepIndex, setStepIndex] = useState(0)
  // 当前挂载的全屏视频（存在即处于播放/末帧态）；null 表示停在空台面等待道具
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  // 当前视频是否已播完（播完保留挂载、停最后一帧）
  const [videoEnded, setVideoEnded] = useState(false)

  // 末帧知识面板讲解音效（采样6→08.mp3、采样11→09.mp3）：停帧即播，点确定/离开即停
  const audioRef = useRef<HTMLAudioElement>(null)
  // 完成回调只触发一次（采样15 末帧）
  const completedRef = useRef(false)
  const completeCbRef = useRef(onSamplingComplete)
  completeCbRef.current = onSamplingComplete

  const step: SampleStep | undefined = SAMPLE_STEPS[stepIndex]
  const next: SampleStep | undefined = SAMPLE_STEPS[stepIndex + 1]
  const finished = stepIndex >= SAMPLE_STEPS.length

  // 底图随采样进度切换：已进入采样12（stepIndex>=IDX_AFTER_11，含完成态）→ 三菜已采样；
  // 已进入采样7（stepIndex>=IDX_AFTER_6）→ 米饭已采样；更早 → 空台面默认底图。
  let bgSrc = BG_DEFAULT
  if (stepIndex >= IDX_AFTER_11) {
    bgSrc = BG_AFTER_11
  } else if (stepIndex >= IDX_AFTER_6) {
    bgSrc = BG_AFTER_6
  }

  // 是否处于“无按钮停帧、等待下一步道具”态：当前视频已停末帧且 end='hold'
  const isHeld = !!videoSrc && videoEnded && !!step && step.end === 'hold'

  // 末帧讲解音效：仅当视频停在末帧、且当前步骤配置了 endAudio（采样6/11）时播放；
  // 一旦点击确定 / 进入下一步 / 重放其它视频（videoEnded 翻 false 或换段）即停止并归零。
  const endAudio = !!videoSrc && videoEnded && step ? step.endAudio : undefined
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (endAudio) {
      el.currentTime = 0
      el.play().catch(() => {})
    } else {
      el.pause()
      el.currentTime = 0
    }
  }, [endAudio, stepIndex])

  // 采样15（末段）播完停帧即视为采样全部结束，通知父层进入后续过渡视频（只触发一次）
  useEffect(() => {
    if (
      !completedRef.current &&
      stepIndex === SAMPLE_STEPS.length - 1 &&
      !!videoSrc &&
      videoEnded
    ) {
      completedRef.current = true
      completeCbRef.current?.()
    }
  }, [stepIndex, videoSrc, videoEnded])

  // 提示文案：
  //  - 完成 / 末段停帧无下一步：完成提示；
  //  - hold 停帧：直接提示下一步道具（采样1 停帧即提示点勺子）；
  //  - 其余：当前步骤 hint。
  let hintText: string
  if (finished || (isHeld && !next)) {
    hintText = DONE_HINT
  } else if (isHeld && next) {
    hintText = next.hint
  } else {
    hintText = step ? step.hint : DONE_HINT
  }

  /** 开始播放指定步骤的视频（点击道具 / 链式自动均走这里） */
  const playStep = (idx: number) => {
    const s = SAMPLE_STEPS[idx]
    if (!s) return
    setStepIndex(idx)
    setVideoEnded(false)
    setVideoSrc(s.video)
  }

  /** 末帧自带按钮（继续 / 确定）点击后进入下一步：auto 立即播，tool 收起视频回台面等道具 */
  const advance = () => {
    const ni = stepIndex + 1
    if (ni >= SAMPLE_STEPS.length) {
      setStepIndex(SAMPLE_STEPS.length)
      setVideoEnded(false)
      setVideoSrc(null)
      return
    }
    const ns = SAMPLE_STEPS[ni]
    setStepIndex(ni)
    setVideoEnded(false)
    if (ns.trigger === 'auto') {
      setVideoSrc(ns.video)
    } else {
      setVideoSrc(null)
    }
  }

  const handleToolClick = (name: ToolName) => {
    if (finished) return
    // 视频播放中：道具不响应
    if (videoSrc && !videoEnded) return

    if (videoSrc && videoEnded) {
      // 停帧态：仅 hold（无按钮）末帧允许点“下一步道具”就地续播
      if (!step || step.end !== 'hold' || !next || next.trigger !== 'tool') return
      if (name !== next.tool) return
      playStep(stepIndex + 1)
      return
    }

    // 空台面：仅当前 tool 步骤且道具匹配才播放
    if (!step || step.trigger !== 'tool' || name !== step.tool) return
    playStep(stepIndex)
  }

  // 末帧自带按钮热区（button）：视频停末帧时渲染透明承接区
  const showButtonHotspot =
    !!videoSrc && videoEnded && !!step && step.end === 'button' && !!step.endAt

  return (
    <div className="st-layer">
      <img
        className="st-bg"
        src={bgSrc}
        alt="采样台与待采样食材"
      />

      {/* 右侧道具栏 260×760（z 高于全屏视频，播放/末帧期间保持显示、可点击） */}
      <aside className="st-panel" aria-label="采样工具道具栏">
        <header className="st-panel-head">
          <span className="st-panel-bar" />
          <span className="st-panel-title">道具栏</span>
        </header>

        <div className="st-grid">
          {TOOLS.map(({ name, icon }) => (
            <button
              type="button"
              key={name}
              className="st-item"
              aria-label={name}
              onClick={() => handleToolClick(name)}
            >
              <span className="st-item-icon" aria-hidden="true">
                <img className="st-item-img" src={icon} alt="" draggable={false} />
              </span>
              <span className="st-item-name">{name}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* 底部引导提示胶囊（常显；视频播放/末帧时悬浮于视频之上） */}
      <div className="st-hint" role="status">
        <svg className="st-hint-bulb" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
          <path
            d="M20 6a10 10 0 00-6 18c1.4 1 2 2 2 3.5h8c0-1.5.6-2.5 2-3.5A10 10 0 0020 6z"
            fill="#FDB806"
            stroke="#FDB806"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M17.5 31.5h5M18.5 35h3" fill="none" stroke="#FDB806" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="st-hint-text">{hintText}</span>
      </div>

      {/* 全屏采样视频：点击当前步骤道具 / 链式自动播放；播完统一停最后一帧（不卸载、不循环、不关页）。
          button 末帧显示透明热区承接视频内按钮；hold 末帧保持停帧，等右侧道具栏点下一件道具。 */}
      {videoSrc && (
        <video
          className="st-video"
          src={videoSrc}
          autoPlay
          playsInline
          onEnded={() => setVideoEnded(true)}
          data-ended={videoEnded ? 'true' : 'false'}
        />
      )}

      {/* 末帧知识面板讲解音效（采样6→08.mp3 / 采样11→09.mp3）：停帧播放、点确定停止 */}
      {endAudio && <audio ref={audioRef} src={endAudio} preload="auto" />}

      {/* 末帧自带按钮的透明承接热区（金色「继续」/ 采样6 蓝色「确定」）：
          视觉完全使用视频里烘焙好的按钮，这里仅在同位置放透明可点区域。 */}
      {showButtonHotspot && step.endAt && (
        <button
          type="button"
          className="st-continue st-continue-hot"
          style={{
            left: step.endAt.left,
            top: step.endAt.top,
            width: step.endAt.width,
            height: step.endAt.height,
          }}
          aria-label={step.endLabel || '继续'}
          onClick={advance}
        />
      )}
    </div>
  )
}
