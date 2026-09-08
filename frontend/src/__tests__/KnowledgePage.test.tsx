import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import KnowledgePage from '../pages/KnowledgePage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <KnowledgePage />
    </MemoryRouter>
  )

const moduleNames = [
  '基础知识',
  '传播途径与污染机制',
  '临床表现与诊断鉴别',
  '预防策略与控制体系',
  '应急响应与流行病学调查',
  '实验室检测与分子溯源',
]

describe('KnowledgePage', () => {
  it('初始显示欢迎页（无模块Tab、无导航箭头）', () => {
    renderPage()
    expect(screen.getByText(/同学，欢迎你来到/)).toBeInTheDocument()
    expect(screen.getByText(/请点击左侧模块选择需要学习了解的知识点/)).toBeInTheDocument()
    expect(screen.getByText(/自由切换小模块进行知识点学习/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '传播途径与污染机制' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '下一个模块' })).not.toBeInTheDocument()
  })

  it('点击「知识科普」后显示6个模块Tab，基础知识高亮，欢迎文案消失', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /知识科普/ }))
    moduleNames.forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '基础知识' }).className).toContain('active')
    expect(screen.queryByText(/同学，欢迎你来到/)).not.toBeInTheDocument()
  })

  it('点击Tab切换模块内容', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /知识科普/ }))
    fireEvent.click(screen.getByRole('button', { name: '传播途径与污染机制' }))
    expect(screen.getByText('（一）主要传播途径')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '传播途径与污染机制' }).className).toContain('active')
  })

  it('左右箭头切换模块，首尾模块对应箭头禁用', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /知识科普/ }))
    const leftArrow = screen.getByRole('button', { name: '上一个模块' })
    const rightArrow = screen.getByRole('button', { name: '下一个模块' })
    expect(leftArrow).toBeDisabled()
    expect(rightArrow).not.toBeDisabled()
    fireEvent.click(rightArrow)
    expect(screen.getByText('（一）主要传播途径')).toBeInTheDocument()
    fireEvent.click(leftArrow)
    expect(screen.getByText('（一）食源性疾病')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '实验室检测与分子溯源' }))
    expect(screen.getByRole('button', { name: '下一个模块' })).toBeDisabled()
  })

  it('渲染AI导师侧边栏按钮与底部对话框', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /知识科普/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /完成学习/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /隐藏AI导师/ })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入内容')).toBeInTheDocument()
  })
})
