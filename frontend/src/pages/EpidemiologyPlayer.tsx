import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StageLayout from '../components/layout/StageLayout'
import Header from '../components/Header'
import QuizModal, { type QuizResult } from '../components/player/QuizModal'
import DialogueOverlay from '../components/player/DialogueOverlay'
import InquiryPanel from '../components/player/InquiryPanel'
import PostFeedbackModal from '../components/player/PostFeedbackModal'
import BriefingOverlay from '../components/player/BriefingOverlay'
import ReportFlow from '../components/player/ReportFlow'
import InvestReady from '../components/player/InvestReady'
import RelatedInfoModal from '../components/player/RelatedInfoModal'
import InterviewOutlineModal from '../components/player/InterviewOutlineModal'
import SiteSurveyInfoModal from '../components/player/SiteSurveyInfoModal'
import ModuleFinishModal from '../components/player/ModuleFinishModal'
import AiCompanionModal from '../components/player/AiCompanionModal'
import ExitConfirmModal from '../components/player/ExitConfirmModal'
import TaskListModal from '../components/player/TaskListModal'
import { getQuestionById } from '../data/questions'
import { FIELD_DIALOGUES, CDC_REPORT_DIALOGUES } from '../data/dialogues'
import type { DialogueLine } from '../data/dialogues'
import {
  WRONG_HOLD_SECONDS,
  judgeAndRecord,
  reviewResultOf,
} from '../components/player/quizShared'
import {
  MODULE_FIRST_STEP,
  discardSession,
  makeStepGuard,
  markDone,
  markStudying,
  readProgress,
} from '../lib/moduleProgress'
import './EpidemiologyPlayer.css'

/**
 * 本阶段编排（顺序）：
 * 视频1（案例描述 1.mp4）→ 选择题 H_01 → 视频2（接到报案 2.mp4）→ 接报通话对话
 * （背景 3.mp4 循环 + 语音 + 字幕，2 条）→ AI 问询（背景 4.mp4）→
 * 结束问询后知识考核 2 题（01/02 = H_02 多选，02/02 = H_03 单选）→ 处置反馈弹窗。
 *
 * 处置反馈“我已了解”后进入逐级汇报链路（对齐 Figma 289:564 / 180:749 / 180:822 / 180:1054）：
 * 汇报遮罩（点击顶栏外任意区域）→ 疾控值班王医师↔尤主任对话（背景 5/6.mp4 + 03/04 语音）→
 * 知识考核 H_04 单题（背景 过渡6.mp4 单次播放停末帧）→ 突发公共卫生事件报告流程页。
 *
 * 报告流程页点“继 续”进入开展调查 / 现场调查链路：
 * 19.mp4（有声，徽标“开展调查工作”，播放期叠加字幕）→ 停末帧弹 H_05 考核卡（徽标“开展调查工作”）
 * → 调查组准备静态页（徽标“开展调查工作”）点“继 续”
 * → 20.mp4（有声，徽标“现场调查”）→ 停末帧弹 H_06 考核卡（徽标“现场调查”）
 * → 7.mp4（有声，徽标“现场调查”，无烧录字幕）→ 停末帧弹 H_07 考核卡（徽标“现场调查”）
 * → AI 问询对话页（背景 8.mp4 有声播放一次后停末帧，右侧“疾病预防控制中心”面板，
 *   学员以疾控中心值班员身份继续问询）。
 * 结束问询 → “相关信息”弹窗（接下来调查下一个患者）→ 点“我已了解”进入记录页
 * （背景 8.1.mp4 有声播放一次停末帧，左侧悬浮“记录｜个案调查表”卡片），
 * 点击记录卡弹出《食品安全事故病例访谈提纲》可滚动文档弹窗，关闭后停留记录页。
 * 答对立即进入下一步；答错展示正确答案停留 5 秒后自动进入。
 */
/**
 * 全阶段类型（phaseKind）常量表 —— **同时充当断点校验白名单**（见下方 `isEpiKind`）。
 *
 * 类型由本表派生（`type PhaseKind = (typeof EPI_PHASE_KINDS)[number]`），于是
 * `makeStepGuard(EPI_PHASE_KINDS)` 天然与类型定义**同源**：新增/改名阶段只改这一处，
 * 断点白名单不可能忘记同步。顺序 = 链路推进顺序，便于人工核对。
 */
const EPI_PHASE_KINDS = [
  'video',
  'quiz',
  'dialog',
  'inquiry',
  'postquiz',
  'feedback',
  'briefing',
  'cdcDialog',
  'cdcQuiz',
  'reportFlow',
  'investVideo19',
  'investQuiz5',
  'investReady',
  'siteVideo20',
  'siteQuiz6',
  'siteVideo7',
  'siteQuiz7',
  'aiChat',
  'aiRelated',
  'recordPage',
  'closingVideo9',
  'siteInfo',
  'closingVideo10',
  'moduleFinish',
] as const

type PhaseKind = (typeof EPI_PHASE_KINDS)[number]

/** 问询页背景视频（4.mp4 双人分屏，本身无音轨）与左上徽标文案 */
const INQUIRY_VIDEO = '/Video/4.mp4'

/** 结束问询后的知识考核题序（共 2 题，对应弹窗 01/02、02/02），答案以选择题 xlsx 为准：
 *  01/02 = H_02（多选 ABCDE），02/02 = H_03（单选 A） */
const POST_QUIZ_IDS = ['H_02', 'H_03'] as const

/** 疾控汇报对话后的知识考核：仅 H_04 一题（多选 AB，对齐 Figma 180:822） */
const CDC_QUIZ_IDS = ['H_04'] as const

/** 疾控两题考核阶段的背景（过渡6，尤主任监控画面，静音循环，对齐 Figma 180:822） */
const CDC_QUIZ_BG = '/Video/过渡6.mp4'

/** 报告流程页之后的“开展调查 / 现场调查”链路视频（均含音轨，有声播放） */
const INVEST_VIDEO_19 = '/Video/19.mp4'
const SITE_VIDEO_20 = '/Video/20.mp4'
/** H_06 之后继续的现场调查视频（7.mp4，含音轨、无烧录字幕）与 AI 问询背景（8.mp4，含音轨） */
const SITE_VIDEO_7 = '/Video/7.mp4'
const AI_CHAT_VIDEO = '/Video/8.mp4'
/** “我已了解”后记录页的背景视频（8.1.mp4，含音轨，Figma 184:2240 的 sc_15a） */
const RECORD_PAGE_VIDEO = '/Video/8.1.mp4'
/** 记录页“结束问询”后的收尾链路视频（均含音轨、有声播放，Figma 184:2510 / 301:627） */
const CLOSING_VIDEO_9 = '/Video/9.mp4'
const CLOSING_VIDEO_10 = '/Video/10.mp4'

/** 19.mp4 / 20.mp4 后的单题考核（对齐 Figma 184:1227 = H_05，297:819 = H_06） */
const INVEST_QUIZ_ID = 'H_05'
const SITE_QUIZ_ID = 'H_06'
/** 7.mp4 后的单题考核：以题库数据为准，仅 H_07 一题（Figma 01/02 标注仅为页面效果） */
const SITE_QUIZ_7_ID = 'H_07'

/** AI 问询页（现场调查阶段，对齐 Figma 184:1833）的面板配置：
 *  学员以疾控中心值班员身份继续问询，种子问答与任务提示不同于接报后的市场局问询。
 *  Figma 该页只有种子问答、无推荐问题区，故 presets 置空，仅保留文字/语音自由提问。 */
const AI_CHAT_INQUIRY_CONFIG = {
  seed: [
    { side: 'left' as const, text: '发病前3天内有无家庭以外的进餐史?' },
    { side: 'right' as const, text: '没有' },
  ],
  taskPrompt: '身为疾控中心的值班员，请询问主要信息',
  presets: [],
  fallbackAnswer:
    '这个信息我先记录下来。请继续围绕患者发病前的就餐史、饮水史和密切接触史等主要信息进行询问。',
  endText: '结束问询',
}

/** 报告流程页之后新增链路（开展调查 / 现场调查）的左上角徽标文案，按 phase 指定；
 *  其余阶段沿用当前 STAGES 视频的徽标（current.badge），保持既有行为不变 */
const PHASE_BADGE: Partial<Record<PhaseKind, string>> = {
  investVideo19: '开展调查工作',
  investQuiz5: '开展调查工作',
  investReady: '开展调查工作',
  siteVideo20: '现场调查',
  siteQuiz6: '现场调查',
  siteVideo7: '现场调查',
  siteQuiz7: '现场调查',
  aiChat: '现场调查',
  aiRelated: '现场调查',
  recordPage: '现场调查',
  closingVideo9: '现场调查',
  siteInfo: '现场调查',
  closingVideo10: '现场调查',
  moduleFinish: '现场调查',
}

interface Stage {
  video: string
  badge: string
  quizId?: string | null
  /** 该视频结束后播放的对话（无则停留在结束画面） */
  dialogues?: DialogueLine[]
}

const STAGES: Stage[] = [
  { video: '/Video/1.mp4', badge: '案例描述', quizId: 'H_01' },
  { video: '/Video/2.mp4', badge: '接到报案', quizId: null, dialogues: FIELD_DIALOGUES },
]

/** 判断所选集合是否与标准答案集合完全一致 —— 已收敛到共享判题口径 quizShared.ts
 *  （原先此处有一份本地副本，与 QuizStep/QuizRail 的判题逻辑重复，易改一处忘一处）。
 *  判题一律走 `judgeAndRecord`（判对错的同时记账，每题只做一次）。 */

/* ------------------------------------------------------------------ *
 * 学习进度（断点续做）—— 与 moduleProgress 存储层对接
 *
 * 负责人 2026-09-18：点进模块即「学习中」、走到终点（「模块完成」点我已了解）才是
 * 「已学习」；中途返回则下次点击进来要**继续上次的进度**（步骤级，不恢复视频秒数）。
 *
 * ⚠ 本模块的进度是**二维**的（`stage` 主视频序号 × `phaseKind` 阶段），
 *   故断点编码为 `stage:phaseKind`（如 `0:video` / `1:siteVideo7`）——
 *   与 `MODULE_FIRST_STEP.epidemiology = '0:video'` 同一口径，两边必须一致。
 * ------------------------------------------------------------------ */

const MODULE_ID = 'epidemiology' as const
/** 断点校验：白名单即 EPI_PHASE_KINDS，与类型定义同源，脏数据/旧版本残留一律判为无断点 */
const isEpiKind = makeStepGuard(EPI_PHASE_KINDS)

type ResumePoint = { stage: number; phaseKind: PhaseKind }

/** 断点编码（写入侧） */
const makeStep = (stage: number, phaseKind: PhaseKind): string => `${stage}:${phaseKind}`

/**
 * 断点解析（读取侧）：非法一律返回 null（当作无断点，从第一步开始）。
 * 校验三件事：能按 `stage:kind` 切分、kind 在白名单内、stage 在 STAGES 下标范围内。
 */
function parseStep(step: string | null | undefined): ResumePoint | null {
  if (!step) return null
  const sep = step.indexOf(':')
  if (sep <= 0) return null
  const rawStage = step.slice(0, sep)
  const rawKind = step.slice(sep + 1)
  if (!/^\d+$/.test(rawStage)) return null
  if (!isEpiKind(rawKind)) return null
  const stage = Number(rawStage)
  if (stage < 0 || stage >= STAGES.length) return null
  return { stage, phaseKind: rawKind }
}

/** 本模块第一步（首次进入 / 「重新学习」的起点，也是断点非法/缺失时的兜底） */
const FIRST_POINT: ResumePoint = parseStep(MODULE_FIRST_STEP[MODULE_ID]) ?? {
  stage: 0,
  phaseKind: 'video',
}

/**
 * 断点 → **恢复时的起步阶段**（需要时回退，其余原样返回）。
 *
 * 回退的都是「叠在某段视频末帧上的题卡 / 弹窗」阶段：它们自身不挂视频，靠宿主阶段
 * 渲染那段视频（`autoPlay`）。若直接落进这些阶段，画面一边显示题卡、底下视频却
 * 从头再播一遍，状态自相矛盾。故回退到它叠着的那段视频，让视频播完再自然出题卡 ——
 * 这正是「回到该步骤开头重播」的语义。
 *
 * （`inquiry` / `postquiz` / `cdcQuiz` / `dialog` 等虽是弹窗/面板，但背景是**静音循环**的
 *   4.mp4 / 过渡6.mp4 或对话组件自携背景，不存在「末帧重播」矛盾，故不回退。）
 */
const RESUME_BACKOFF: Partial<Record<PhaseKind, PhaseKind>> = {
  quiz: 'video', // 主视频（1/2.mp4）末帧上的题卡
  investQuiz5: 'investVideo19',
  siteQuiz6: 'siteVideo20',
  siteQuiz7: 'siteVideo7',
  aiRelated: 'aiChat', // 相关信息弹窗叠在 8.mp4 末帧上
  siteInfo: 'closingVideo9', // 现场调查信息卡叠在 9.mp4 末帧上
  moduleFinish: 'closingVideo10', // 模块完成提示叠在 10.mp4 末帧上
}

const resumePointOf = (step: string | null | undefined): ResumePoint => {
  const p = parseStep(step)
  if (!p) return FIRST_POINT
  return { stage: p.stage, phaseKind: RESUME_BACKOFF[p.phaseKind] ?? p.phaseKind }
}

export default function EpidemiologyPlayer() {
  const navigate = useNavigate()
  // 「目前得分」不再由页面传入 —— 顶栏 Header 直接用 lib/quizScore 的实时值
  // （单选 6 分 / 多选 5 分，0 分起累加）

  // 断点续做：首次挂载读一次存储并解析（stage 与 phaseKind 必须来自同一次解析，
  // 否则两者可能不一致）；无合法断点则从第一步（0:video）开始
  const [initialPoint] = useState<ResumePoint>(() => resumePointOf(readProgress(MODULE_ID).step))
  const [stage, setStage] = useState(initialPoint.stage)
  const [phaseKind, setPhaseKind] = useState<PhaseKind>(initialPoint.phaseKind)
  const current = STAGES[stage]

  /** 中途退出确认弹窗（Figma 1:7889「退出提示」）：保存进度并退出 / 直接退出 */
  const [exitPrompt, setExitPrompt] = useState(false)

  // 每推进一步即写回断点（编码 `stage:phaseKind`）：模块选择页据此显示「学习中」/「已学习」，
  // 也是下次进入的续做点。状态语义见 moduleProgress：已「已学习」的模块不因再进来一次而降级。
  useEffect(() => {
    markStudying(MODULE_ID, makeStep(stage, phaseKind))
  }, [stage, phaseKind])

  /** 中途退出请求（顶栏返回弯箭头）→ 先弹「退出提示」 */
  const requestExit = () => setExitPrompt(true)

  /** 保存进度并退出：断点已随 stage/phaseKind 持续写入，直接回模块选择页 */
  const handleSaveAndExit = () => {
    setExitPrompt(false)
    navigate('/case-study')
  }

  /** 直接退出：本次学习成绩不予记录 —— 清掉本次断点再回模块选择页 */
  const handleDiscardAndExit = () => {
    discardSession(MODULE_ID)
    setExitPrompt(false)
    navigate('/case-study')
  }

  // 判题结果与倒计时。懒初始化：本题若**之前已答过**（每题只做一次），
  // 挂载即进入评审态（回显用户答案与正确答案，停留 5 秒后推进）。
  const [result, setResult] = useState<QuizResult | null>(() =>
    current.quizId ? reviewResultOf(current.quizId) : null,
  )
  const [countdown, setCountdown] = useState(WRONG_HOLD_SECONDS)

  // 视频播放状态：进入视频阶段即播，播放结束后：有题出题，有对话进对话，否则停留
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoEnded, setVideoEnded] = useState(false)
  const [needPlay, setNeedPlay] = useState(false)

  // 切到新视频阶段时重置并尝试有声自动播放；
  // 首次进入若被浏览器自动播放策略拦截（带声音需用户手势），显示“点击播放视频”。
  useEffect(() => {
    if (phaseKind !== 'video') return
    setVideoEnded(false)
    setNeedPlay(false)
    const el = videoRef.current
    if (!el) return
    el.load()
    el.play().catch(() => setNeedPlay(true))
  }, [stage, phaseKind])

  // 倒计时：评审态一律停留（无论当初对错），首次答错才停留；归零后进入下一视频。
  // ⚠️ 必须限定在 `quiz` 阶段：评审态的结果对象可能在挂载时就已存在（断点恢复），
  //    若不加阶段判断，会在非考核阶段被这个 effect 悄悄把流程推到下一支视频。
  useEffect(() => {
    if (phaseKind !== 'quiz') return
    if (!result || (result.correct && result.review !== true)) return
    if (countdown <= 0) {
      goNextVideo()
      return
    }
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKind, result, countdown])

  const handleVideoEnded = () => {
    setVideoEnded(true)
    if (current.quizId) {
      // 已答过 → 评审态；未答过 → null（正常作答）
      setResult(reviewResultOf(current.quizId))
      setCountdown(WRONG_HOLD_SECONDS)
      setPhaseKind('quiz') // 本视频后有考核 → 出题
    } else if (current.dialogues && current.dialogues.length > 0) {
      setPhaseKind('dialog') // 视频2 → 接报通话对话
    }
    // 否则停留在结束画面
  }

  const goNextVideo = () => {
    setResult(null)
    setCountdown(WRONG_HOLD_SECONDS)
    setStage((s) => Math.min(s + 1, STAGES.length - 1))
    setPhaseKind('video')
  }

  const handleSubmit = (selectedKeys: string[]) => {
    const q = current.quizId ? getQuestionById(current.quizId) : null
    const correct = !!q && judgeAndRecord(q, selectedKeys)
    if (correct) {
      // 答对：立即切到下一个视频
      setResult({ correct: true })
      goNextVideo()
    } else {
      // 答错：锁定并高亮正确答案，停留 5 秒后自动进入下一视频
      setResult({ correct: false, countdown: WRONG_HOLD_SECONDS })
      setCountdown(WRONG_HOLD_SECONDS)
    }
  }

  const q = current.quizId ? getQuestionById(current.quizId) : null
  const showQuiz = phaseKind === 'quiz' && q
  const showDialog = phaseKind === 'dialog' && current.dialogues
  const showInquiry = phaseKind === 'inquiry'
  const quizTotal = STAGES.filter((s) => s.quizId).length

  // —— 结束问询后的两题知识考核（01/02 = H_02 多选，02/02 = H_03 单选，
  //      与 POST_QUIZ_IDS 声明顺序一致）——
  const [postIndex, setPostIndex] = useState(0)
  // 懒初始化：首题若已答过则直接评审态（断点恢复到 postquiz 时的重走场景）
  const [postResult, setPostResult] = useState<QuizResult | null>(() =>
    reviewResultOf(POST_QUIZ_IDS[0]),
  )
  const [postCountdown, setPostCountdown] = useState(WRONG_HOLD_SECONDS)
  const postQ = getQuestionById(POST_QUIZ_IDS[postIndex])
  const showPostQuiz = phaseKind === 'postquiz' && postQ
  const showFeedback = phaseKind === 'feedback'

  /** 进入下一道问询后考题；两题答完进入处置反馈弹窗 */
  const advancePostQuiz = () => {
    const nextIndex = postIndex + 1
    if (nextIndex < POST_QUIZ_IDS.length) {
      setPostIndex(nextIndex)
      // 下一题若之前已答过 → 评审态；否则 null（正常作答）
      setPostResult(reviewResultOf(POST_QUIZ_IDS[nextIndex]))
      setPostCountdown(WRONG_HOLD_SECONDS)
    } else {
      setPostResult(null)
      setPostCountdown(WRONG_HOLD_SECONDS)
      setPhaseKind('feedback')
    }
  }

  const handlePostSubmit = (selectedKeys: string[]) => {
    if (!postQ) return
    const correct = judgeAndRecord(postQ, selectedKeys)
    if (correct) {
      setPostResult({ correct: true })
      advancePostQuiz()
    } else {
      setPostResult({ correct: false, countdown: WRONG_HOLD_SECONDS })
      setPostCountdown(WRONG_HOLD_SECONDS)
    }
  }

  // 问询后考题倒计时：评审态一律停留，首次答错才停留；归零后进入下一题/反馈弹窗
  useEffect(() => {
    if (phaseKind !== 'postquiz') return
    if (!postResult || (postResult.correct && postResult.review !== true)) return
    if (postCountdown <= 0) {
      advancePostQuiz()
      return
    }
    const timer = window.setTimeout(() => setPostCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKind, postResult, postCountdown])

  // 接报通话对话全部播完 → 进入问询交互页
  const handleDialogFinish = () => {
    setPhaseKind('inquiry')
  }

  // 结束问询 → 进入两题知识考核（不再直接离开页面）
  const handleInquiryEnd = () => {
    setPostIndex(0)
    setPostResult(reviewResultOf(POST_QUIZ_IDS[0]))
    setPostCountdown(WRONG_HOLD_SECONDS)
    setPhaseKind('postquiz')
  }

  // 反馈弹窗“我已了解” → 进入逐级汇报遮罩页（不再直接离开页面）
  const handleFeedbackAck = () => {
    setPhaseKind('briefing')
  }

  // —— 疾控汇报遮罩 → 王医师↔尤主任对话 ——
  const handleBriefingContinue = () => {
    setPhaseKind('cdcDialog')
  }

  const showCdcDialog = phaseKind === 'cdcDialog'

  const handleCdcDialogFinish = () => {
    setCdcIndex(0)
    setCdcResult(reviewResultOf(CDC_QUIZ_IDS[0]))
    setCdcCountdown(WRONG_HOLD_SECONDS)
    setPhaseKind('cdcQuiz')
  }

  // —— 疾控汇报后的单题知识考核（仅 H_04 多选；H_05 属后续 investQuiz5 阶段，不在此列）——
  const [cdcIndex, setCdcIndex] = useState(0)
  const [cdcResult, setCdcResult] = useState<QuizResult | null>(() =>
    reviewResultOf(CDC_QUIZ_IDS[0]),
  )
  const [cdcCountdown, setCdcCountdown] = useState(WRONG_HOLD_SECONDS)
  const cdcQ = getQuestionById(CDC_QUIZ_IDS[cdcIndex])
  const showCdcQuiz = phaseKind === 'cdcQuiz' && cdcQ
  const showReportFlow = phaseKind === 'reportFlow'

  /** 进入下一道疾控考题（当前题库仅 H_04，此处按列表通用写法保留）；答完进入报告流程页 */
  const advanceCdcQuiz = () => {
    const nextIndex = cdcIndex + 1
    if (nextIndex < CDC_QUIZ_IDS.length) {
      setCdcIndex(nextIndex)
      setCdcResult(reviewResultOf(CDC_QUIZ_IDS[nextIndex]))
      setCdcCountdown(WRONG_HOLD_SECONDS)
    } else {
      setCdcResult(null)
      setCdcCountdown(WRONG_HOLD_SECONDS)
      setPhaseKind('reportFlow')
    }
  }

  const handleCdcSubmit = (selectedKeys: string[]) => {
    if (!cdcQ) return
    const correct = judgeAndRecord(cdcQ, selectedKeys)
    if (correct) {
      setCdcResult({ correct: true })
      advanceCdcQuiz()
    } else {
      setCdcResult({ correct: false, countdown: WRONG_HOLD_SECONDS })
      setCdcCountdown(WRONG_HOLD_SECONDS)
    }
  }

  // 疾控考题倒计时：评审态一律停留，首次答错才停留；归零后进入下一题/报告流程页
  useEffect(() => {
    if (phaseKind !== 'cdcQuiz') return
    if (!cdcResult || (cdcResult.correct && cdcResult.review !== true)) return
    if (cdcCountdown <= 0) {
      advanceCdcQuiz()
      return
    }
    const timer = window.setTimeout(() => setCdcCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKind, cdcResult, cdcCountdown])

  // —— 报告流程页之后：开展调查（19.mp4 → H_05 → 静态页）→ 现场调查（20.mp4 → H_06）——
  const chainVideoRef = useRef<HTMLVideoElement>(null)
  const [chainNeedPlay, setChainNeedPlay] = useState(false)

  // —— 收尾链路：9.mp4 → 现场调查信息卡 → 10.mp4 → 模块完成提示（独立 ref/兜底）——
  const closingVideoRef = useRef<HTMLVideoElement>(null)
  const [closingNeedPlay, setClosingNeedPlay] = useState(false)

  // H_05 判题结果与倒计时（懒初始化评审态，断点恢复到本阶段时的重走场景）
  const [investResult, setInvestResult] = useState<QuizResult | null>(() =>
    reviewResultOf(INVEST_QUIZ_ID),
  )
  const [investCountdown, setInvestCountdown] = useState(WRONG_HOLD_SECONDS)
  // H_06 判题结果与倒计时（答完进入 7.mp4）
  const [siteResult, setSiteResult] = useState<QuizResult | null>(() =>
    reviewResultOf(SITE_QUIZ_ID),
  )
  const [siteCountdown, setSiteCountdown] = useState(WRONG_HOLD_SECONDS)
  // H_07 判题结果与倒计时（答完进入 AI 问询对话页）
  const [site7Result, setSite7Result] = useState<QuizResult | null>(() =>
    reviewResultOf(SITE_QUIZ_7_ID),
  )
  const [site7Countdown, setSite7Countdown] = useState(WRONG_HOLD_SECONDS)

  const investQ = getQuestionById(INVEST_QUIZ_ID)
  const siteQ = getQuestionById(SITE_QUIZ_ID)
  const site7Q = getQuestionById(SITE_QUIZ_7_ID)
  const showInvestQuiz = phaseKind === 'investQuiz5' && !!investQ
  const showSiteQuiz = phaseKind === 'siteQuiz6' && !!siteQ
  const showSite7Quiz = phaseKind === 'siteQuiz7' && !!site7Q

  // 进入 19.mp4 / 20.mp4 / 7.mp4 阶段即有声自动播放；被浏览器拦截时显示点击播放提示
  useEffect(() => {
    if (
      phaseKind !== 'investVideo19' &&
      phaseKind !== 'siteVideo20' &&
      phaseKind !== 'siteVideo7'
    )
      return
    setChainNeedPlay(false)
    const el = chainVideoRef.current
    if (!el) return
    el.load()
    el.play().catch(() => setChainNeedPlay(true))
  }, [phaseKind])

  // 进入 9.mp4 / 10.mp4 收尾阶段即有声自动播放；被浏览器拦截时显示点击播放提示
  useEffect(() => {
    if (phaseKind !== 'closingVideo9' && phaseKind !== 'closingVideo10') return
    setClosingNeedPlay(false)
    const el = closingVideoRef.current
    if (!el) return
    el.load()
    el.play().catch(() => setClosingNeedPlay(true))
  }, [phaseKind])

  /** 报告流程页“继 续” → 播放 19.mp4（开展调查工作） */
  const handleReportFlowContinue = () => {
    setInvestResult(reviewResultOf(INVEST_QUIZ_ID))
    setInvestCountdown(WRONG_HOLD_SECONDS)
    setPhaseKind('investVideo19')
  }

  /** 19.mp4 播放结束 → 停留末帧并弹出 H_05 考核卡 */
  const handleInvestVideoEnded = () => {
    if (phaseKind !== 'investVideo19') return
    setInvestResult(reviewResultOf(INVEST_QUIZ_ID))
    setInvestCountdown(WRONG_HOLD_SECONDS)
    setPhaseKind('investQuiz5')
  }

  const handleInvestSubmit = (selectedKeys: string[]) => {
    if (!investQ) return
    const correct = judgeAndRecord(investQ, selectedKeys)
    if (correct) {
      // 答对：立即进入调查组准备静态页
      setInvestResult({ correct: true })
      setPhaseKind('investReady')
    } else {
      // 答错：锁定并高亮正确答案，停留 5 秒后自动进入静态页
      setInvestResult({ correct: false, countdown: WRONG_HOLD_SECONDS })
      setInvestCountdown(WRONG_HOLD_SECONDS)
    }
  }

  // H_05 倒计时：评审态一律停留，首次答错才停留；归零后进入调查组准备静态页
  useEffect(() => {
    if (phaseKind !== 'investQuiz5') return
    if (!investResult || (investResult.correct && investResult.review !== true)) return
    if (investCountdown <= 0) {
      setPhaseKind('investReady')
      return
    }
    const timer = window.setTimeout(() => setInvestCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react/hooks/exhaustive-deps
  }, [phaseKind, investResult, investCountdown])

  /** 静态页“继 续” → 播放 20.mp4（现场调查） */
  const handleInvestReadyContinue = () => {
    setSiteResult(reviewResultOf(SITE_QUIZ_ID))
    setSiteCountdown(WRONG_HOLD_SECONDS)
    setPhaseKind('siteVideo20')
  }

  /** 20.mp4 播放结束 → 停留末帧并弹出 H_06 考核卡 */
  const handleSiteVideoEnded = () => {
    if (phaseKind !== 'siteVideo20') return
    setSiteResult(reviewResultOf(SITE_QUIZ_ID))
    setSiteCountdown(WRONG_HOLD_SECONDS)
    setPhaseKind('siteQuiz6')
  }

  const handleSiteSubmit = (selectedKeys: string[]) => {
    if (!siteQ) return
    const correct = judgeAndRecord(siteQ, selectedKeys)
    if (correct) {
      // 答对：立即播放 7.mp4（现场调查继续）
      setSiteResult({ correct: true })
      setSite7Result(reviewResultOf(SITE_QUIZ_7_ID))
      setSite7Countdown(WRONG_HOLD_SECONDS)
      setPhaseKind('siteVideo7')
    } else {
      // 答错：锁定并高亮正确答案，停留 5 秒后自动播放 7.mp4
      setSiteResult({ correct: false, countdown: WRONG_HOLD_SECONDS })
      setSiteCountdown(WRONG_HOLD_SECONDS)
    }
  }

  // H_06 倒计时：评审态一律停留，首次答错才停留；归零后播放 7.mp4
  useEffect(() => {
    if (phaseKind !== 'siteQuiz6') return
    if (!siteResult || (siteResult.correct && siteResult.review !== true)) return
    if (siteCountdown <= 0) {
      setSite7Result(reviewResultOf(SITE_QUIZ_7_ID))
      setSite7Countdown(WRONG_HOLD_SECONDS)
      setPhaseKind('siteVideo7')
      return
    }
    const timer = window.setTimeout(() => setSiteCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKind, siteResult, siteCountdown])

  /** 7.mp4 播放结束 → 停留末帧并弹出 H_07 考核卡 */
  const handleSite7VideoEnded = () => {
    if (phaseKind !== 'siteVideo7') return
    setSite7Result(reviewResultOf(SITE_QUIZ_7_ID))
    setSite7Countdown(WRONG_HOLD_SECONDS)
    setPhaseKind('siteQuiz7')
  }

  const handleSite7Submit = (selectedKeys: string[]) => {
    if (!site7Q) return
    const correct = judgeAndRecord(site7Q, selectedKeys)
    if (correct) {
      // 答对：立即进入 AI 问询对话页
      setSite7Result({ correct: true })
      setPhaseKind('aiChat')
    } else {
      // 答错：锁定并高亮正确答案，停留 5 秒后自动进入 AI 问询对话页
      setSite7Result({ correct: false, countdown: WRONG_HOLD_SECONDS })
      setSite7Countdown(WRONG_HOLD_SECONDS)
    }
  }

  // H_07 倒计时：评审态一律停留，首次答错才停留；归零后进入 AI 问询对话页
  useEffect(() => {
    if (phaseKind !== 'siteQuiz7') return
    if (!site7Result || (site7Result.correct && site7Result.review !== true)) return
    if (site7Countdown <= 0) {
      setPhaseKind('aiChat')
      return
    }
    const timer = window.setTimeout(() => setSite7Countdown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKind, site7Result, site7Countdown])

  /** AI 问询“结束问询” → 弹出“相关信息”提示（8.mp4 末帧保留为背景，面板隐藏） */
  const handleAiChatEnd = () => {
    setPhaseKind('aiRelated')
  }

  /** 8.mp4 播完：无 loop，显式暂停锁定在最后一帧（不循环、不重播），供问询页/相关信息弹窗作静态背景 */
  const handleAiVideoEnded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    e.currentTarget.pause()
  }

  /** “相关信息”弹窗点“我已了解” → 进入记录页（8.1.mp4 有声播放，问询面板仍在，左侧出现记录卡） */
  const handleRelatedAck = () => {
    setShowOutline(false)
    setPhaseKind('recordPage')
  }

  /** 记录页“结束问询” → 播放 9.mp4（现场调查继续，Figma 184:2510） */
  const handleRecordPageInquiryEnd = () => {
    setShowOutline(false)
    setPhaseKind('closingVideo9')
  }

  /** 9.mp4 播放结束 → 弹“现场调查信息”卡（Figma 301:445），末帧保留作背景 */
  const handleClosing9Ended = () => {
    if (phaseKind !== 'closingVideo9') return
    setPhaseKind('siteInfo')
  }

  /** “现场调查信息”卡“我已了解”（或右上 X）→ 播放 10.mp4（Figma 301:627 的“视频10”） */
  const handleSiteInfoAck = () => {
    setPhaseKind('closingVideo10')
  }

  /** 10.mp4 播放结束 → 弹“模块完成”提示，末帧保留作背景 */
  const handleClosing10Ended = () => {
    if (phaseKind !== 'closingVideo10') return
    setPhaseKind('moduleFinish')
  }

  /** “模块完成”提示“我已了解” → 标记「已学习」并返回模块选择页（终点的返回不弹退出确认） */
  const handleModuleFinishAck = () => {
    markDone(MODULE_ID)
    navigate('/case-study')
  }

  /** 任务列表“开始执行/重新开始”：跳转到目标任务的入口阶段，并重置各链路残留状态 */
  const handleTaskJump = (taskName: string) => {
    // 清掉所有考核结果 / 子流程索引 / 子弹窗，避免跨任务残留
    setResult(null)
    setPostResult(null)
    setPostIndex(0)
    setCdcResult(null)
    setCdcIndex(0)
    setInvestResult(null)
    setSiteResult(null)
    setSite7Result(null)
    setVideoEnded(false)
    setShowOutline(false)
    setShowCompanion(false)
    setShowTaskList(false)

    switch (taskName) {
      case '案例描述':
        setStage(0)
        setPhaseKind('video') // 1.mp4
        break
      case '接到报案':
        setStage(1)
        setPhaseKind('video') // 2.mp4
        break
      case '开展调查工作':
        setStage(STAGES.length - 1)
        setPhaseKind('investVideo19') // 19.mp4
        break
      case '现场调查':
        setStage(STAGES.length - 1)
        setPhaseKind('siteVideo20') // 20.mp4
        break
      default:
        setShowTaskList(false)
    }
  }

  /** 任务列表“返回 / 进行中”：仅关闭面板回到当前任务 */
  const handleTaskListBack = () => setShowTaskList(false)

  // 记录页访谈提纲弹窗开关（关闭后仍停留在记录页）
  const [showOutline, setShowOutline] = useState(false)

  // 左上角徽标双按钮弹窗：机器人头像 → AI学伴；胶囊文字 → 任务列表（常驻可开，关闭回当前阶段）
  const [showCompanion, setShowCompanion] = useState(false)
  const [showTaskList, setShowTaskList] = useState(false)
  const overlayOpen = showCompanion || showTaskList

  // 徽标弹窗打开期间暂停“正在播放”的媒体，关闭后从暂停位置继续播放。
  // 覆盖对象：①所有 <video>；②处置反馈弹窗 PostFeedbackModal 的说明语音（.pf-mask audio，02.mp3）。
  // 刻意不选对话语音 DialogueOverlay 的 mp3（.dlg-layer audio）——对话阶段开弹窗时语音保持连续播放。
  // 只处理打开瞬间处于播放中的媒体（!paused && !ended）：
  // 已停在末帧作题卡/弹窗背景的视频不动，避免关闭弹窗时把末帧背景重新播放。
  useEffect(() => {
    if (!overlayOpen) return
    const stageEl = document.querySelector('.epi-stage')
    if (!stageEl) return
    const media = Array.from(
      stageEl.querySelectorAll('video, .pf-mask audio'),
    ) as HTMLMediaElement[]
    const playing = media.filter(
      (m) =>
        !m.paused &&
        !m.ended &&
        Number.isFinite(m.duration) &&
        m.currentTime < m.duration - 0.05,
    )
    playing.forEach((m) => m.pause())
    return () => {
      playing.forEach((m) => {
        // 任务跳转/“我已了解”会卸载旧媒体，document.contains 守卫避免操作已移除元素
        if (document.contains(m) && !m.ended && m.paused) {
          m.play().catch(() => {})
        }
      })
    }
  }, [overlayOpen])


  /** 当前左上角徽标文案：新增链路按 phase 指定，其余沿用当前 STAGES 视频徽标 */
  const badgeText = PHASE_BADGE[phaseKind] ?? current.badge
  const showInvestVideo = phaseKind === 'investVideo19' || phaseKind === 'investQuiz5'
  const showSiteVideo = phaseKind === 'siteVideo20' || phaseKind === 'siteQuiz6'
  const showSite7Video = phaseKind === 'siteVideo7' || phaseKind === 'siteQuiz7'
  const showInvestReady = phaseKind === 'investReady'
  const showAiChat = phaseKind === 'aiChat'
  // 8.mp4 在 AI 问询与“相关信息”弹窗两阶段保留（弹窗阶段面板隐藏、画面停末帧）
  const showAiVideo = showAiChat || phaseKind === 'aiRelated'
  const showRecordPage = phaseKind === 'recordPage'
  const showClosing9 = phaseKind === 'closingVideo9' || phaseKind === 'siteInfo'
  const showClosing10 = phaseKind === 'closingVideo10' || phaseKind === 'moduleFinish'

  return (
    <StageLayout background="#000">
      <div className="epi-stage">
        {/* 主视频层：仅视频/答题阶段用主视频铺满舞台 */}
        {(phaseKind === 'video' || phaseKind === 'quiz') && (
          <video
            key={current.video}
            ref={videoRef}
            className="epi-video"
            src={current.video}
            autoPlay
            playsInline
            preload="auto"
            onEnded={handleVideoEnded}
            onPlay={() => setNeedPlay(false)}
          />
        )}

        {/* 问询及其后的考核/反馈阶段：背景 4.mp4 无声循环常驻；问询面板仅问询阶段停靠右侧 */}
        {(showInquiry || showPostQuiz || showFeedback) && (
          <>
            <video
              key="inquiry-bg"
              className={`epi-video inq-bg-video${showInquiry ? '' : ' is-full'}`}
              src={INQUIRY_VIDEO}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
            {showInquiry && <InquiryPanel onEnd={handleInquiryEnd} />}
          </>
        )}

        {/* 左上角阶段胶囊徽标（随阶段变化）：机器人头像 + 左缘挖切白色蓝边胶囊。
            徽标是两个按钮：点机器人头像弹 AI 学伴，点胶囊文字弹任务列表。
            每一页常驻，z-index=40 高于所有遮罩层，浮在遮罩之上；
            任务列表为全屏不透明页（Figma 393:499 内无徽标、靠右上“返回”退出），打开时隐藏徽标避免与标题重叠 */}
        {!showTaskList && (
        <div className={`epi-badge${badgeText.length >= 5 ? ' epi-badge--long' : ''}`}>
          <img
            className="epi-badge-pill"
            src="/images/epidemiology/stage-pill.svg"
            alt=""
            aria-hidden="true"
          />
          <img
            className="epi-badge-avatar"
            src="/images/epidemiology/stage-robot.png"
            alt=""
            aria-hidden="true"
          />
          <span className="epi-badge-text">{badgeText}</span>
          <button
            type="button"
            className="epi-badge-btn epi-badge-btn--robot"
            aria-label="打开AI学伴"
            onClick={() => setShowCompanion(true)}
          />
          <button
            type="button"
            className="epi-badge-btn epi-badge-btn--pill"
            aria-label="打开任务列表"
            onClick={() => setShowTaskList(true)}
          />
        </div>
        )}

        {/* 顶部状态栏（全站统一 Header，含阶段标签）。
            返回弯箭头改为先弹「退出提示」（保存进度并退出 / 直接退出），不再直接跳回模块页；
            走到终点的返回由「模块完成」的 handleModuleFinishAck 接管，不弹确认。 */}
        <Header
          variant="stats"
          stageLabel="现场流行病学调查"
          onBack={requestExit}
        />

        {/* 自动播放被浏览器拦截时的点击播放提示（正常情况下不出现） */}
        {needPlay && !videoEnded && phaseKind === 'video' && (
          <button
            type="button"
            className="epi-play-hint"
            onClick={() => {
              const el = videoRef.current
              if (!el) return
              el.muted = false // 用户手势后带声音播放
              el.play().catch(() => {})
            }}
          >
            点击播放视频
          </button>
        )}

        {/* 知识考核弹窗：仅在当前视频播放结束、且该视频配有考题时出现 */}
        {showQuiz && q && (
          <QuizModal
            key={`${stage}-${q.id}`}
            index={stage + 1}
            total={quizTotal}
            question={q}
            result={result ? { ...result, countdown } : null}
            onSubmit={handleSubmit}
          />
        )}

        {/* 视频2 结束后的接报通话对话：背景 3/4.mp4 循环 + 语音 + 字幕（2 条），播完进入问询页 */}
        {showDialog && <DialogueOverlay lines={current.dialogues!} onFinish={handleDialogFinish} />}

        {/* 结束问询后的两题知识考核：01/02 = H_03（单选），02/02 = H_02（多选） */}
        {showPostQuiz && postQ && (
          <QuizModal
            key={`post-${postIndex}-${postQ.id}`}
            index={postIndex + 1}
            total={POST_QUIZ_IDS.length}
            question={postQ}
            result={postResult ? { ...postResult, countdown: postCountdown } : null}
            onSubmit={handlePostSubmit}
          />
        )}

        {/* 两题考核完成后的处置反馈弹窗 */}
        {showFeedback && <PostFeedbackModal onAck={handleFeedbackAck} />}

        {/* 汇报遮罩页：点击顶栏以外任意区域进入疾控汇报对话 */}
        {phaseKind === 'briefing' && <BriefingOverlay onContinue={handleBriefingContinue} />}

        {/* 疾控值班王医师↔尤主任对话：背景 5/6.mp4 静音循环 + 03/04 语音，播完进入两题考核 */}
        {showCdcDialog && (
          <DialogueOverlay
            lines={CDC_REPORT_DIALOGUES}
            title="流行病学调查 · 逐级汇报"
            roleSide={{ 王医师: 'left', 尤主任: 'right' }}
            roleColor={{ 王医师: '#3f7fd6', 尤主任: '#e07a4f' }}
            onFinish={handleCdcDialogFinish}
          />
        )}

        {/* 疾控汇报后的单题知识考核：H_04（多选）。背景 过渡6.mp4 只播放一次，
            结束后自然停在最后一帧（不循环），题卡常驻其上 */}
        {showCdcQuiz && (
          <>
            <video
              key="cdc-quiz-bg"
              className="epi-video cdc-quiz-bg"
              src={CDC_QUIZ_BG}
              autoPlay
              muted
              playsInline
              preload="auto"
            />
            <QuizModal
              key={`cdc-${cdcIndex}-${cdcQ!.id}`}
              index={cdcIndex + 1}
              total={CDC_QUIZ_IDS.length}
              question={cdcQ!}
              result={cdcResult ? { ...cdcResult, countdown: cdcCountdown } : null}
              onSubmit={handleCdcSubmit}
            />
          </>
        )}

        {/* 两题完成后的突发公共卫生事件报告流程终页（含“继 续”按钮 → 19.mp4） */}
        {showReportFlow && <ReportFlow onContinue={handleReportFlowContinue} />}

        {/* 19.mp4（开展调查工作）：有声自动播放，字幕已烧录在视频内；播放结束后元素保留、
            自然停在末帧，作为 H_05 题卡背景 */}
        {showInvestVideo && (
          <>
            <video
              key="invest-video-19"
              ref={chainVideoRef}
              className="epi-video"
              src={INVEST_VIDEO_19}
              autoPlay
              playsInline
              preload="auto"
              onEnded={handleInvestVideoEnded}
              onPlay={() => setChainNeedPlay(false)}
            />
            {chainNeedPlay && phaseKind === 'investVideo19' && (
              <button
                type="button"
                className="epi-play-hint"
                onClick={() => {
                  const el = chainVideoRef.current
                  if (!el) return
                  el.muted = false // 用户手势后带声音播放
                  el.play().catch(() => {})
                }}
              >
                点击播放视频
              </button>
            )}
          </>
        )}

        {/* 19.mp4 结束后弹出 H_05 单题考核卡（多选，对齐 Figma 184:1227），背景停在末帧 */}
        {showInvestQuiz && investQ && (
          <QuizModal
            key="invest-quiz-h05"
            index={1}
            total={1}
            question={investQ}
            result={investResult ? { ...investResult, countdown: investCountdown } : null}
            onSubmit={handleInvestSubmit}
          />
        )}

        {/* H_05 完成后的调查组准备静态页：sc_04 全屏 + 字幕 + “继 续”按钮（→ 20.mp4） */}
        {showInvestReady && <InvestReady onContinue={handleInvestReadyContinue} />}

        {/* 20.mp4（现场调查）：有声自动播放；播放结束后元素保留、自然停在末帧，
            作为 H_06 题卡背景（对齐 Figma 297:819） */}
        {showSiteVideo && (
          <>
            <video
              key="site-video-20"
              ref={chainVideoRef}
              className="epi-video"
              src={SITE_VIDEO_20}
              autoPlay
              playsInline
              preload="auto"
              onEnded={handleSiteVideoEnded}
              onPlay={() => setChainNeedPlay(false)}
            />
            {chainNeedPlay && phaseKind === 'siteVideo20' && (
              <button
                type="button"
                className="epi-play-hint"
                onClick={() => {
                  const el = chainVideoRef.current
                  if (!el) return
                  el.muted = false
                  el.play().catch(() => {})
                }}
              >
                点击播放视频
              </button>
            )}
          </>
        )}

        {/* 20.mp4 结束后弹出 H_06 单题考核卡（多选，对齐 Figma 297:819），
            答对立即、答错停留 5 秒后自动播放 7.mp4 */}
        {showSiteQuiz && siteQ && (
          <QuizModal
            key="site-quiz-h06"
            index={1}
            total={1}
            question={siteQ}
            result={siteResult ? { ...siteResult, countdown: siteCountdown } : null}
            onSubmit={handleSiteSubmit}
          />
        )}

        {/* 7.mp4（现场调查继续）：有声自动播放、无烧录字幕；播放结束后元素保留、自然停在末帧，
            作为 H_07 题卡背景（对齐 Figma 297:975 / 184:1674） */}
        {showSite7Video && (
          <>
            <video
              key="site-video-7"
              ref={chainVideoRef}
              className="epi-video"
              src={SITE_VIDEO_7}
              autoPlay
              playsInline
              preload="auto"
              onEnded={handleSite7VideoEnded}
              onPlay={() => setChainNeedPlay(false)}
            />
            {chainNeedPlay && phaseKind === 'siteVideo7' && (
              <button
                type="button"
                className="epi-play-hint"
                onClick={() => {
                  const el = chainVideoRef.current
                  if (!el) return
                  el.muted = false // 用户手势后带声音播放
                  el.play().catch(() => {})
                }}
              >
                点击播放视频
              </button>
            )}
          </>
        )}

        {/* 7.mp4 结束后弹出 H_07 单题考核卡（多选，以题库为准仅一题 01/01，
            Figma 184:1674 的 01/02 标注仅为页面效果），答对立即、答错停留 5 秒后进入 AI 问询 */}
        {showSite7Quiz && site7Q && (
          <QuizModal
            key="site-quiz-h07"
            index={1}
            total={1}
            question={site7Q}
            result={site7Result ? { ...site7Result, countdown: site7Countdown } : null}
            onSubmit={handleSite7Submit}
          />
        )}

        {/* H_07 完成后的 AI 问询对话页（对齐 Figma 184:1833）：
            8.mp4 有声播放一次后停在末帧作为全屏背景，右侧停靠“疾病预防控制中心”问询面板，
            学员以疾控中心值班员身份继续问询；“结束问询”弹“相关信息”弹窗。
            aiRelated 阶段视频末帧继续保留作为弹窗背景，仅隐藏问询面板。 */}
        {showAiVideo && (
          <>
            <video
              key="ai-chat-bg"
              className="epi-video"
              src={AI_CHAT_VIDEO}
              autoPlay
              playsInline
              preload="auto"
              onEnded={handleAiVideoEnded}
            />
            {showAiChat && <InquiryPanel onEnd={handleAiChatEnd} config={AI_CHAT_INQUIRY_CONFIG} />}
            {phaseKind === 'aiRelated' && <RelatedInfoModal onAck={handleRelatedAck} />}
          </>
        )}

        {/* “我已了解”后的记录页（对齐 Figma 184:2240）：8.1.mp4 有声播放一次停末帧，
            问询面板仍停靠右侧（“结束问询”当前无后续）；左上浮出“记录｜个案调查表”卡片，
            点击弹出访谈提纲文档弹窗（184:2357），关闭后停留本页 */}
        {showRecordPage && (
          <>
            <video
              key="record-page-bg"
              className="epi-video"
              src={RECORD_PAGE_VIDEO}
              autoPlay
              playsInline
              preload="auto"
            />
            <InquiryPanel onEnd={handleRecordPageInquiryEnd} config={AI_CHAT_INQUIRY_CONFIG} />
            <button
              type="button"
              className="rec-entry"
              aria-label="记录 个案调查表"
              onClick={() => setShowOutline(true)}
            >
              <img src="/images/epidemiology/record-card.png" alt="" aria-hidden="true" />
            </button>
            {showOutline && <InterviewOutlineModal onClose={() => setShowOutline(false)} />}
          </>
        )}

        {/* 记录页“结束问询”后：9.mp4 有声播放一次，停末帧弹“现场调查信息”卡
            （对齐 Figma 184:2510 / 301:445）。siteInfo 阶段保留末帧作弹窗背景。 */}
        {showClosing9 && (
          <>
            <video
              key="closing-video-9"
              ref={closingVideoRef}
              className="epi-video"
              src={CLOSING_VIDEO_9}
              autoPlay
              playsInline
              preload="auto"
              onEnded={handleClosing9Ended}
              onPlay={() => setClosingNeedPlay(false)}
            />
            {closingNeedPlay && phaseKind === 'closingVideo9' && (
              <button
                type="button"
                className="epi-play-hint"
                onClick={() => {
                  const el = closingVideoRef.current
                  if (!el) return
                  el.muted = false
                  el.play().catch(() => {})
                }}
              >
                点击播放视频
              </button>
            )}
            {phaseKind === 'siteInfo' && <SiteSurveyInfoModal onAck={handleSiteInfoAck} />}
          </>
        )}

        {/* “现场调查信息”卡“我已了解”后：10.mp4 有声播放一次，停末帧弹“模块完成”提示
            （对齐 Figma 301:627）。点“我已了解”返回模块选择页。 */}
        {showClosing10 && (
          <>
            <video
              key="closing-video-10"
              ref={closingVideoRef}
              className="epi-video"
              src={CLOSING_VIDEO_10}
              autoPlay
              playsInline
              preload="auto"
              onEnded={handleClosing10Ended}
              onPlay={() => setClosingNeedPlay(false)}
            />
            {closingNeedPlay && phaseKind === 'closingVideo10' && (
              <button
                type="button"
                className="epi-play-hint"
                onClick={() => {
                  const el = closingVideoRef.current
                  if (!el) return
                  el.muted = false
                  el.play().catch(() => {})
                }}
              >
                点击播放视频
              </button>
            )}
            {phaseKind === 'moduleFinish' && <ModuleFinishModal onAck={handleModuleFinishAck} />}
          </>
        )}

        {/* 徽标双按钮弹窗：AI学伴（机器人）/ 任务列表（胶囊，当前任务行高亮）。
            与阶段状态机解耦，任何阶段都可打开，关闭即回原阶段，不影响播放进度 */}
        {showCompanion && <AiCompanionModal onClose={() => setShowCompanion(false)} />}
        {showTaskList && (
          <TaskListModal
            currentTask={badgeText}
            onBack={handleTaskListBack}
            onJump={handleTaskJump}
          />
        )}

        {/* 中途退出确认（Figma 1:7889）：顶栏返回弯箭头触发 */}
        {exitPrompt && (
          <ExitConfirmModal
            onSaveAndExit={handleSaveAndExit}
            onDiscardAndExit={handleDiscardAndExit}
            onCancel={() => setExitPrompt(false)}
          />
        )}
      </div>
    </StageLayout>
  )
}
