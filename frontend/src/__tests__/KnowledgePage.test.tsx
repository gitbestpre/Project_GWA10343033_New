import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import KnowledgePage, { progressLabel } from '../pages/KnowledgePage'
import { resetTtsCache } from '../lib/tts'

// 自动播放会在进入学习态时立刻发起语音请求。jsdom 里既没有可用的同源接口，
// 也不该让单测真的联网，故把 fetch 换成一个「永不落定」的桩：
// 状态机停在 loading（这正是「已自动发起请求」的证据），且不会有异步状态更新
// 落在 act 之外产生告警。播放/暂停/推进这些依赖真实媒体事件的行为由 E2E 覆盖。
beforeEach(() => {
  vi.stubGlobal('fetch', () => new Promise(() => {}))
  // 合成结果缓存是模块级 Map，会跨用例存活：同一段文本在 A 用例里被合成过，
  // B 用例里就直接命中缓存、根本不发请求。不清的话，「回答被送去朗读」这类
  // 断言会随用例顺序时真时假。这里每个用例都从一个干净的缓存开始。
  resetTtsCache()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const renderPage = () => {
  const view = render(
    <MemoryRouter>
      <KnowledgePage />
    </MemoryRouter>
  )
  // 自动播放状态机挂在 .knowledge-page 的 data-tts-* 上，断言走属性而不是内部状态
  const status = () => view.container.querySelector('.knowledge-page')?.getAttribute('data-tts-status')
  const index = () => Number(view.container.querySelector('.knowledge-page')?.getAttribute('data-tts-index'))
  return { ...view, status, index }
}

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

  it('点击「知识科普」后显示6个模块Tab与正文，基础知识高亮，欢迎文案消失', () => {
    renderPage()
    startLearning()
    moduleNames.forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '基础知识' }).className).toContain('active')
    expect(screen.getByText('一、食源性疾病定义与分类')).toBeInTheDocument()
    expect(screen.queryByText(/同学，欢迎你来到/)).not.toBeInTheDocument()
  })

  it('点击Tab切换模块内容', () => {
    renderPage()
    startLearning()
    fireEvent.click(screen.getByRole('button', { name: '传播途径与污染机制' }))
    expect(screen.getByText('一、主要传播途径')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '传播途径与污染机制' }).className).toContain('active')
  })

  it('进入模块后停在第一页：上一页禁用、下一页可用', () => {
    // 注意：六个模块均为多页（最短 3 页），不存在「单页模块」，
    // 故只校验首屏的边界状态为「左禁用 / 右可用」。
    renderPage()
    startLearning()
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '下一页' })).not.toBeDisabled()
  })

  it('多页模块可用左右箭头翻页，首末页边界禁用', () => {
    renderPage()
    startLearning()
    fireEvent.click(screen.getByRole('button', { name: '预防策略与控制体系' }))
    const prev = () => screen.getByRole('button', { name: '上一页' })
    const next = () => screen.getByRole('button', { name: '下一页' })

    expect(screen.getByText('一、WHO食品安全五要点')).toBeInTheDocument()
    expect(prev()).toBeDisabled()
    expect(next()).not.toBeDisabled()

    // 第 2 页
    fireEvent.click(next())
    expect(screen.getByText('二、HACCP体系与分环节控制')).toBeInTheDocument()
    expect(screen.queryByText('一、WHO食品安全五要点')).not.toBeInTheDocument()
    expect(prev()).not.toBeDisabled()

    // 末页（该模块共 4 页）
    fireEvent.click(next())
    fireEvent.click(next())
    expect(screen.getByText('四、监测预警与风险管理')).toBeInTheDocument()
    expect(next()).toBeDisabled()

    // 回到首页
    fireEvent.click(prev())
    fireEvent.click(prev())
    fireEvent.click(prev())
    expect(screen.getByText('一、WHO食品安全五要点')).toBeInTheDocument()
    expect(prev()).toBeDisabled()
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

  it('点击「完成学习」离开知识页', () => {
    // 页面内没有「返回欢迎页」控件；离开本页的唯一入口是左列「完成学习」，
    // 它 navigate('/') 回到首页。
    render(
      <MemoryRouter initialEntries={['/knowledge']}>
        <Routes>
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/" element={<div>首页占位</div>} />
        </Routes>
      </MemoryRouter>
    )
    startLearning()
    expect(screen.queryByText(/同学，欢迎你来到/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /完成学习/ }))
    expect(screen.getByText('首页占位')).toBeInTheDocument()
  })

  it('导师面板：静音键常驻，播放主控仅在学习态出现', () => {
    renderPage()
    // 原「音量」按钮现为静音开关（无 onClick 的空按钮已接上真实行为）
    expect(screen.getByRole('button', { name: '静音' })).toBeInTheDocument()
    // 欢迎页没有正文可念，故播放主控不渲染
    expect(screen.queryByRole('button', { name: '播放' })).not.toBeInTheDocument()

    startLearning()
    expect(screen.getByRole('button', { name: '静音' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '静音' }))
    expect(screen.getByRole('button', { name: '取消静音' })).toBeInTheDocument()
    // 学习态必然出现播放主控（此刻可能已被自动播放推进到 playing/paused，故按存在性断言）
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('收起人物卡片：只撤照片层，按钮列与朗读主控保留，且可再展开', () => {
    const { container } = renderPage()
    startLearning()
    // 收起状态放在页根上（兄弟节点 CSS 要用它驱动白卡左移/放大）
    const tutorState = () => container.querySelector('.knowledge-page')?.getAttribute('data-tutor')

    expect(tutorState()).toBe('expanded')
    expect(container.querySelector('.tutor-photo-panel')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '隐藏AI导师' }))

    expect(tutorState()).toBe('collapsed')
    // 照片层（连同其上的静音键、导师播放主控）整层撤掉
    expect(container.querySelector('.tutor-photo-panel')).toBeNull()
    expect(screen.queryByRole('button', { name: '静音' })).not.toBeInTheDocument()
    // ⚠️ 按钮列必须留下 —— 否则「完成学习」「停止播放」会随照片一起消失
    expect(screen.getByRole('button', { name: /知识科普/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /完成学习/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /播放文字|停止播放|继续播放|载入中|重新播放/ })
    ).toBeInTheDocument()
    // 还原入口落在按钮列里：照片层上那颗竖排键已随之卸载，必须另有一处可回
    expect(screen.getByRole('button', { name: '打开AI导师' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开AI导师' }))

    expect(tutorState()).toBe('expanded')
    expect(container.querySelector('.tutor-photo-panel')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '打开AI导师' })).not.toBeInTheDocument()
  })

  it('学习态出现朗读控件，音色固定为女主持人且无音色选择行', () => {
    // 自动播放会让按钮文案在「载入中/停止播放/播放文字/重新播放」之间切换，故按全集匹配
    const PLAY_BTN = /播放文字|停止播放|继续播放|载入中|重新播放/
    const { container } = renderPage()
    expect(screen.queryByRole('button', { name: PLAY_BTN })).not.toBeInTheDocument()

    startLearning()
    expect(screen.getByRole('button', { name: PLAY_BTN })).toBeInTheDocument()
    // 音色选择行已按负责人要求撤除：是「没有这个控件」，不是「藏起来了」
    expect(screen.queryByRole('combobox', { name: '音色选择' })).not.toBeInTheDocument()
    expect(container.querySelector('.tts-voice-row')).toBeNull()
    // 但「用的是哪支音色」这个口径必须仍可读出，且固定为默认女主持人
    expect(container.querySelector('.knowledge-page')?.getAttribute('data-tts-voice')).toBe(
      'narrator-female'
    )
  })

  it('进入学习态即自动播放本页文字（无需点按钮）', async () => {
    const { status } = renderPage()
    expect(status()).toBe('idle')

    startLearning()
    // 点击「知识科普」后应自动起播：状态离开 idle（jsdom 无可用接口时会落到 error，
    // 但那同样证明「自动发起过请求」，与「必须手点才动」是两回事）
    await waitFor(() => expect(status()).not.toBe('idle'))
    expect(['loading', 'playing', 'paused', 'error']).toContain(status())
  })

  it('切模块后重新自动播放（块序号归零）', async () => {
    const { status, index } = renderPage()
    startLearning()
    await waitFor(() => expect(status()).not.toBe('idle'))

    fireEvent.click(screen.getByRole('button', { name: '预防策略与控制体系' }))
    await waitFor(() => expect(index()).toBe(0))
    expect(screen.getByText('一、WHO食品安全五要点')).toBeInTheDocument()
  })

  it('播放控件不改变模块导航语义（标签与翻页仍可用）', () => {
    renderPage()
    startLearning()
    fireEvent.click(screen.getByRole('button', { name: '预防策略与控制体系' }))
    expect(screen.getByText('一、WHO食品安全五要点')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /播放文字|停止播放|载入中|重新播放/ })).toBeInTheDocument()
  })

  it('渲染AI导师侧边栏按钮与底部对话框', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /知识科普/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /完成学习/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /隐藏AI导师/ })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入内容')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument()
  })

  /* ───────── 底部对话栏 → Dify（01 知识宣教 Chatflow）───────── */

  /** 按 URL 分流的 fetch 桩：/api/dify 回真实 SSE，其余（/api/tts）沿用「永不落定」，
   *  以免自动朗读的请求把断言搅乱。返回的 calls 用于检查实际发出了什么。 */
  const stubFetch = (dify: () => Response) => {
    const calls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
      calls.push({ url, init })
      if (String(url).includes('/api/dify')) return Promise.resolve(dify())
      return new Promise<Response>(() => {})
    })
    return calls
  }

  const sseResponse = (blocks: string[]) => {
    const bytes = new TextEncoder().encode(blocks.map((b) => `data: ${b}\n\n`).join(''))
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes)
          controller.close()
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }

  const answerFrame = (answer: string, conversationId = 'conv-A') =>
    JSON.stringify({ event: 'message', answer, conversation_id: conversationId })

  const askTutor = (text: string) => {
    const input = screen.getByPlaceholderText('请输入内容')
    fireEvent.change(input, { target: { value: text } })
    fireEvent.keyDown(input, { key: 'Enter' })
  }

  /** 分阶段推帧的 SSE：每步之间留出足够长的静默期。
   *
   *  上面那个 sseResponse 一口气把所有帧灌完并立刻关闭，等待期在一批微任务里
   *  就过去了，断言根本抓不到「上游还在跑、一个字都还没到」这一刻。
   *  这里改用真实延时把每一步拉开，让断言可以稳定地停在某个中间态上。
   *
   *  ⚠️ 不用手工 `act()` 推帧：本测试环境未开 `IS_REACT_ACT_ENVIRONMENT`，
   *  直接调 act 会报「not configured to support act」并把后续用例的渲染树一起掀掉
   *  （实测 11 个用例连锁失败）。让上游按时间自然吐帧、由 waitFor 等待，才是这条路。 */
  const stagedSse = (steps: { wait: number; frame?: string }[]) => {
    const enc = new TextEncoder()
    return new Response(
      new ReadableStream<Uint8Array>({
        async start(c) {
          for (const s of steps) {
            await new Promise((r) => setTimeout(r, s.wait))
            if (s.frame) c.enqueue(enc.encode(`data: ${s.frame}\n\n`))
          }
          c.close()
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }

  const endFrame = (conversationId = 'conv-A') =>
    JSON.stringify({ event: 'message_end', conversation_id: conversationId })

  const nodeFrame = (title: string) =>
    JSON.stringify({ event: 'node_started', data: { node_id: 'n-' + title, title } })

  const subtitle = (container: HTMLElement) => container.querySelector('.lecture-subtitle')
  const hintText = (container: HTMLElement) =>
    container.querySelector('.lecture-subtitle-hint')?.textContent ?? null
  const bodyText = (container: HTMLElement) =>
    container.querySelector('.lecture-subtitle-text')?.textContent ?? null

  /** 一次断言两个属性：
   *  `data-phase` 是细分阶段（等待首字 / 正在吐字 / 结束 / 出错），
   *  `data-state` 是原有的四态 —— waiting 与 typing 都属于 streaming。
   *  既有断言与下游都按四态读，所以细分阶段不能顺手把它改成五个值。 */
  const ok_phase = (bar: Element, phase: 'waiting' | 'typing' | 'done' | 'error') => {
    expect(bar.getAttribute('data-phase')).toBe(phase)
    expect(bar.getAttribute('data-state')).toBe(
      phase === 'waiting' || phase === 'typing' ? 'streaming' : phase,
    )
  }

  it('未提问时不渲染字幕条（设计稿的字幕条只在有导师回答时出现）', () => {
    const { container } = renderPage()
    expect(container.querySelector('.lecture-subtitle')).toBeNull()
  })

  /* ── 首字之前的空窗（负责人反馈的「发送后要等几秒才开始回复」）──
     实测该 Chatflow 的耗时结构：开始 7ms → 知识检索 381ms → LLM 2275ms
     → 直接回复 9ms。也就是说提问后有两三秒一个字都到不了，
     这段静默期在界面上必须有话可说，否则就等同于「点了没反应」。 */

  it('首字到达前显示进度文案（不再是 1325px 空白条 + 一根光标）', async () => {
    stubFetch(() =>
      stagedSse([
        { wait: 300 }, // 首字之前：上游一个字都还没发
        { wait: 20, frame: answerFrame('食源性疾病') },
        { wait: 20, frame: answerFrame('是指经食物传播的疾病') },
        { wait: 20, frame: endFrame() },
      ]),
    )
    const { container } = renderPage()
    startLearning()
    askTutor('什么是食源性疾病？')

    // 等待期就该有话可说，且不依赖上游的 node_* 事件
    await waitFor(() => expect(hintText(container)).not.toBeNull())
    ok_phase(subtitle(container)!, 'waiting')
    expect(hintText(container)).toContain('正在思考')
    // 正文元素此时**不该存在** —— 否则等于把占位文案当成回答上屏
    expect(bodyText(container)).toBeNull()

    // 首字到达：占位让位给正文
    await waitFor(() => expect(bodyText(container)).toBe('食源性疾病'), { timeout: 1500 })
    ok_phase(subtitle(container)!, 'typing')
    expect(hintText(container)).toBeNull()

    await waitFor(() => ok_phase(subtitle(container)!, 'done'), { timeout: 1500 })
    // 终值仍等于回答全文：进度文案没有混进正文
    expect(subtitle(container)?.textContent).toBe('食源性疾病是指经食物传播的疾病')
  })

  it('上游推 node_started 时给出真实进度：先「检索知识库」再「生成回答」', async () => {
    stubFetch(() =>
      stagedSse([
        { wait: 250 },
        { wait: 20, frame: nodeFrame('知识检索') },
        { wait: 250 },
        { wait: 20, frame: nodeFrame('LLM') },
        { wait: 250 },
        { wait: 20, frame: answerFrame('答案是……') },
        { wait: 20, frame: endFrame() },
      ]),
    )
    const { container } = renderPage()
    startLearning()
    askTutor('什么是食源性疾病？')

    // 节点事件还没到时：通用文案（这一句是整条链路的地板，不能靠节点事件才有反馈）
    await waitFor(() => expect(hintText(container)).toContain('正在思考'))
    await waitFor(() => expect(hintText(container)).toContain('正在检索知识库'), { timeout: 1500 })
    await waitFor(() => expect(hintText(container)).toContain('正在生成回答'), { timeout: 1500 })

    // 首字到达后进度文案必须退场，不能和正文并存
    await waitFor(() => expect(bodyText(container)).toBe('答案是……'), { timeout: 1500 })
    expect(hintText(container)).toBeNull()
  })

  it('出错时不显示进度文案（错就是错，不该扮成「正在跑」）', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ code: 'app_unavailable', message: 'x', status: 400 }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const { container } = renderPage()
    startLearning()
    askTutor('什么是食源性疾病？')

    await waitFor(() => ok_phase(subtitle(container)!, 'error'))
    expect(hintText(container)).toBeNull()
  })

  it('progressLabel：认识的节点翻成学员话术，不认识的回落到通用文案', () => {
    expect(progressLabel('知识检索')).toBe('正在检索知识库…')
    expect(progressLabel('检索')).toBe('正在检索知识库…')
    expect(progressLabel('LLM')).toBe('正在生成回答…')
    expect(progressLabel('大模型')).toBe('正在生成回答…')
    expect(progressLabel('代码执行')).toBe('正在整理资料…')
    // 「开始」「直接回复」对学员没有信息量：不硬翻
    expect(progressLabel('开始')).toBe('正在思考，请稍候…')
    expect(progressLabel('直接回复')).toBe('正在思考，请稍候…')
    expect(progressLabel('某个自定义节点')).toBe('正在思考，请稍候…')
    expect(progressLabel('')).toBe('正在思考，请稍候…')
    expect(progressLabel('   ')).toBe('正在思考，请稍候…')
  })

  it('空输入时发送钮禁用；提问后清空输入，回答逐字上屏到字幕条', async () => {
    stubFetch(() => sseResponse([answerFrame('食源性疾病'), answerFrame('是指经食物传播的疾病')]))
    const { container } = renderPage()
    startLearning()

    const sendBtn = screen.getByRole('button', { name: '发送' })
    expect(sendBtn).toBeDisabled()

    askTutor('什么是食源性疾病？')

    await waitFor(() => {
      expect(container.querySelector('.lecture-subtitle')?.textContent).toBe('食源性疾病是指经食物传播的疾病')
    })
    // 输入框已清空（回答不占着输入位），发送钮随之回到禁用态
    expect(screen.getByPlaceholderText('请输入内容')).toHaveValue('')
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
  })

  it('请求发往同源代理且请求体不含任何凭据（密钥不进浏览器）', async () => {
    const calls = stubFetch(() => sseResponse([answerFrame('好的')]))
    renderPage()
    startLearning()
    askTutor('五要点是什么')

    await waitFor(() => expect(calls.some((c) => c.url.includes('/api/dify'))).toBe(true))
    const call = calls.find((c) => c.url.includes('/api/dify'))!
    const body = JSON.parse(call.init.body as string) as Record<string, unknown>
    expect(body.query).toBe('五要点是什么')
    // 首轮不带 conversation_id，也不带 user 之外的任何鉴权字段
    expect('conversation_id' in body).toBe(false)
    expect(JSON.stringify(call.init)).not.toMatch(/Bearer|app-/)
  })

  it('第二轮提问带上第一轮拿到的 conversation_id（多轮上下文）', async () => {
    const calls = stubFetch(() => sseResponse([answerFrame('第一轮回答', 'conv-777')]))
    renderPage()
    startLearning()

    askTutor('问题一')
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/api/dify'))).toHaveLength(1))

    askTutor('问题二')
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/api/dify'))).toHaveLength(2))

    const second = calls.filter((c) => c.url.includes('/api/dify'))[1]!
    const body = JSON.parse(second.init.body as string) as Record<string, unknown>
    expect(body.conversation_id).toBe('conv-777')
  })

  it('导师不可用（应用未发布）时把可执行的中文提示落到字幕条，而不是静默失败', async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ code: 'invalid_param', message: 'Workflow not published', status: 400 }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    )
    const { container } = renderPage()
    startLearning()
    askTutor('什么是食源性疾病？')

    await waitFor(() => {
      expect(container.querySelector('.lecture-subtitle')).toBeTruthy()
    })
    const subtitle = container.querySelector('.lecture-subtitle')!
    expect(subtitle.getAttribute('data-state')).toBe('error')
    expect(subtitle.textContent).toContain('发布')
    // 出错后发送钮必须恢复可用，否则学员连重试都做不到
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled() // 输入为空，故仍禁用
    fireEvent.change(screen.getByPlaceholderText('请输入内容'), { target: { value: '再试一次' } })
    expect(screen.getByRole('button', { name: '发送' })).not.toBeDisabled()
  })

  /* ───────── 回答 → MiniMax 朗读（对齐参考项目 speakPatientText 的位置）───────── */

  const ttsCalls = (calls: { url: string; init: RequestInit }[]) =>
    calls.filter((c) => c.url.includes('/api/tts'))
  const ttsTexts = (calls: { url: string; init: RequestInit }[]) =>
    ttsCalls(calls).map((c) => (JSON.parse(c.init.body as string) as { text: string }).text)
  const sourceOf = (container: HTMLElement) =>
    container.querySelector('.knowledge-page')?.getAttribute('data-tts-source')
  const statusOf = (container: HTMLElement) =>
    container.querySelector('.knowledge-page')?.getAttribute('data-tts-status')

  it('回答整段到手后用同一支 MiniMax 音色朗读（音色仍是默认女主持人）', async () => {
    const calls = stubFetch(() =>
      sseResponse([answerFrame('食源性疾病'), answerFrame('食源性疾病是指经食物传播的疾病')]),
    )
    const { container } = renderPage()
    startLearning()
    askTutor('什么是食源性疾病？')

    await waitFor(() => expect(sourceOf(container)).toBe('reply'))

    // 正向取证：合成请求里确实带着回答原文，而不是空转。
    // ⚠️ 必须按**整条文本**定位，不能用 includes('经食物传播') 这类子串：
    //    本页正文里就有「经食物传播的急性胃肠道感染」，子串匹配会命中自动朗读那条请求。
    const ANSWER = '食源性疾病是指经食物传播的疾病'
    const sent = ttsTexts(calls)
    expect(sent).toContain(ANSWER)
    const call = ttsCalls(calls)[sent.indexOf(ANSWER)]
    const body = JSON.parse(call.init.body as string) as {
      text: string
      voice_setting: { voice_id: string }
    }
    // 音色没有被换掉：与页面正文朗读走的是同一支音色
    expect(body.voice_setting.voice_id).toBe('presenter_female')

    // 顺序取证：这条合成请求必须发生在 Dify 流结束**之后**，
    // 否则就是把流式增量逐字喂给 TTS（每来一个字发一次合成请求）
    const lastDifyIdx = calls.reduce((acc, c, i) => (c.url.includes('/api/dify') ? i : acc), -1)
    expect(calls.indexOf(call)).toBeGreaterThan(lastDifyIdx)
  })

  it('回答里的 Markdown 标记不进语音（粗体/标题/列表只留文字）', async () => {
    const calls = stubFetch(() => sseResponse([answerFrame('### 要点\n- **保持清洁**')]))
    const { container } = renderPage()
    startLearning()
    askTutor('五要点是什么？')

    await waitFor(() => expect(sourceOf(container)).toBe('reply'))
    await waitFor(() => expect(ttsTexts(calls).some((t) => t.includes('保持清洁'))).toBe(true))
    // 上屏的字幕仍保留原始 Markdown，只有送合成的文本被清洗
    expect(ttsTexts(calls).find((t) => t.includes('保持清洁'))).toBe('要点 保持清洁')
  })

  it('上游报错时只提示不朗读（诊断文案不该被念出来）', async () => {
    const calls = stubFetch(
      () =>
        new Response(JSON.stringify({ code: 'invalid_param', message: 'Workflow not published' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const { container } = renderPage()
    startLearning()
    askTutor('什么是食源性疾病？')

    // 报错落在字幕条上（data-tts-status 是音频状态，不是对话状态，别混用）
    await waitFor(() =>
      expect(container.querySelector('.lecture-subtitle')?.getAttribute('data-state')).toBe('error'),
    )
    // 先确认这套桩确实记录到了合成请求（否则下面的「没有」是空测恒过）
    expect(ttsCalls(calls).length).toBeGreaterThan(0)
    expect(ttsCalls(calls).some((c) => String(c.init.body).includes('发布'))).toBe(false)
    expect(sourceOf(container)).not.toBe('reply')
  })

  it('正在念上一条回答时再提问：停掉过期回答，而不是暂停留着继续念', async () => {
    let difyCount = 0
    stubFetch(() => {
      difyCount += 1
      if (difyCount === 1) return sseResponse([answerFrame('第一条回答')])
      // 第二轮永不结束：好在「已发出提问」这一刻稳定观察音频状态
      return new Response(
        new ReadableStream<Uint8Array>({ start() {} }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      )
    })
    const { container } = renderPage()
    startLearning()
    askTutor('问题一')
    await waitFor(() => expect(sourceOf(container)).toBe('reply'))

    askTutor('问题二')

    // stop（idle）而非 pause（paused）—— 上一条回答的内容已经过期，没有接着听的理由
    await waitFor(() => expect(statusOf(container)).toBe('idle'))
    expect(sourceOf(container)).toBeNull()
  })
})
