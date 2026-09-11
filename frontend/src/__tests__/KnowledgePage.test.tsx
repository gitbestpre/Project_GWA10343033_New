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

const startLearning = () => fireEvent.click(screen.getByRole('button', { name: /知识科普/ }))

describe('KnowledgePage', () => {
  it('初始显示欢迎页（无模块Tab、无翻页箭头）', () => {
    renderPage()
    expect(screen.getByText(/同学，欢迎你来到/)).toBeInTheDocument()
    expect(screen.getByText(/请点击左侧模块选择需要学习了解的知识点/)).toBeInTheDocument()
    expect(screen.getByText(/自由切换小模块进行知识点学习/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '传播途径与污染机制' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '下一页' })).not.toBeInTheDocument()
  })

  it('点击「知识科普」后显示6个模块Tab与模块标题，基础知识高亮，欢迎文案消失', () => {
    renderPage()
    startLearning()
    moduleNames.forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '基础知识' }).className).toContain('active')
    expect(screen.getByText('基础知识', { selector: '.module-title-text' })).toBeInTheDocument()
    expect(screen.queryByText(/同学，欢迎你来到/)).not.toBeInTheDocument()
  })

  it('点击Tab切换模块内容', () => {
    renderPage()
    startLearning()
    fireEvent.click(screen.getByRole('button', { name: '传播途径与污染机制' }))
    expect(screen.getByText('（一）主要传播途径')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '传播途径与污染机制' }).className).toContain('active')
  })

  it('单页模块的左右翻页箭头禁用', () => {
    renderPage()
    startLearning()
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled()
  })

  it('多页模块可用左右箭头翻页，边界禁用', () => {
    renderPage()
    startLearning()
    fireEvent.click(screen.getByRole('button', { name: '预防策略与控制体系' }))
    const prevArrow = screen.getByRole('button', { name: '上一页' })
    const nextArrow = screen.getByRole('button', { name: '下一页' })
    expect(screen.getByText('一、WHO食品安全五要点')).toBeInTheDocument()
    expect(prevArrow).toBeDisabled()
    expect(nextArrow).not.toBeDisabled()
    fireEvent.click(nextArrow)
    expect(screen.getByText('二、HACCP体系与分环节控制')).toBeInTheDocument()
    expect(screen.queryByText('一、WHO食品安全五要点')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '上一页' }))
    expect(screen.getByText('一、WHO食品安全五要点')).toBeInTheDocument()
  })

  it('切换模块后页码重置为第一页', () => {
    renderPage()
    startLearning()
    fireEvent.click(screen.getByRole('button', { name: '预防策略与控制体系' }))
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getByText('二、HACCP体系与分环节控制')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '预防策略与控制体系' }))
    expect(screen.getByText('一、WHO食品安全五要点')).toBeInTheDocument()
  })

  it('点击标题旁返回箭头回到欢迎页', () => {
    renderPage()
    startLearning()
    expect(screen.queryByText(/同学，欢迎你来到/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回欢迎页' }))
    expect(screen.getByText(/同学，欢迎你来到/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '下一页' })).not.toBeInTheDocument()
  })

  it('暂停按钮仅在学习态显示，音量按钮始终显示', () => {
    renderPage()
    expect(screen.getByRole('button', { name: '音量' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '暂停' })).not.toBeInTheDocument()
    startLearning()
    expect(screen.getByRole('button', { name: '音量' })).toBeInTheDocument()
    const pauseBtn = screen.getByRole('button', { name: '暂停' })
    fireEvent.click(pauseBtn)
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument()
  })

  it('渲染AI导师侧边栏按钮与底部对话框', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /知识科普/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /完成学习/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /隐藏AI导师/ })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入内容')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument()
  })
})
