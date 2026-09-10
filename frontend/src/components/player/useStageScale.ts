import { useEffect, useState } from 'react'

/**
 * 让固定尺寸的 1920x1080 仿真舞台按窗口等比缩放并居中，
 * 保证任何分辨率下都与 Figma 1:1，多余区域补黑边。
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
