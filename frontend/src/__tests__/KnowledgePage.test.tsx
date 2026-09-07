import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import KnowledgePage from '../pages/KnowledgePage'

describe('KnowledgePage', () => {
  it('should render 6 knowledge module tabs', () => {
    render(
      <MemoryRouter>
        <KnowledgePage />
      </MemoryRouter>
    )
    // Check that all 6 module names appear (as tab buttons)
    const tabButtons = screen.getAllByRole('button')
    const tabTexts = tabButtons.map((btn) => btn.textContent)
    expect(tabTexts).toContain('基础知识')
    expect(tabTexts).toContain('传播途径与污染机制')
    expect(tabTexts).toContain('临床表现与诊断鉴别')
    expect(tabTexts).toContain('预防策略与控制体系')
    expect(tabTexts).toContain('应急响应与流行病学调查')
    expect(tabTexts).toContain('实验室检测与分子溯源')
  })

  it('should render AI tutor sidebar', () => {
    render(
      <MemoryRouter>
        <KnowledgePage />
      </MemoryRouter>
    )
    expect(screen.getByText('知识科普')).toBeInTheDocument()
    expect(screen.getByText('完成学习')).toBeInTheDocument()
    expect(screen.getByText('隐藏AI导师')).toBeInTheDocument()
  })

  it('should render AI dialog at bottom', () => {
    render(
      <MemoryRouter>
        <KnowledgePage />
      </MemoryRouter>
    )
    expect(screen.getByPlaceholderText('请输入内容')).toBeInTheDocument()
  })

  it('should highlight the first tab by default', () => {
    render(
      <MemoryRouter>
        <KnowledgePage />
      </MemoryRouter>
    )
    // The first tab button should have the 'active' class
    const tabButtons = screen.getAllByRole('button')
    const firstTab = tabButtons.find((btn) => btn.textContent === '基础知识')
    expect(firstTab).toBeInTheDocument()
    expect(firstTab?.className).toContain('active')
  })
})
