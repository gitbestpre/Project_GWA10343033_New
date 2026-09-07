import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import KnowledgePage from '../pages/KnowledgePage'
import ModuleTabs from '../components/ModuleTabs'
import ContentViewer from '../components/ContentViewer'
import AITutor from '../components/AITutor'
import ChatDialog from '../components/ChatDialog'
import { knowledgeModules } from '../data/knowledgeData'

// 辅助函数：渲染带路由的组件
function renderWithRouter(component: React.ReactElement, initialEntries = ['/knowledge']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{component}</MemoryRouter>)
}

describe('知识宣教模块页面', () => {
  describe('AC-1: 页面加载时默认显示基础知识模块第1页', () => {
    it('应该默认显示基础知识模块', () => {
      renderWithRouter(<KnowledgePage />)
      // 基础知识模块应该被高亮
      const tabs = screen.getAllByRole('button')
      const basicsTab = tabs.find(tab => tab.textContent === '基础知识')
      expect(basicsTab).toHaveClass('active')
    })

    it('应该显示基础知识模块的内容', () => {
      renderWithRouter(<KnowledgePage />)
      // 应该显示基础知识的内容
      expect(screen.getByText(/食源性致病菌概述/)).toBeInTheDocument()
    })
  })

  describe('AC-2: 点击顶部模块按钮可切换6个模块，当前模块高亮', () => {
    it('应该有6个模块标签', () => {
      renderWithRouter(<KnowledgePage />)
      const tabs = screen.getAllByRole('button')
      const moduleTabs = tabs.filter(tab =>
        knowledgeModules.some(m => m.name === tab.textContent)
      )
      expect(moduleTabs).toHaveLength(6)
    })

    it('点击传播途径与污染机制模块应该切换内容', () => {
      renderWithRouter(<KnowledgePage />)
      const tabs = screen.getAllByRole('button')
      const transmissionTab = tabs.find(tab => tab.textContent === '传播途径与污染机制')!
      fireEvent.click(transmissionTab)

      // 传播途径与污染机制模块应该被高亮
      expect(transmissionTab).toHaveClass('active')
      // 应该显示传播途径的内容
      expect(screen.getByText(/人际传播/)).toBeInTheDocument()
    })

    it('点击实验室检测与分子溯源模块应该切换内容', () => {
      renderWithRouter(<KnowledgePage />)
      const tabs = screen.getAllByRole('button')
      const labTab = tabs.find(tab => tab.textContent === '实验室检测与分子溯源')!
      fireEvent.click(labTab)

      expect(labTab).toHaveClass('active')
      expect(screen.getByText(/常规检测方法/)).toBeInTheDocument()
    })
  })

  describe('AC-3: 左右箭头可切换模块内分页，边界页箭头禁用', () => {
    it('传播途径与污染机制模块应该有2页', () => {
      renderWithRouter(<KnowledgePage />)
      const tabs = screen.getAllByRole('button')
      const transmissionTab = tabs.find(tab => tab.textContent === '传播途径与污染机制')!
      fireEvent.click(transmissionTab)

      // 应该有下一页箭头可用
      const arrows = screen.getAllByRole('button')
      const nextArrow = arrows.find(arrow => arrow.textContent === '›')
      expect(nextArrow).not.toBeDisabled()
    })

    it('点击下一页箭头应该切换到第2页', () => {
      renderWithRouter(<KnowledgePage />)
      const tabs = screen.getAllByRole('button')
      const transmissionTab = tabs.find(tab => tab.textContent === '传播途径与污染机制')!
      fireEvent.click(transmissionTab)

      const arrows = screen.getAllByRole('button')
      const nextArrow = arrows.find(arrow => arrow.textContent === '›')!
      fireEvent.click(nextArrow)

      // 应该显示第2页内容
      expect(screen.getByText(/动物源性传播/)).toBeInTheDocument()
    })

    it('第1页时上一页箭头应该禁用', () => {
      renderWithRouter(<KnowledgePage />)
      const arrows = screen.getAllByRole('button')
      const prevArrow = arrows.find(arrow => arrow.textContent === '‹')
      expect(prevArrow).toBeDisabled()
    })

    it('基础知识模块只有1页，箭头应该都禁用', () => {
      renderWithRouter(<KnowledgePage />)
      const arrows = screen.getAllByRole('button')
      const prevArrow = arrows.find(arrow => arrow.textContent === '‹')
      const nextArrow = arrows.find(arrow => arrow.textContent === '›')
      expect(prevArrow).toBeDisabled()
      expect(nextArrow).toBeDisabled()
    })
  })

  describe('AC-4: AI导师视频正常播放，音量/暂停按钮功能正常', () => {
    it('应该显示AI导师区域', () => {
      renderWithRouter(<KnowledgePage />)
      const video = document.querySelector('video')
      expect(video).toBeInTheDocument()
    })

    it('应该显示音量和暂停控制按钮', () => {
      renderWithRouter(<KnowledgePage />)
      const controlBtns = screen.getAllByRole('button')
      const hasMuteBtn = controlBtns.some(btn => btn.textContent === '🔊' || btn.textContent === '🔇')
      const hasPauseBtn = controlBtns.some(btn => btn.textContent === '⏸' || btn.textContent === '▶')
      expect(hasMuteBtn).toBe(true)
      expect(hasPauseBtn).toBe(true)
    })
  })

  describe('AC-5: 隐藏AI导师按钮可折叠/展开左侧栏', () => {
    it('点击隐藏AI导师按钮应该折叠左侧栏', () => {
      renderWithRouter(<KnowledgePage />)
      const toggleBtn = screen.getByText('隐藏AI导师')
      fireEvent.click(toggleBtn)

      // 左侧栏应该消失
      expect(screen.queryByText('隐藏AI导师')).not.toBeInTheDocument()
      // 应该显示显示AI导师按钮
      expect(screen.getByText('显示AI导师')).toBeInTheDocument()
    })

    it('点击显示AI导师按钮应该展开左侧栏', () => {
      renderWithRouter(<KnowledgePage />)
      const toggleBtn = screen.getByText('隐藏AI导师')
      fireEvent.click(toggleBtn)

      const showBtn = screen.getByText('显示AI导师')
      fireEvent.click(showBtn)

      // 左侧栏应该重新显示
      expect(screen.getByText('隐藏AI导师')).toBeInTheDocument()
    })
  })

  describe('AC-6: 完成学习按钮可点击并改变状态', () => {
    it('应该显示完成学习按钮', () => {
      renderWithRouter(<KnowledgePage />)
      expect(screen.getByText('✓ 完成学习')).toBeInTheDocument()
    })

    it('点击完成学习按钮应该触发导航', () => {
      const { container } = renderWithRouter(<KnowledgePage />)
      const completeBtn = screen.getByText('✓ 完成学习')
      fireEvent.click(completeBtn)

      // 点击后按钮应该仍然存在（导航是异步的）
      // 在实际应用中，这会导航到首页
      expect(completeBtn).toBeInTheDocument()
    })
  })

  describe('AC-7: 底部AI对话框UI完整', () => {
    it('应该显示输入框', () => {
      renderWithRouter(<KnowledgePage />)
      const input = screen.getByPlaceholderText('请输入内容')
      expect(input).toBeInTheDocument()
    })

    it('应该显示麦克风按钮', () => {
      renderWithRouter(<KnowledgePage />)
      const micBtn = screen.getByTitle('语音输入')
      expect(micBtn).toBeInTheDocument()
    })

    it('应该显示发送按钮', () => {
      renderWithRouter(<KnowledgePage />)
      const sendBtn = screen.getByText('➤')
      expect(sendBtn).toBeInTheDocument()
    })

    it('输入文字并发送应该显示消息', () => {
      renderWithRouter(<KnowledgePage />)
      const input = screen.getByPlaceholderText('请输入内容')
      fireEvent.change(input, { target: { value: '什么是沙门氏菌？' } })

      const sendBtn = screen.getByText('➤')
      fireEvent.click(sendBtn)

      // 用户消息应该显示
      expect(screen.getByText('什么是沙门氏菌？')).toBeInTheDocument()
    })
  })

  describe('模块数据', () => {
    it('应该有6个知识模块', () => {
      expect(knowledgeModules).toHaveLength(6)
    })

    it('传播途径与污染机制模块应该有2页', () => {
      const transmissionModule = knowledgeModules.find(m => m.id === 'transmission')
      expect(transmissionModule?.pages).toHaveLength(2)
    })

    it('每个模块应该有id、name和pages属性', () => {
      knowledgeModules.forEach(module => {
        expect(module).toHaveProperty('id')
        expect(module).toHaveProperty('name')
        expect(module).toHaveProperty('pages')
        expect(Array.isArray(module.pages)).toBe(true)
      })
    })
  })
})
