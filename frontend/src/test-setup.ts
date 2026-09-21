import '@testing-library/jest-dom'

/**
 * jsdom 没有 ResizeObserver，而 `QuizModal` 用它在题干折行时做尺寸测量 ——
 * 不补这个桩，任何渲染题卡的用例都会在 layout effect 里抛 ReferenceError。
 * 这里给一个最小实现（只把 observe/unobserve/disconnect 变成空操作），
 * 折行测量本身依赖 offsetHeight，jsdom 下一律为 0（即「按单行处理」），
 * 对本项目的断言没有影响。
 */
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
}
