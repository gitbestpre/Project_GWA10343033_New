import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CaseStudyPage from '../pages/CaseStudyPage'

describe('CaseStudyPage', () => {
  it('should render the page title', () => {
    render(
      <MemoryRouter>
        <CaseStudyPage />
      </MemoryRouter>
    )
    expect(screen.getByText('请按照模块依次操作')).toBeInTheDocument()
  })

  it('should render 4 module cards', () => {
    render(
      <MemoryRouter>
        <CaseStudyPage />
      </MemoryRouter>
    )
    expect(screen.getByText('流行病学调查')).toBeInTheDocument()
    expect(screen.getByText('食品卫生学调查')).toBeInTheDocument()
    expect(screen.getByText('实验室检测')).toBeInTheDocument()
    expect(screen.getByText('资料分析及调查结论')).toBeInTheDocument()
  })

  it('should render status indicators on all cards', () => {
    render(
      <MemoryRouter>
        <CaseStudyPage />
      </MemoryRouter>
    )
    const statusElements = screen.getAllByText('未学习')
    expect(statusElements.length).toBe(4)
  })
})
