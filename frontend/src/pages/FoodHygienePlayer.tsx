import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StageLayout from '../components/layout/StageLayout'
import Header from '../components/Header'
import QuizStep from '../components/player/QuizStep'
import KeyStepModal from '../components/player/KeyStepModal'
import PpeHintModal from '../components/player/PpeHintModal'
import PpeDressingScene, { PpeSceneBackdrop, wornLayerSrcs } from '../components/player/PpeDressingScene'
import PpeRecordModal from '../components/player/PpeRecordModal'
import SamplingPrincipleModal from '../components/player/SamplingPrincipleModal'
import SamplingToolsScene from '../components/player/SamplingToolsScene'
import SampleTypeHintModal from '../components/player/SampleTypeHintModal'
import KitchenDoneModal from '../components/player/KitchenDoneModal'
import PatientSamplingScene from '../components/player/PatientSamplingScene'
import PatientSampleDoneModal from '../components/player/PatientSampleDoneModal'
import DialogueOverlay from '../components/player/DialogueOverlay'
import AiCompanionModal from '../components/player/AiCompanionModal'
import TaskListModal from '../components/player/TaskListModal'
import type { TaskListItem } from '../components/player/TaskListModal'
import { FH_SAMPLING_DIALOGUES, FH_PRACTITIONER_DIALOGUES } from '../data/dialogues'
import './EpidemiologyPlayer.css'
import './FoodHygienePlayer.css'

/* ------------------------------------------------------------------ *
 * WideStagePill：与流行病学徽标 stage-pill.svg 同源的左鱼尾白胶囊，
 * 但按文案宽度用单条内联 SVG 矢量路径整体绘制（非三拼）：
 *   - 左侧保留官方鱼尾内凹楔子（x=0 满高 → x≈13.4 收尖）；
 *   - 右侧半圆头半径 31.6，随宽度平移；
 *   - 描边沿用官方 SVG 的 inside-mask 画法（完整 2px 内描边，不被
 *     viewBox 裁切），整条一次成型，无拼缝、无小数缩放，任意宽度都清晰。
 * ------------------------------------------------------------------ */
const PILL_H = 64
const CAP_R = 31.614 // 右端圆头半径（= 原始 186-154.386）
const TEXT_LEFT = 34 // 文案左缘（鱼尾尖后留呼吸）
const TEXT_RIGHT_PAD = 46 // 文案右缘到胶囊右端的距离
const PILL_FONT =
  '500 26px "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'

/** 满幅填充路径（上沿 y0、下沿 y63.23，与官方 stage-pill.svg 同几何），右端随宽度平移 */
function buildPillPath(width: number): string {
  const t = width - CAP_R // 右端圆头左侧切线
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

function WideStagePill({ text, className = '' }: { text: string; className?: string }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [textW, setTextW] = useState(() => text.length * 27) // 首帧估算，挂载后实测修正
  useLayoutEffect(() => {
    if (textRef.current) setTextW(textRef.current.offsetWidth)
  }, [text])
  const width = Math.ceil(TEXT_LEFT + textW + TEXT_RIGHT_PAD)
  const d = buildPillPath(width)
  return (
    <span className={className} style={{ width, height: PILL_H }}>
      <svg
        className="fh-pill-svg"
        width={width}
        height={PILL_H}
        viewBox={`0 0 ${width} ${PILL_H}`}
        aria-hidden="true"
      >
        <defs>
          {/* inside-mask：白色区域=路径内部，让 4px 描边只显示内侧 2px */}
          <mask id="fh-pill-inside" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={width} height={PILL_H} fill="black" />
            <path d={d} fill="white" stroke="white" strokeWidth="4" />
          </mask>
        </defs>
        <path d={d} fill="#ffffff" />
        <path d={d} fill="none" stroke="#1949A9" strokeWidth="4" mask="url(#fh-pill-inside)" />
      </svg>
      <span ref={textRef} className="fh-badge-text" style={{ font: PILL_FONT, left: TEXT_LEFT }}>
        {text}
      </span>
    </span>
  )
}


/**
 * 食品卫生学调查模块播放器（对齐 Figma 食品卫生学调查帧序列）：
 *
 *   视频 21.mp4（徽标「准备工作」，有声自动播放，播完停末帧）
 *     → 知识考核 H_08（单题，末帧为背景；答对立即 / 答错停留 5 秒自动推进）
 *   → 现场采样对话：11.mp4【从头静音播放、循环】与 6 句配音 mp3 同步进行
 *     （采样人员张峰 ↔ 酒店主管钱强，DialogueOverlay 自带静音背景视频），
 *     6 句播完进入 H_09
 *     → 知识考核 H_09（01/02）→ H_10（02/02），背景停 11.mp4 末帧
 *   → “重要环节”弹窗《不同致病因子类型食品卫生学调查重点环节》
 *     （Figma 184:3003，原本只有右上 X；按需求新增底部“确 定”按钮）
 *   → 确 定 → “提示”弹窗（Figma 184:3516，“采样前穿戴个人防护设备”）
 *   → 我已了解 → 采样前防护装备穿戴画面（Figma 184:3874，场景 7 图叠加 + 左侧
 *     防护用品道具栏 8 按钮 + 步骤角标 + 提交）。
 *   → 提交后穿戴记录（操作提示，Figma 599:1953），点“我已了解”
 *     → 知识考核 H_11（Figma 188:267，采样原则多选，01/01）
 *     → “事故调查原则”弹窗（Figma 188:384，四条原则），点“我已了解”
 *     → 采样工具准备场景（Figma 188:411，采样台 + 右侧 9 件工具道具栏）。
 */
type Phase =
  | 'video21'
  | 'quiz8'
  | 'dialogue'
  | 'quiz9'
  | 'quiz10'
  | 'keyStep'
  | 'ppeHint'
  | 'ppeDressing'
  | 'ppeRecord'
  | 'quiz11'
  | 'principle'
  | 'tools'
  // —— 后厨采样收尾 → 从业人员采样 ——
  | 'wrapVideo22' // 采样15 结束后播放 22.mp4（后厨装袋过渡，Figma 307:1364）
  | 'sampleTypeHint' // 22.mp4 结束后「标本采集类型」提示弹窗（Figma 307:1368）
  | 'kitchenDone' // 「你已完成后厨采样工作」弹窗（Figma 307:1576）
  | 'staffVideo12' // 播放 12.mp4（救护车，Figma 307:1695），徽标改「从业人员采样」
  | 'staffQuiz' // 视频12 结束后知识考核 H_23（Figma 194:1251），13.mp4 静音循环作背景
  | 'staffDialogue' // 一边播放 13.mp4 一边采样人员↔后厨人员对话（10/11.mp3）
  // —— 从业人员（患者）生物样本采样 → 收尾视频 ——
  | 'patientTools' // 对话结束后：房间/采血手臂背景 + 右侧道具栏，点棉签/采集针/试管播患者采样1/2/3（Figma 308:563、324:906/989）
  | 'wrapVideo16' // 患者采样3 结束后播放 16.mp4（有声，播完停末帧）
  | 'patientDone' // 16.mp4 末帧上「采样完成」提示弹窗（Figma 324:806，纯文字无视频元素）
  | 'staffVideo14' // 点我已了解后播放 14.mp4（样本送检/实验室检验录入，Figma 324:1067，播完停末帧）

/** 左上角胶囊徽标文案，以 H_11 采样原则考核页（Figma 188:267）为分界：
 *  - 该页之前（视频21 / H_08 / 现场对话 / H_09 / H_10 / 重要环节 / PPE 提示·穿戴·记录）= 采样前「准备工作」；
 *  - H_11 考核、事故调查原则、后厨采样工具操作、后厨收尾提示 = 「后厨采样」；
 *  - 视频12 起（救护车→从业人员采样考核 H_23→视频13 采样对话）= 「从业人员采样」。 */
const BADGE_PREP = '准备工作'
const BADGE_KITCHEN = '后厨采样'
const BADGE_STAFF = '从业人员采样'

/** 左上角胶囊点开的「任务列表」项（与三阶段徽标文案一致），供 TaskListModal 高亮/跳转 */
const FH_TASK_LIST: TaskListItem[] = [
  { no: '01', name: BADGE_PREP },
  { no: '02', name: BADGE_KITCHEN },
  { no: '03', name: BADGE_STAFF },
]

const KITCHEN_SAMPLING_PHASES: Phase[] = [
  'quiz11',
  'principle',
  'tools',
  'wrapVideo22',
  'sampleTypeHint',
  'kitchenDone',
]
const STAFF_SAMPLING_PHASES: Phase[] = [
  'staffVideo12',
  'staffQuiz',
  'staffDialogue',
  'patientTools',
  'wrapVideo16',
  'patientDone',
  'staffVideo14',
]

export default function FoodHygienePlayer() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('video21')
  // 穿戴页最终提交的道具 key 顺序（学员实际穿戴先后），供记录弹窗对比与背景回显
  const [wearOrder, setWearOrder] = useState<string[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const [needPlay, setNeedPlay] = useState(false)
  // 14.mp4 播完自动返回上一级的单次守卫（防 onEnded 重复触发 / 卸载后重复 navigate）
  const finishedRef = useRef(false)

  // 左上角徽标双热区（与现场流行病学调查一致）：机器人头像 → AI 学伴；胶囊文字 → 任务列表。
  // 与阶段状态机解耦，任何阶段都可打开，关闭即回原阶段，不影响播放进度。
  const [showCompanion, setShowCompanion] = useState(false)
  const [showTaskList, setShowTaskList] = useState(false)

  /** 任务列表点其它阶段「重新开始 / 开始执行」：跳到该阶段首个环节 */
  const handleTaskJump = (taskName: string) => {
    setShowCompanion(false)
    setShowTaskList(false)
    setWearOrder([])
    setNeedPlay(false)
    finishedRef.current = false
    switch (taskName) {
      case BADGE_PREP:
        setPhase('video21') // 采样前准备：视频21 起
        break
      case BADGE_KITCHEN:
        setPhase('quiz11') // 后厨采样：以 H_11 采样原则考核为界
        break
      case BADGE_STAFF:
        setPhase('staffVideo12') // 从业人员采样：视频12 起
        break
      default:
        break
    }
  }

  /** 任务列表「返回 / 进行中」：仅关闭面板回到当前阶段 */
  const handleTaskListBack = () => setShowTaskList(false)

  // 背景视频：视频21/H_08 阶段用 21.mp4（有声，播完停末帧）；
  // 对话阶段由 DialogueOverlay 自挂静音循环 11.mp4；
  // 对话结束后的 H_09/H_10/重要环节阶段：11.mp4【静音循环】继续作背景，
  //   不再重播原声（11.mp4 的“播放”已在对话阶段与配音同步完成）。
  // ppeHint / ppeDressing / ppeRecord 阶段卸载视频，改挂更衣室静态背景。
  // H_11 / 事故调查原则阶段：挂采样台静态图（Figma 188:267 已采样台）。
  // 采样工具准备阶段（tools）：组件自带空台面背景，此处不挂任何背景。
  // 后厨收尾（wrapVideo22 及两个提示弹窗）：22.mp4 有声播完停末帧；
  // 从业人员采样：staffVideo12 播 12.mp4（有声），H_23 考核阶段挂 13.mp4 静音循环，
  //   staffDialogue 由 DialogueOverlay 自挂静音循环 13.mp4。
  // 采样工具准备阶段（tools）：组件自带空台面背景，此处不挂任何背景。
  // 患者（从业人员）采样道具阶段（patientTools）：组件自带房间/采血手臂背景，此处不挂背景；
  //   wrapVideo16 播 16.mp4（有声），patientDone 停在 16.mp4 末帧并叠采样完成提示卡；
  //   staffVideo14 播 14.mp4（有声，救护车离场），播完停末帧。
  const useSamplingStill = phase === 'quiz11' || phase === 'principle'
  const showVideoBg =
    phase !== 'ppeHint' &&
    phase !== 'ppeDressing' &&
    phase !== 'ppeRecord' &&
    phase !== 'dialogue' &&
    phase !== 'quiz11' &&
    phase !== 'principle' &&
    phase !== 'tools' &&
    phase !== 'patientTools' &&
    phase !== 'staffDialogue'

  // 当前主背景视频：src / 是否静音循环 / 有声播完后的推进
  let bgSrc: string | null = null
  let mutedBg = false
  let onBgEnded: (() => void) | null = null
  if (phase === 'video21' || phase === 'quiz8') {
    bgSrc = '/Video/21.mp4'
    onBgEnded = () => setPhase('quiz8')
  } else if (phase === 'quiz9' || phase === 'quiz10' || phase === 'keyStep') {
    bgSrc = '/Video/11.mp4'
    mutedBg = true
  } else if (phase === 'wrapVideo22' || phase === 'sampleTypeHint' || phase === 'kitchenDone') {
    bgSrc = '/Video/22.mp4'
    onBgEnded = () => setPhase('sampleTypeHint')
  } else if (phase === 'staffVideo12') {
    bgSrc = '/Video/12.mp4'
    onBgEnded = () => setPhase('staffQuiz')
  } else if (phase === 'staffQuiz') {
    bgSrc = '/Video/13.mp4'
    mutedBg = true
  } else if (phase === 'wrapVideo16' || phase === 'patientDone') {
    // 16.mp4 有声播完自然停末帧；patientDone 在同一末帧上叠采样完成提示卡（不换 src，元素保持挂载）
    bgSrc = '/Video/16.mp4'
    onBgEnded = () => setPhase('patientDone')
  } else if (phase === 'staffVideo14') {
    // 14.mp4（样本送检/实验室检验录入）是本模块最后一段：有声播完【自动返回上一级】
    // 模块选择页 /case-study（无需点击）。finishedRef 防止 ended 重复触发/卸载后重复导航。
    bgSrc = '/Video/14.mp4'
    onBgEnded = () => {
      if (finishedRef.current) return
      finishedRef.current = true
      navigate('/case-study')
    }
  }

  // 需要“带声音自动播放”的阶段（被浏览器策略拦截时显示“点击播放”）
  const SOUND_PHASES: Record<string, string> = {
    video21: '/Video/21.mp4',
    wrapVideo22: '/Video/22.mp4',
    staffVideo12: '/Video/12.mp4',
    wrapVideo16: '/Video/16.mp4',
    staffVideo14: '/Video/14.mp4',
  }

  // 进入有声视频阶段时尝试自动播放；被拦截则显示“点击播放”。
  // 静音循环背景不触发拦截，也无需 onEnded 推进。
  useEffect(() => {
    if (!SOUND_PHASES[phase]) return
    setNeedPlay(false)
    const el = videoRef.current
    if (!el) return
    el.load()
    el.play().catch(() => setNeedPlay(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bgSrc])

  const startPlayback = () => {
    const el = videoRef.current
    if (!el) return
    el.muted = false // 用户手势后带声音播放
    el.play().catch(() => {})
  }

  const isVideoPhase = phase in SOUND_PHASES

  // 徽标文案：准备工作 / 后厨采样 / 从业人员采样（三段）
  let badgeText = BADGE_PREP
  if (STAFF_SAMPLING_PHASES.includes(phase)) badgeText = BADGE_STAFF
  else if (KITCHEN_SAMPLING_PHASES.includes(phase)) badgeText = BADGE_KITCHEN

  return (
    <StageLayout background="#000">
      <div className="epi-stage">
        {/* 背景视频层：
            - 视频21：有声自动播放，播完自然停在末帧并进入 H_08；
            - 11.mp4（对话结束后的题卡/弹窗阶段）：静音循环，原声已在对话阶段播完；
            - 22.mp4（后厨收尾过渡）：有声播完停末帧，进入标本采集类型提示弹窗；
            - 12.mp4（救护车/从业人员采样）：有声播完进入 H_23 考核；
            - 13.mp4 在 H_23 考核阶段静音循环作背景，视频13 对话阶段由 DialogueOverlay 自挂。
            ppeHint/ppeDressing 阶段卸载视频，改挂更衣室静态背景。 */}
        {showVideoBg && bgSrc && (
          <video
            key={bgSrc}
            ref={videoRef}
            className="epi-video"
            src={bgSrc}
            autoPlay
            muted={mutedBg}
            loop={mutedBg}
            playsInline
            preload="auto"
            onPlay={() => setNeedPlay(false)}
            onEnded={() => {
              onBgEnded?.()
            }}
          />
        )}

        {/* H_11 考核 / 事故调查原则弹窗：采样台静态背景（Figma 188:267 已采样台） */}
        {useSamplingStill && (
          <img
            className="epi-video"
            src="/images/food-hygiene/sampling-quiz-bg.png"
            alt=""
            aria-hidden="true"
          />
        )}

        {/* “采样前穿戴个人防护设备”提示弹窗背景：更衣室 + 全套穿戴人物（Figma 184:3874 场景） */}
        {phase === 'ppeHint' && <PpeSceneBackdrop allDressed />}

        {/* 穿戴记录弹窗背景：更衣室 + 学员实际穿戴的图层（提交瞬间的状态回显） */}
        {phase === 'ppeRecord' && (
          <PpeSceneBackdrop layers={['/images/food-hygiene/ppe/scene-08-001.png', ...wornLayerSrcs(wearOrder)]} />
        )}

        {/* 自动播放被拦截时的点击播放提示 */}
        {needPlay && isVideoPhase && (
          <button type="button" className="epi-play-hint" onClick={startPlayback}>
            点击播放视频
          </button>
        )}

        {/* 左上角阶段胶囊徽标：与流行病学模块同源——机器人头像 + 左缘内凹鱼尾白胶囊。
            文案按阶段切换（四字）：H_11 之前「准备工作」，H_11 起（含）「后厨采样」；
            胶囊用单条内联 SVG 矢量路径按文案宽度整体绘制
            （左鱼尾 + 右圆头一次成型，无三拼拼缝/非整数缩放，任意宽度都清晰无锯齿）。
            仅穿戴交互页（Figma 184:3874）隐藏以免压住道具面板标题栏；穿戴记录「操作提示」
            弹窗按需求显示徽标（.fh-badge--top 抬到记录遮罩 z45 之上）。 */}
        {phase !== 'ppeDressing' && !showTaskList && (
          <div className={`fh-badge${phase === 'ppeRecord' ? ' fh-badge--top' : ''}`}>
            <img
              className="fh-badge-avatar"
              src="/images/epidemiology/stage-robot.png"
              alt=""
              aria-hidden="true"
            />
            {/* 胶囊外包一层收缩定位容器，透明热区随胶囊宽度自适应（胶囊宽度按文案动态绘制） */}
            <span className="fh-badge-pill-slot">
              <WideStagePill className="fh-badge-pill" text={badgeText} />
              {/* 胶囊热区 → 任务列表（填满胶囊 slot，宽度随文案自适应） */}
              <button
                type="button"
                className="fh-badge-btn fh-badge-btn--pill"
                aria-label="打开任务列表"
                onClick={() => setShowTaskList(true)}
              />
            </span>

            {/* 机器人头像热区 → AI 学伴 */}
            <button
              type="button"
              className="fh-badge-btn fh-badge-btn--robot"
              aria-label="打开AI学伴"
              onClick={() => setShowCompanion(true)}
            />
          </div>
        )}

        {/* 顶部状态栏（与全站统一；阶段标签为本模块名） */}
        <Header variant="stats" score={100} timeText="20:00" stageLabel="食品卫生学调查" />

        {/* 视频21 后：H_08 单题考核（01/01）。答完直接进入现场采样对话（不再先整片播 11.mp4） */}
        {phase === 'quiz8' && (
          <QuizStep
            key="q8"
            qid="H_08"
            index={1}
            total={1}
            onAdvance={() => setPhase('dialogue')}
          />
        )}

        {/* 现场采样对话（采样人员 张峰 ↔ 好运来酒店大堂经理 钱强，共 6 句）：
            11.mp4 从头静音播放（循环作背景），与 6 句配音 mp3 同步进行。 */}
        {phase === 'dialogue' && (
          <DialogueOverlay
            lines={FH_SAMPLING_DIALOGUES}
            title="食品卫生学调查 · 现场采样"
            endText="对话结束"
            onFinish={() => setPhase('quiz9')}
            roleSide={{ 采样人员: 'left', 酒店主管: 'right', 旁白: 'center' }}
            roleColor={{ 采样人员: '#3f7fd6', 酒店主管: '#e07a4f', 旁白: '#7a8699' }}
          />
        )}

        {/* 视频11 后：H_09（01/02）→ H_10（02/02） */}
        {phase === 'quiz9' && (
          <QuizStep
            key="q9"
            qid="H_09"
            index={1}
            total={2}
            onAdvance={() => setPhase('quiz10')}
          />
        )}
        {phase === 'quiz10' && (
          <QuizStep
            key="q10"
            qid="H_10"
            index={2}
            total={2}
            onAdvance={() => setPhase('keyStep')}
          />
        )}

        {/* 重要环节弹窗：确定 / 右上 X 均进入“提示”弹窗阶段 */}
        {phase === 'keyStep' && <KeyStepModal onConfirm={() => setPhase('ppeHint')} />}

        {/* 提示弹窗（Figma 184:3516）：我已了解 / X → 穿戴画面 */}
        {phase === 'ppeHint' && <PpeHintModal onAck={() => setPhase('ppeDressing')} />}

        {/* 采样前防护装备穿戴画面（Figma 184:3874）：人物叠加 + 7 道具栏 + 提交 */}
        {phase === 'ppeDressing' && (
          <PpeDressingScene
            onSubmit={(order) => {
              // 记录学员实际穿戴先后顺序，进入穿戴记录对比（Figma Group 599:1953）
              setWearOrder(order)
              setPhase('ppeRecord')
            }}
          />
        )}

        {/* 穿戴记录对比弹窗（Figma Group 599:1953，标题“操作提示”）：
            点“我已了解”→ H_11 采样原则考核（Figma 188:267） */}
        {phase === 'ppeRecord' && (
          <PpeRecordModal wornKeyOrder={wearOrder} onAck={() => setPhase('quiz11')} />
        )}

        {/* H_11：采样的原则（多选，01/01，Figma 188:267）。答完 → 事故调查原则弹窗 */}
        {phase === 'quiz11' && (
          <QuizStep
            key="q11"
            qid="H_11"
            index={1}
            total={1}
            onAdvance={() => setPhase('principle')}
            successText="回答正确，即将进入下一步……"
          />
        )}

        {/* 事故调查原则弹窗（Figma 188:384）：我已了解 / X → 采样工具准备场景 */}
        {phase === 'principle' && <SamplingPrincipleModal onAck={() => setPhase('tools')} />}

        {/* 采样工具准备场景（Figma 188:411）：采样台 + 右侧 9 件工具道具栏。
            采样15 播完 → 进入后厨收尾过渡视频 22.mp4。 */}
        {phase === 'tools' && (
          <SamplingToolsScene onSamplingComplete={() => setPhase('wrapVideo22')} />
        )}

        {/* 22.mp4 播完：常见的食品安全事故标本和样品采集类型提示弹窗（Figma 307:1368）。
            背景停在 22.mp4 末帧；X 与新增「确 定」均进入「你已完成后厨采样工作」弹窗。 */}
        {phase === 'sampleTypeHint' && (
          <SampleTypeHintModal onConfirm={() => setPhase('kitchenDone')} />
        )}

        {/* 「你已完成后厨采样工作」弹窗（Figma 307:1576）：我已了解 → 视频12（从业人员采样） */}
        {phase === 'kitchenDone' && <KitchenDoneModal onAck={() => setPhase('staffVideo12')} />}

        {/* 视频12 播完：H_23 知识考核「可采集的生物样本有哪些」（多选 ABCD，Figma 194:1251，
            经确认按数据表做多选、单题 01/01）。背景为 13.mp4 静音循环。答完 → 视频13 采样对话。 */}
        {phase === 'staffQuiz' && (
          <QuizStep
            key="q23"
            qid="H_23"
            index={1}
            total={1}
            onAdvance={() => setPhase('staffDialogue')}
            successText="回答正确，即将进入下一步……"
          />
        )}

        {/* 从业人员采样对话（采样人员 张峰 ↔ 后厨人员，共 2 句）：
            13.mp4 从头静音播放（循环作背景），与 10/11.mp3 配音同步进行。
            两句播完（点“完成对话”或语音自然结束）→ 进入患者生物样本采样道具场景。 */}
        {phase === 'staffDialogue' && (
          <DialogueOverlay
            lines={FH_PRACTITIONER_DIALOGUES}
            title="食品卫生学调查 · 从业人员采样"
            endText="对话结束"
            onFinish={() => setPhase('patientTools')}
            roleSide={{ 采样人员: 'left', 后厨人员: 'right' }}
            roleColor={{ 采样人员: '#3f7fd6', 后厨人员: '#e07a4f' }}
          />
        )}

        {/* 患者（从业人员）生物样本采样道具场景（Figma 308:563 / 324:906 / 324:989）：
            右侧 9 件道具栏，依次点 无菌棉签→患者采样1、采集针→患者采样2、试管→患者采样3；
            患者采样3 播完停帧 → 进入 16.mp4 收尾视频。 */}
        {phase === 'patientTools' && (
          <PatientSamplingScene onComplete={() => setPhase('wrapVideo16')} />
        )}

        {/* 16.mp4 播完：采样完成提示卡（Figma 324:806，纯文字、不含任何视频元素）。
            背景停在 16.mp4 末帧；X 与「我已了解」均进入 14.mp4。 */}
        {phase === 'patientDone' && (
          <PatientSampleDoneModal onAck={() => setPhase('staffVideo14')} />
        )}

        {/* 左上角徽标双热区弹窗（与阶段状态机解耦，任何阶段可开，关闭回原阶段）：
            机器人头像 → AI 学伴对话窗；胶囊文字 → 任务列表（食品卫生 3 阶段）。 */}
        {showCompanion && <AiCompanionModal onClose={() => setShowCompanion(false)} />}
        {showTaskList && (
          <TaskListModal
            currentTask={badgeText}
            onBack={handleTaskListBack}
            onJump={handleTaskJump}
            tasks={FH_TASK_LIST}
          />
        )}
      </div>
    </StageLayout>
  )
}
