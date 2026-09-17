import { useRef, useState } from 'react'

/**
 * 食品卫生学调查 —— 从业人员（患者）生物样本采样场景（对齐 Figma
 * 308:563 / 324:906 / 324:989）。
 *
 * 从业人员采样对话结束后进入：房间背景（Figma 308:457 image526）+ 右侧 260×760「道具栏」
 * （与后厨采样同款 9 件工具，仅本阶段 3 件有效）+ 底部深色提示胶囊；学员依次点击：
 *   1) 无菌棉签 → 患者采样1.mp4（肛拭子 / 粪便样本采集，末帧无按钮：停帧等采集针）
 *   2) 采集针   → 患者采样2.mp4（血液样本采集，末帧无按钮：停帧等试管）
 *   3) 试管     → 患者采样3.mp4（尿液 / 血液样本接入试管，末帧为「相关信息·血液标本采样完成」
 *                  弹窗，自带蓝色「确定」按钮，放透明热区承接点击）。
 *
 * 交互模型与后厨采样（SamplingToolsScene）一致：
 *  - 点中当前步骤道具才全屏播放该段视频，播完统一【停在最后一帧、不卸载、不循环】；
 *  - end='hold'：末帧无按钮，提示条切换为“下一步道具”，在右侧道具栏点下一件即就地续播；
 *  - end='button'（仅患者采样3）：在视频烘焙的蓝色「确定」同位置放透明热区，
 *    点击后本场景完成，通知父层播放 16.mp4（只触发一次）。
 */

/** 9 件采样工具（与后厨采样道具栏完全一致，行优先顺序）+ 实物切图 */
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

type EndKind = 'hold' | 'button'

interface PatientStep {
  /** 本段视频路径（患者采样1 … 患者采样3） */
  video: string
  /** 等待点击的道具 */
  tool: ToolName
  /** 等待 / 停帧等待下一件时的提示条文案 */
  hint: string
  /** 末帧结束方式：hold=无按钮等下一件道具；button=自带「确定」热区（仅患者采样3） */
  end: EndKind
  /** end='button' 时承接视频自带按钮的透明热区（1920×1080 全帧坐标） */
  endAt?: { left: number; top: number; width: number; height: number }
  /** 热区无障碍名（默认「确定」） */
  endLabel?: string
}

/**
 * 3 段患者（从业人员）生物样本采样线性链路。
 * 患者采样3 末帧「相关信息」弹窗的蓝色「确定」：实测全帧中心约 (961,716)，
 * 实心按钮约 142×36，取宽容热区 168×62 覆盖圆角描边。
 */
const PATIENT_STEPS: PatientStep[] = [
  {
    video: '/Video/患者采样/患者采样1.mp4',
    tool: '无菌棉签',
    hint: '提示：请点击无菌棉签。',
    end: 'hold',
  },
  {
    video: '/Video/患者采样/患者采样2.mp4',
    tool: '采集针',
    hint: '提示：请点击采集针。',
    end: 'hold',
  },
  {
    video: '/Video/患者采样/患者采样3.mp4',
    tool: '试管',
    hint: '提示：请点击试管。',
    end: 'button',
    endAt: { left: 878, top: 684, width: 168, height: 62 },
    endLabel: '确定',
  },
]

/** 道具场景统一房间背景（Figma 308:457 image526，已裁掉游戏自带 UI） */
const SCENE_BG = '/images/food-hygiene/patient-sampling-bg.jpg'

export default function PatientSamplingScene({ onComplete }: { onComplete?: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoEnded, setVideoEnded] = useState(false)

  const completedRef = useRef(false)
  const completeCbRef = useRef(onComplete)
  completeCbRef.current = onComplete

  const step: PatientStep | undefined = PATIENT_STEPS[stepIndex]
  const next: PatientStep | undefined = PATIENT_STEPS[stepIndex + 1]
  const finished = stepIndex >= PATIENT_STEPS.length

  // 末帧无按钮、等待下一件道具
  const isHeld = !!videoSrc && videoEnded && !!step && step.end === 'hold'
  // 末帧自带「确定」按钮（仅患者采样3）：停帧后渲染透明热区
  const showConfirmHotspot =
    !!videoSrc && videoEnded && !!step && step.end === 'button' && !!step.endAt

  // 提示文案：完成 / button 末帧引导点确定 / hold 停帧提示下一件道具 / 当前步骤 hint
  let hintText: string
  if (finished) {
    hintText = '提示：从业人员生物样本采样已完成。'
  } else if (showConfirmHotspot) {
    hintText = '提示：请点击确定。'
  } else if (isHeld && next) {
    hintText = next.hint
  } else {
    hintText = step ? step.hint : ''
  }

  const playStep = (idx: number) => {
    const s = PATIENT_STEPS[idx]
    if (!s) return
    setStepIndex(idx)
    setVideoEnded(false)
    setVideoSrc(s.video)
  }

  /** 患者采样3 末帧点「确定」：本场景完成 → 父层播放 16.mp4（只触发一次） */
  const handleConfirm = () => {
    if (completedRef.current) return
    completedRef.current = true
    completeCbRef.current?.()
  }

  const handleToolClick = (name: ToolName) => {
    if (finished) return
    // 视频播放中：道具不响应
    if (videoSrc && !videoEnded) return

    if (videoSrc && videoEnded) {
      // 停帧态：仅 hold 末帧允许点“下一步道具”就地续播
      if (!step || step.end !== 'hold' || !next || name !== next.tool) return
      playStep(stepIndex + 1)
      return
    }

    // 等待态（静态房间背景）：仅当前步骤道具匹配才播放
    if (!step || name !== step.tool) return
    playStep(stepIndex)
  }

  return (
    <div className="st-layer">
      <img className="st-bg" src={SCENE_BG} alt="从业人员采样场景" />

      {/* 右侧道具栏（与后厨采样同款 260×760，9 件工具） */}
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

      {/* 底部引导提示胶囊（常显，视频播放/末帧时悬浮于视频之上） */}
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

      {/* 全屏患者采样视频：点中道具后播放，播完统一停最后一帧（不卸载、不循环）。
          hold 末帧由右侧道具栏点下一件道具续播；患者采样3 button 末帧点透明「确定」热区。 */}
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

      {/* 患者采样3 末帧「相关信息」弹窗蓝色「确定」的透明承接热区（视觉用视频内烘焙按钮） */}
      {showConfirmHotspot && step.endAt && (
        <button
          type="button"
          className="st-continue st-continue-hot"
          style={{
            left: step.endAt.left,
            top: step.endAt.top,
            width: step.endAt.width,
            height: step.endAt.height,
          }}
          aria-label={step.endLabel || '确定'}
          onClick={handleConfirm}
        />
      )}
    </div>
  )
}
