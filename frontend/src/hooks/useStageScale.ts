import { useEffect, useState } from 'react'

/**
 * 让固定尺寸的 1920x1080 仿真舞台按浏览器窗口等比缩放并居中，
 * 任何分辨率下舞台内部都与 Figma 1:1，多余区域补黑边（letterbox）。
 *
 * @param designWidth  设计稿宽，默认 1920
 * @param designHeight 设计稿高，默认 1080
 * @returns 应施加在舞台最外层的 scale 值
 */
export function useStageScale(designWidth = 1920, designHeight = 1080) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const compute = () => {
      const s = Math.min(
        window.innerWidth / designWidth,
        window.innerHeight / designHeight,
      )
      setScale(s)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [designWidth, designHeight])

  return scale
}
