import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '../pages/HomePage'

describe('HomePage', () => {
  it('should render the page title', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )
    expect(screen.getByText('请按照模块依次操作')).toBeInTheDocument()
  })

  it('should render 2 cards: 知识宣教 and 案例学习', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )
    expect(screen.getByText('知识宣教')).toBeInTheDocument()
    expect(screen.getByText('案例学习')).toBeInTheDocument()
  })

  it('should render the Header component with logo', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )
    expect(screen.getByText('AI食品致病性微生物污染事件应急与处置')).toBeInTheDocument()
  })

  it('should render status indicators on cards', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )
    // Cards should have status indicators
    const statusElements = screen.getAllByText('未学习')
    expect(statusElements.length).toBe(2)
  })
})
