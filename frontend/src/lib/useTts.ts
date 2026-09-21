import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { TtsController, type TtsSegment, type TtsSnapshot, type TtsVoice } from './tts'

export type TtsApi = {
  snap: TtsSnapshot
  /** 载入中 / 播放中 / 已暂停 都算「占用中」，UI 据此切换按钮语义 */
  active: boolean
  play: (segments: readonly TtsSegment[], voice?: TtsVoice) => void
  pause: () => void
  resume: () => void
  stop: () => void
  toggleMute: () => void
}

/**
 * 把 TtsController 接到 React 上。
 *
 * 两点值得写下来：
 * 1. 播放状态**不复制进 useState**，而是 useSyncExternalStore 直接订阅控制器快照 ——
 *    否则「同一件事两个源」，暂停/自动推进时必然打架。
 * 2. 暴露出去的每个方法都经 useCallback 固定引用。调用方要在 useEffect 里写
 *    `[..., stop]` 这类依赖；若每次渲染都换新函数，会导致 effect 反复执行，
 *    而 effect 里恰好是 stop() —— 播放刚起来就被自己掐断。
 */
export function useTts(): TtsApi {
  const ctrl = useMemo(() => new TtsController(), [])
  const snap = useSyncExternalStore(ctrl.subscribe, ctrl.getSnapshot, ctrl.getSnapshot)

  useEffect(() => () => ctrl.stop(), [ctrl])

  const play = useCallback(
    (segments: readonly TtsSegment[], voice?: TtsVoice) => {
      void ctrl.play(segments, voice)
    },
    [ctrl],
  )
  const pause = useCallback(() => ctrl.pause(), [ctrl])
  const resume = useCallback(() => ctrl.resume(), [ctrl])
  const stop = useCallback(() => ctrl.stop(), [ctrl])
  const toggleMute = useCallback(() => ctrl.toggleMute(), [ctrl])

  const active = snap.status === 'loading' || snap.status === 'playing' || snap.status === 'paused'

  return useMemo<TtsApi>(
    () => ({ snap, active, play, pause, resume, stop, toggleMute }),
    [snap, active, play, pause, resume, stop, toggleMute],
  )
}
