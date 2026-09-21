import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { formatDuration, getCaseTimerSeconds, subscribeCaseTimer } from '../lib/caseStudyTimer'
import { getScore, subscribeQuizScore } from '../lib/quizScore'
import './Header.css'

type HeaderVariant = 'simple' | 'stats'

/** 四大调查模块（与 /case-study 模块卡片一致），用于顶栏中部下拉切换 */
const STAGE_MODULES = [
  { id: 'epidemiology', title: '现场流行病学调查', path: '/epidemiology' },
  { id: 'food-hygiene', title: '食品卫生学调查', path: '/food-hygiene' },
  { id: 'lab-testing', title: '实验室检测', path: '/lab-testing' },
  { id: 'analysis', title: '资料分析及调查结论', path: '/analysis' },
] as const

/**
 * 全局顶部栏 —— 全站唯一一套，严格对齐 Figma「Group 427321485」(1920x73)。
 *
 * 关键：所有元素都按 Figma 帧内绝对坐标摆放，元素显隐（阶段标签 / 得分卡）
 * 只做"显示与否"，绝不改变其它共有元素的位置，因此任意页面顶栏长度、
 * 共有元素位置完全一致。
 *
 * - variant="simple"：仅右侧 5 个操作图标（首页 / 知识宣教等浏览页）
 * - variant="stats" ：再叠加「目前得分 / 操作用时」卡片（案例学习 / 播放页）
 * - stageLabel      ：可选的当前阶段标签（如"现场流行病学调查"），
 *                     带左右竖线，固定在标题与得分卡之间
 *
 * 帧内坐标（Figma 230:288 / Group 427321485，宽 1920，高 73）：
 *   校徽 x15 y6 (232x58) ｜ 竖线 x262 (2x39) ｜ 标题 x275（中文26px/英文9px 字距~1px #1D2129）
 *   阶段标签 771–1081（左右竖线 771/1079，蓝底 793–1053 宽260，文字26px）
 *   得分卡 x1108 (226x41) ｜ 用时卡 x1364 (273x41)，均 2px #618DCF 内描边
 *   数字 100 / 20:00 使用 Digital Numbers 24px（public/fonts，@font-face 见 index.css）
 *   图标簇 x1673 宽224（右内边距 23）
 */
/**
 * 「操作用时」的数字。
 *
 * 单独抽成组件，是为了让**订阅计时器**这件事只在 variant="stats" 时发生 ——
 * 首页 / 知识宣教的顶栏不显示用时卡，没必要跟着每秒重渲一次。
 *
 * 计时口径见 lib/caseStudyTimer：进入案例学习开始走，返回首页停止；
 * 域内各页切换持续累计，刷新接着算。`override` 供特殊场景显式指定固定值。
 */
function TimeStatValue({ override }: { override?: string }) {
  const seconds = useSyncExternalStore(subscribeCaseTimer, getCaseTimerSeconds)
  return <span className="hd-stat-value hd-num">{override ?? formatDuration(seconds)}</span>
}

/**
 * 「目前得分」的数字。
 *
 * 与「操作用时」同款做法：单独抽成组件，让**订阅计分**只在 variant="stats" 时发生
 * （首页 / 知识宣教的顶栏没有这张卡，不该跟着重渲）。
 * 分值口径见 lib/quizScore：单选答对 6 分、多选答对 5 分，0 分起累加，满分 100。
 */
function ScoreStatValue({ override }: { override?: number }) {
  const score = useSyncExternalStore(subscribeQuizScore, getScore)
  return <span className="hd-stat-value hd-num">{override ?? score}</span>
}

export default function Header({
  variant = 'simple',
  score,
  timeText,
  stageLabel,
  onBack,
}: {
  variant?: HeaderVariant
  /**
   * 显式指定「目前得分」数值；**不传则用 quizScore 的实时值**（单选 6 / 多选 5，0 起累加）。
   * 案例学习相关页面一律不传，交给计分模块统一驱动。
   */
  score?: number
  /**
   * 显式指定「操作用时」文案；**不传则用案例学习计时器实时值**（MM:SS，每秒刷新）。
   * 案例学习相关页面一律不传，交给计时器统一驱动。
   */
  timeText?: string
  stageLabel?: string
  /**
   * 返回拦截钩子：传入后由页面接管返回逻辑（用于先弹「退出提示」再决定去向）；
   * 不传则按下方 BACK_TARGETS 映射直接跳转，保持既有行为不变。
   */
  onBack?: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()

  // 阶段标签下拉菜单
  const [menuOpen, setMenuOpen] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  // 路由切换即收起菜单
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // 点击菜单外部 / 按 ESC 关闭
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (stageRef.current && !stageRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const activeModule = STAGE_MODULES.find((m) => m.path === location.pathname)

  // 返回目标按应用导航层级固定映射，避免依赖浏览历史
  //（刷新或直接打开 URL 时 navigate(-1) 会失效或返回到应用外）。
  const BACK_TARGETS: Record<string, string> = {
    '/case-study': '/',
    '/knowledge': '/',
    '/epidemiology': '/case-study',
    '/food-hygiene': '/case-study',
    '/lab-testing': '/case-study',
    '/analysis': '/case-study',
  }
  const backTo = BACK_TARGETS[location.pathname]
  const isHomePage = location.pathname === '/'
  const backDisabled = isHomePage || (backTo === undefined && !onBack)

  const handleBack = () => {
    // 页面接管优先（各调查模块用它先弹「退出提示」：保存进度并退出 / 直接退出）
    if (onBack) {
      onBack()
      return
    }
    if (backTo !== undefined) navigate(backTo)
  }

  return (
    <header className="app-header">
      {/* 校徽 */}
      <img src="/images/wmu-logo.png" alt="温州医科大学" className="hd-logo" />

      {/* 标题竖线 + 中英标题 */}
      <span className="hd-divider hd-divider-brand" />
      <div className="hd-titles">
        <h1 className="hd-title-cn">AI食品致病性微生物污染事件应急与处置</h1>
        <p className="hd-title-en">
          Emergency response and disposal of food pathogenic microorganism contamination incidents
        </p>
      </div>

      {/* 当前阶段标签 —— 可点击下拉切换模块（仅传入 stageLabel 的播放页显示） */}
      {stageLabel && (
        <div className={'hd-stage' + (menuOpen ? ' is-open' : '')} ref={stageRef}>
          <span className="hd-divider hd-divider-stage-l" />
          <button
            type="button"
            className="hd-stage-tag"
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="hd-stage-label">{stageLabel}</span>
            <svg className="hd-stage-caret" viewBox="0 0 12 8" width="12" height="8" aria-hidden>
              <path d="M1 1l5 5 5-5" fill="none" stroke="#FFFFFF" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {menuOpen && (
            <ul className="hd-stage-menu" role="listbox" aria-label="切换调查模块">
              {STAGE_MODULES.map((m) => {
                const active = activeModule?.id === m.id
                return (
                  <li key={m.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={'hd-stage-item' + (active ? ' is-active' : '')}
                      onClick={() => { setMenuOpen(false); navigate(m.path) }}
                    >
                      <span className="hd-stage-item-tick" aria-hidden>
                        {active && (
                          <svg viewBox="0 0 12 10" width="12" height="10">
                            <path d="M1 5l3.5 3.5L11 1" fill="none" stroke="#618dcf"
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="hd-stage-item-text">{m.title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <span className="hd-divider hd-divider-stage-r" />
        </div>
      )}

      {/* 得分 / 用时 卡片（variant=stats 时显示，位置固定） */}
      {variant === 'stats' && (
        <>
          <div className="hd-stat hd-score-card">
            <svg className="hd-icon-star" viewBox="0 0 28 27" width="28" height="27" aria-hidden>
              <path fill="#FDB806" d="M14 0l3.9 8.6 9.1 1-6.8 6.1 1.9 9-8.1-4.7L5.9 24.7l1.9-9L1 9.6l9.1-1z" />
            </svg>
            <span className="hd-stat-label">目前得分</span>
            <span className="hd-stat-sep" />
            <ScoreStatValue override={score} />
          </div>
          <div className="hd-stat hd-time-card">
            <svg className="hd-icon-clock" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="none" stroke="#1ED84E" strokeWidth="2" />
              <path d="M12 6v6l4 2" fill="none" stroke="#1ED84E" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="hd-stat-label">操作用时</span>
            <span className="hd-stat-sep" />
            <TimeStatValue override={timeText} />
          </div>
        </>
      )}

      {/* 右侧 5 个操作图标（Figma Component 32，所有页面同一位置 x1673） */}
      <nav className="hd-tools">
        <button type="button" className="hd-tool" title="帮助" aria-label="帮助">
          <img src="/images/icons/nav/nav-help.svg" alt="" className="hd-tool-img" />
        </button>
        <button type="button" className="hd-tool" title="设置" aria-label="设置">
          <img src="/images/icons/nav/nav-gear.svg" alt="" className="hd-tool-img hd-tool-gear" />
        </button>
        <button
          type="button"
          className="hd-tool"
          title={backDisabled ? '返回' : '返回上一页'}
          aria-label="返回"
          onClick={backDisabled ? undefined : handleBack}
          disabled={backDisabled}
        >
          <img src="/images/icons/nav/nav-redo.svg" alt="" className="hd-tool-img" />
        </button>
        <button type="button" className="hd-tool" title="最小化" aria-label="最小化">
          <img src="/images/icons/nav/nav-minus.svg" alt="" className="hd-tool-img hd-tool-minus" />
        </button>
        <button type="button" className="hd-tool" title="关闭" aria-label="关闭">
          <img src="/images/icons/nav/nav-close.svg" alt="" className="hd-tool-img" />
        </button>
      </nav>
    </header>
  )
}
