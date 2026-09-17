import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import StageLayout from '../components/layout/StageLayout'
import Header from '../components/Header'
import DataTableModal from '../components/player/DataTableModal'
import QuizStep from '../components/player/QuizStep'
import ConclusionHintModal from '../components/player/ConclusionHintModal'
import SummaryTableModal from '../components/player/SummaryTableModal'
import ReportOutlineModal from '../components/player/ReportOutlineModal'
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

type AnalysisPhase =
  | 'video15'
  | 'table'
  | 'quiz1'
  | 'quiz2'
  | 'quiz3'
  | 'quiz4'
  | 'quiz5'
  | 'conclusion'
  | 'summary'
  | 'report'

/* 知识考核 5 题：显示序号与题库 qid 的映射（xlsx H_15~H_19） */
const ANALYSIS_QUIZ = [
  { phase: 'quiz1', qid: 'H_18' },
  { phase: 'quiz2', qid: 'H_19' },
  { phase: 'quiz3', qid: 'H_20' },
  { phase: 'quiz4', qid: 'H_21' },
  { phase: 'quiz5', qid: 'H_22' },
] as const

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
  const [phase, setPhase] = useState<AnalysisPhase>('video15')
  const [needPlay, setNeedPlay] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // 进入页面尝试有声自动播放 15.mp4；被浏览器拦截则显示点击播放提示
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
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
        {/* 15.mp4：播完停末帧并作为数据表格背景，元素始终保持挂载 */}
        <video
          ref={videoRef}
          className="epi-video an-video"
          src="/Video/15.mp4"
          autoPlay
          playsInline
          preload="auto"
          onPlay={() => setNeedPlay(false)}
          onEnded={() => setPhase('table')}
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
            onClose={() => navigate('/case-study')}
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
            onClose={() => navigate('/case-study')}
            onConfirm={() => setPhase('report')}
          />
        )}

        {/* 《食品安全事故流行病学调查报告提纲》（Figma 370:1988，文本滚动 + 底部确认）。
            底部「确认」或右上 X 均为模块终点，返回模块选择页。 */}
        {phase === 'report' && (
          <ReportOutlineModal onConfirm={() => navigate('/case-study')} />
        )}

        {/* 顶部状态栏（阶段标签：资料分析及调查结论，对齐 Figma 230:288；返回弯箭头映射回 /case-study） */}
        <Header variant="stats" score={100} timeText="20:00" stageLabel="资料分析及调查结论" />
      </div>
    </StageLayout>
  )
}
