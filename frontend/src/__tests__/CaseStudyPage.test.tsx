import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CaseStudyPage from '../pages/CaseStudyPage'
import { markDone, markStudying } from '../lib/moduleProgress'

/**
 * 模块学习状态由 lib/moduleProgress（localStorage）驱动，
 * 故每个用例前必须清空存储，否则用例之间会互相污染。
 */
beforeEach(() => {
  window.localStorage.clear()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <CaseStudyPage />
    </MemoryRouter>
  )
}

describe('CaseStudyPage', () => {
  it('should render the page title', () => {
    renderPage()
    expect(screen.getByText('请按照模块依次操作')).toBeInTheDocument()
  })

  it('should render 4 module cards', () => {
    renderPage()
    expect(screen.getByText('现场流行病学调查')).toBeInTheDocument()
    expect(screen.getByText('食品卫生学调查')).toBeInTheDocument()
    expect(screen.getByText('实验室检测')).toBeInTheDocument()
    expect(screen.getByText('资料分析及调查结论')).toBeInTheDocument()
  })

  it('should render status indicators on all cards', () => {
    renderPage()
    const statusElements = screen.getAllByText('未学习')
    expect(statusElements.length).toBe(4)
  })

  it('shows 学习中 for a module that was entered but not finished', () => {
    markStudying('lab-testing', 'op12')
    renderPage()
    expect(screen.getByText('学习中')).toBeInTheDocument()
    // 其余三个仍是未学习
    expect(screen.getAllByText('未学习').length).toBe(3)
  })

  it('shows 已学习 only for modules walked through to the end', () => {
    markStudying('analysis', 'table')
    markDone('analysis')
    renderPage()
    expect(screen.getByText('已学习')).toBeInTheDocument()
    expect(screen.getAllByText('未学习').length).toBe(3)
  })

  it('opens the resume prompt when the module has a checkpoint', () => {
    markStudying('food-hygiene', 'ppeDressing')
    renderPage()
    // 点击有断点的卡片 → 弹「学习提示」而不是直接进入。
    // ⚠ 必须用 fireEvent.click（内部包了 act，React 更新会在断言前刷入 DOM）；
    //   裸 el.click() 只把更新排进微任务，紧随其后的同步断言会读不到新节点。
    fireEvent.click(screen.getByText('食品卫生学调查'))
    expect(screen.getByText('学习提示')).toBeInTheDocument()
    expect(screen.getByText('继续学习')).toBeInTheDocument()
    expect(screen.getByText('重新学习')).toBeInTheDocument()
  })

  it('does not open the resume prompt for untouched modules', () => {
    renderPage()
    fireEvent.click(screen.getByText('实验室检测'))
    expect(screen.queryByText('学习提示')).not.toBeInTheDocument()
  })
})
