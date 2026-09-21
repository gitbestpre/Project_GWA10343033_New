import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import StageLayout from '../components/layout/StageLayout'
import Header from '../components/Header'
import DataTableModal from '../components/player/DataTableModal'
import QuizStep from '../components/player/QuizStep'
import ConclusionHintModal from '../components/player/ConclusionHintModal'
import SummaryTableModal from '../components/player/SummaryTableModal'
import ReportOutlineModal from '../components/player/ReportOutlineModal'
import ExitConfirmModal from '../components/player/ExitConfirmModal'
import {
  MODULE_FIRST_STEP,
  discardSession,
  makeStepGuard,
  markDone,
  markStudying,
  readProgress,
} from '../lib/moduleProgress'
import './EpidemiologyPlayer.css'
import './AnalysisPlayer.css'

/* ------------------------------------------------------------------ *
 * 资料分析及调查结论模块（/analysis）
 *
 * 阶段编排：
 *   video15  进入即有声自动播放 15.mp4，左上徽标「可疑食物分析」
 *            - 浏览器拦截自动播放时显示「点击播放视频」
 *            - 无原生控制条，播完停在最后一帧（元素保持挂载做背景）
 *   table    15.mp4 播完后弹出 Figma 191:587「数据表格」
 *            - 学员逐行填写 OR，95%CI 按 Woolf 法自动生成
 *            - 点「提交」判题显示正确 OR，停留 5 秒后进入知识考核
 *            - 右上 X 关闭即返回模块选择页 /case-study
 *   quiz1..5 5 道选择题（复用流行病学/食品卫生调查 QuizStep 模板）
 *            - 对应《选择题.xlsx》H_15~H_19，题库现有 H_18~H_22 内容逐字一致
 *            - 答对即时、答错展示正确答案停留 5 秒
 *   conclusion 末题答完弹「如何给这起事件下结论?」提示卡（Figma 355:1547）
 *   summary    点「我已了解」显示《信息整理表》长图弹窗（Figma 355:1701），底部确认
 *   report     整理表确认后显示《调查报告提纲》滚动弹窗（Figma 370:1988），确认返回模块页
 *
 * 顶栏阶段标签「可疑食物分析」；顶栏返回弯箭头映射回 /case-study。
 * ------------------------------------------------------------------ */

/** 全阶段常量表（同时充当断点校验白名单，见下方 isAnalysisStep） */
const ANALYSIS_PHASES = [
  'video15',
  'table',
  'quiz1',
  'quiz2',
  'quiz3',
  'quiz4',
  'quiz5',
  'conclusion',
  'summary',
  'report',
] as const
type AnalysisPhase = (typeof ANALYSIS_PHASES)[number]

/* 知识考核 5 题：显示序号与题库 qid 的映射。
   ⚠️ 题库 id 是 H_18~H_22，**不是** H_15~H_19 —— 需求里的 H_15~H_19 指的是
   《选择题.xlsx》的**表行号**，与题库 id 之间有两行偏移（行号 ≠ id，曾因此误改）。 */
const ANALYSIS_QUIZ = [
  { phase: 'quiz1', qid: 'H_18' },
  { phase: 'quiz2', qid: 'H_19' },
  { phase: 'quiz3', qid: 'H_20' },
  { phase: 'quiz4', qid: 'H_21' },
  { phase: 'quiz5', qid: 'H_22' },
] as const

/* ---- 学习进度（断点续做）：模块 id、首步、断点校验器 ---- */
const MODULE_ID = 'analysis' as const
const FIRST_STEP = MODULE_FIRST_STEP[MODULE_ID] as AnalysisPhase
/** 断点校验：白名单即 ANALYSIS_PHASES，与类型定义同源，脏数据一律判为无断点 */
const isAnalysisStep = makeStepGuard(ANALYSIS_PHASES)

const PILL_H = 64
const CAP_R = 31.614 // 右端圆头半径（与食品卫生 / 实验室检测 stage-pill 同几何）
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
    <span className="an-badge-pill" style={{ width, height: PILL_H }}>
      <svg
        className="an-pill-svg"
        width={width}
        height={PILL_H}
        viewBox={`0 0 ${width} ${PILL_H}`}
        aria-hidden="true"
      >
        <defs>
          <mask id="an-pill-inside" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={width} height={PILL_H} fill="black" />
            <path d={d} fill="white" stroke="white" strokeWidth="4" />
          </mask>
        </defs>
        <path d={d} fill="#ffffff" />
        <path d={d} fill="none" stroke="#1949A9" strokeWidth="4" mask="url(#an-pill-inside)" />
      </svg>
      <span ref={textRef} className="an-badge-text" style={{ font: PILL_FONT, left: TEXT_LEFT }}>
        {text}
      </span>
    </span>
  )
}

/**
 * 知识考核适配层（仅 /analysis 使用，QuizStep/QuizModal 共享组件零改动）：
 * 卡片选项区是 56px 固定高 + nowrap 省略号模板；本模块 H_21/H_22 选项很长。
 * 做法：挂载后测量选项区总高是否超出可用高度（top126/157 → 结果条 top512，
 * 即 376/345px），超出则把选项字号从 24px 逐档下调（22/20/18/17/16）直到
 * 全部选项一屏放完——无滚动条、不需用户滚动；短选项题（H_18~H_20）24px
 * 与 Figma 194:829 原模板完全一致。父级以 key={qid} 重挂，每题独立从 24px 起测。
 */
const OPTION_FONT_STEPS = [24, 22, 20, 18, 17, 16] as const
const QUIZ_BUDGET_ONE_LINE_Q = 376 // 题干一行：512 - 126(选项top) - 10(与结果条间距)
const QUIZ_BUDGET_TWO_LINE_Q = 345 // 题干两行(.is-long-q，top157)：512 - 157 - 10

function AnalysisQuizStep({ children }: { children: ReactNode }) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const fontSize = OPTION_FONT_STEPS[step]
  const compact = step > 0 // 缩字档联动收紧垂直留白（短选项题永远 false，保持模板原样）

  // 布局阶段同步迭代：当前字号放不下就降一档重渲（paint 前完成，无闪烁）
  useLayoutEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const card = layer.querySelector('.epi-quiz')
    const ul = layer.querySelector('.epi-quiz-options')
    if (!(card instanceof HTMLElement) || !(ul instanceof HTMLElement)) return
    const budget = card.classList.contains('is-long-q')
      ? QUIZ_BUDGET_TWO_LINE_Q
      : QUIZ_BUDGET_ONE_LINE_Q
    // gap 从当前生效的计算样式读（普通档 10px、紧凑档 6px），保证测量与渲染一致
    const gap = parseFloat(getComputedStyle(ul).rowGap || getComputedStyle(ul).gap) || 0
    let contentH = Math.max(0, ul.children.length - 1) * gap
    ul.querySelectorAll('.epi-option').forEach((btn) => {
      if (btn instanceof HTMLElement) contentH += btn.offsetHeight
    })
    if (contentH > budget && step < OPTION_FONT_STEPS.length - 1) {
      setStep(step + 1)
    }
  }, [step])

  return (
    <div
      ref={layerRef}
      className="an-quiz-layer"
      data-compact={compact ? '' : undefined}
      style={{ '--an-opt-fs': `${fontSize}px` } as CSSProperties}
    >
      {children}
    </div>
  )
}

export default function AnalysisPlayer() {
  const navigate = useNavigate()
  // 断点续做：首次挂载读一次存储 —— 有合法断点就停在该步，否则从第一步开始
  const [phase, setPhase] = useState<AnalysisPhase>(() => {
    const step = readProgress(MODULE_ID).step
    return isAnalysisStep(step) ? step : FIRST_STEP
  })
  const [needPlay, setNeedPlay] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  /**
   * 进入本页时断点落在哪个阶段（= 续做落点）。
   * 只关心**挂载那一刻**：之后 phase 会一路推进，而 15.mp4 是始终挂载的，
   * 它的挂载期行为必须按「进来时停在哪」来决定（见下方 effect）。
   */
  const resumedPhaseRef = useRef(phase)
  /** 定格只做一次（StrictMode 下 effect 会跑两遍） */
  const frozenRef = useRef(false)
  /** 中途退出确认弹窗（Figma 1:7889「退出提示」） */
  const [exitPrompt, setExitPrompt] = useState(false)

  // 每推进一步即写回断点：供模块选择页显示「学习中」/「已学习」，也是下次进入的续做点
  useEffect(() => {
    markStudying(MODULE_ID, phase)
  }, [phase])

  /** 中途退出请求（顶栏返回箭头 / 两个弹窗的 X）→ 先弹「退出提示」 */
  const requestExit = () => setExitPrompt(true)

  /** 保存进度并退出：断点已随 phase 持续写入，直接返回模块页 */
  const handleSaveAndExit = () => {
    setExitPrompt(false)
    navigate('/case-study')
  }

  /** 直接退出：本次学习成绩不予记录 —— 清掉本次断点再返回 */
  const handleDiscardAndExit = () => {
    discardSession(MODULE_ID)
    setExitPrompt(false)
    navigate('/case-study')
  }

  /** 走到模块终点（报告提纲确认）：标记「已学习」后返回 —— 终点的返回不弹退出确认 */
  const handleFinish = () => {
    markDone(MODULE_ID)
    navigate('/case-study')
  }

  /**
   * 15.mp4 的挂载期行为 —— 按断点分两种情况（断点续做的关键，别改回单一 autoPlay）：
   *
   *   ① 断点落在首段（首次进入 / 续做回到 video15）：**有声自动播放**；
   *      被浏览器拦截则显示「点击播放视频」，播完由 onEnded 推进到 table。
   *   ② 断点落在 video15 **之后**的阶段（table/quiz1-5/conclusion/summary/report）：
   *      本模块的 15.mp4 **始终挂载**，作用是「停末帧当数据表格与后续弹窗的底图」。
   *      若此时照常自动播放，它会**从第 0 秒重播一遍**（全长 8.29s），播完触发
   *      onEnded 把 phase 拽回 'table' —— 学员正在答的题 / 正在看的提纲被顶掉，
   *      断点还被 markStudying 改写回 table（**进度倒退**）。
   *
   * 故此处**不使用 autoPlay 属性**，改由本 effect 显式驱动：续做进入后置阶段时
   * 直接暂停并**定格到末帧**，画面一上来就是该有的底图，且一个字节都不重播。
   *
   * ⚠️ 定格动作本身要注意：`currentTime = duration` 也会触发 `ended`，
   * 所以 onEnded 里另加了**阶段守卫**做双保险（见 video 元素）。
   * ⚠️ duration 需等元数据就绪；`preload="auto"` 通常已就绪，否则挂一次性监听。
   */
  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    if (resumedPhaseRef.current !== FIRST_STEP) {
      if (frozenRef.current) return
      frozenRef.current = true
      el.pause() // autoplay 可能仍在 pending，先掐掉，避免短暂重播
      const freezeAtEnd = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) el.currentTime = el.duration
      }
      if (el.readyState >= 1 /* HAVE_METADATA */) freezeAtEnd()
      else el.addEventListener('loadedmetadata', freezeAtEnd, { once: true })
      return
    }

    // 首段：尝试有声自动播放；被拦截则显示点击播放提示
    el.play().catch(() => setNeedPlay(true))
  }, [])

  const startPlay = () => {
    const el = videoRef.current
    if (!el) return
    el.muted = false
    setNeedPlay(false)
    el.play().catch(() => {})
  }

  return (
    <StageLayout background="#000">
      <div className="epi-stage an-stage">
        {/* 15.mp4：播完停末帧并作为数据表格/后续弹窗的背景，元素**始终保持挂载**。
            刻意不写 `autoPlay` —— 挂载期行为由上方 effect 按断点分派：
            续做进入后置阶段时定格末帧（不重播），只有首段才自动播放。
            onEnded 带**阶段守卫**：本元素常驻，定格 seek 与重播都会触发 ended，
            无条件 setPhase('table') 会把学员正在答的题/正看的提纲拽走。 */}
        <video
          ref={videoRef}
          className="epi-video an-video"
          src="/Video/15.mp4"
          playsInline
          preload="auto"
          onPlay={() => setNeedPlay(false)}
          onEnded={() => {
            if (phase === FIRST_STEP) setPhase('table')
          }}
        />

        {/* 自动播放被拦截时的点击播放提示 */}
        {needPlay && phase === 'video15' && (
          <button type="button" className="epi-play-hint" onClick={startPlay}>
            点击播放视频
          </button>
        )}

        {/* 左上角阶段徽标：机器人头像 + 鱼尾白胶囊「可疑食物分析」 */}
        <div className="an-badge">
          <img
            className="an-badge-avatar"
            src="/images/epidemiology/stage-robot.png"
            alt=""
            aria-hidden="true"
          />
          <span className="an-badge-pill-slot">
            <StagePill text="可疑食物分析" />
          </span>
        </div>

        {/* 15.mp4 播完：Figma 191:587 数据表格（OR 手填，95%CI 自动生成，提交判题停 5 秒） */}
        {phase === 'table' && (
          <DataTableModal
            onClose={requestExit}
            onGraded={() => setPhase('quiz1')}
          />
        )}

        {/* 知识考核 5 题（复用 QuizStep：答对即时、答错停留 5 秒；末题答完返回模块页）。
            AnalysisQuizStep 仅在本模块做选项字号自适应：长选项自动缩字号一屏放完，
            短选项题保持原模板 24px/56px；共享组件与其他模块样式不变。 */}
        {phase.startsWith('quiz') && (
          <>
            {ANALYSIS_QUIZ.map((q, i) =>
              phase === q.phase ? (
                <AnalysisQuizStep key={q.qid}>
                  <QuizStep
                    qid={q.qid}
                    index={i + 1}
                    total={ANALYSIS_QUIZ.length}
                    onAdvance={() => {
                      if (i + 1 < ANALYSIS_QUIZ.length) {
                        setPhase(ANALYSIS_QUIZ[i + 1].phase)
                      } else {
                        // 末题答完：先弹「如何给这起事件下结论?」提示卡（不直接回模块页）
                        setPhase('conclusion')
                      }
                    }}
                    successText={
                      i + 1 === ANALYSIS_QUIZ.length ? '本环节考核完成，即将进入下一步……' : undefined
                    }
                  />
                </AnalysisQuizStep>
              ) : null,
            )}
          </>
        )}

        {/* 末题后的「如何给这起事件下结论?」提示卡（Figma 355:1547）。
            「我已了解」/ X → 显示信息整理表。 */}
        {phase === 'conclusion' && (
          <ConclusionHintModal onAck={() => setPhase('summary')} />
        )}

        {/* 《食品安全事故流行病学调查信息整理表》（Figma 355:1701，长图滚动）。
            右上 X 返回模块选择页；底部「确认」进入《调查报告提纲》。 */}
        {phase === 'summary' && (
          <SummaryTableModal
            onClose={requestExit}
            onConfirm={() => setPhase('report')}
          />
        )}

        {/* 《食品安全事故流行病学调查报告提纲》（Figma 370:1988，文本滚动 + 底部确认）。
            底部「确认」是本模块的**终点**：标记「已学习」后返回模块选择页。 */}
        {phase === 'report' && <ReportOutlineModal onConfirm={handleFinish} />}

        {/* 顶部状态栏（阶段标签：资料分析及调查结论，对齐 Figma 230:288）。
            返回弯箭头改为先弹「退出提示」（保存进度并退出 / 直接退出），
            不再直接跳回模块页 —— 除非已走到终点（此时 handleFinish 已接管）。 */}
        <Header
          variant="stats"
          stageLabel="资料分析及调查结论"
          onBack={requestExit}
        />

        {/* 中途退出确认（Figma 1:7889） */}
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
