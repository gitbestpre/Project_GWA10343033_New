import type { CSSProperties, ReactNode } from 'react'
import { useStageScale } from '../../hooks/useStageScale'
import './StageLayout.css'

/**
 * 全站统一的固定舞台布局容器。
 *
 * 结构：stage-viewport（铺满浏览器窗口、黑底、裁切）
 *        └─ stage-canvas（恒定 1920x1080 设计稿，按窗口等比缩放并居中）
 *             └─ children（各页面内容，内部坐标始终以 1920x1080 为准）
 *
 * 约定：任何新增页面都应包一层 <StageLayout>，内部直接按 1920x1080 设计，
 * 不要再写 100vh / 视口媒体查询，也不要自行做缩放。
 *
 * @param scroll     内容超过 1080 高时是否允许舞台内部纵向滚动（流式页面用）
 * @param background 舞台背景（图片页可传 '#000'，浏览页可传渐变）
 */
export default function StageLayout({
  children,
  scroll = false,
  background,
}: {
  children: ReactNode
  scroll?: boolean
  background?: string
}) {
  const scale = useStageScale(1920, 1080)

  const canvasStyle: CSSProperties = {
    transform: `translate(-50%, -50%) scale(${scale})`,
  }
  if (background) canvasStyle.background = background

  return (
    <div className="stage-viewport">
      <div
        className={`stage-canvas${scroll ? ' is-scrollable' : ''}`}
        style={canvasStyle}
      >
        {children}
      </div>
    </div>
  )
}
