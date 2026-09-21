import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DIFY_ENDPOINT,
  DIFY_STAGES,
  DIFY_STAGE_LABELS,
  difyUrl,
  difyUser,
  extractAnswerFromJson,
  mergeAnswer,
  parseSseFrame,
  pickTextFromOutputs,
  streamChat,
} from '../lib/dify'

/** 把若干 SSE 事件块拼成一个可读流；用来模拟 Dify 的分块吐字 */
const sseResponse = (blocks: string[], opts: { chunkSize?: number } = {}) => {
  const payload = blocks.map((b) => `data: ${b}\n\n`).join('')
  const bytes = new TextEncoder().encode(payload)
  const size = opts.chunkSize ?? 4096
  let at = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= bytes.length) {
        controller.close()
        return
      }
      controller.enqueue(bytes.slice(at, at + size))
      at += size
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })

const msg = (answer: string, conversationId = 'conv-1') =>
  JSON.stringify({ event: 'message', answer, conversation_id: conversationId })

/** 一个合规的 GUID（UUID v4）。显式传 user 的用例用它，
 *  避免用 `stu-1` 这种旧格式把「user 已是 GUID」这个口径在测试里带偏。 */
const USER_GUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

/** 与 dify.ts 的 GUID_RE 同一口径；测试里独立写一份，
 *  免得实现与断言共用同一个表达式而一起写错 */
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

beforeEach(() => {
  // 每个用例都用内存态 user，避免用例之间通过 localStorage 互相污染
  vi.stubGlobal('localStorage', undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mergeAnswer', () => {
  it('增量口径：逐段拼接', () => {
    expect(mergeAnswer('你好', '世界')).toBe('你好世界')
  })

  it('累计口径：以已有全文开头的片段视为累计，直接替换而不重复', () => {
    expect(mergeAnswer('你好', '你好世界')).toBe('你好世界')
  })

  it('空片断不改变已有内容（ping / 无 answer 的事件不该把回答清空）', () => {
    expect(mergeAnswer('你好', '')).toBe('你好')
  })

  it('空白开头时不误判为累计', () => {
    expect(mergeAnswer('', '你好')).toBe('你好')
  })
})

describe('parseSseFrame', () => {
  it('取 data: 行并解析 JSON', () => {
    expect(parseSseFrame('data: {"event":"message","answer":"你"}')).toEqual({ event: 'message', answer: '你' })
  })

  it('忽略 event: / id: 等非 data 行（以 JSON 内的 event 为准）', () => {
    expect(parseSseFrame('event: message\ndata: {"event":"message","answer":"你"}')).toEqual({
      event: 'message',
      answer: '你',
    })
  })

  it('无 data 行或 JSON 非法时返回 null，而不是抛错', () => {
    expect(parseSseFrame(': keep-alive')).toBeNull()
    expect(parseSseFrame('data: {不是 JSON')).toBeNull()
  })
})

describe('streamChat', () => {
  it('把逐块回答聚合成完整文本，并回调每次中间态', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([msg('食品'), msg('安全的'), msg('五个要点')])))
    const seen: string[] = []
    const answer = await streamChat({ query: '五要点是什么' }, { onUpdate: (t) => seen.push(t) })
    expect(answer).toBe('食品安全的五个要点')
    // 打字机的关键在于「有多次中间态」：只判最终值的话，一次性返回也能通过
    expect(seen).toEqual(['食品', '食品安全的', '食品安全的五个要点'])
    expect(seen.length).toBeGreaterThan(1)
  })

  it('message_end 之后停止消费，并回调 conversation_id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([msg('好', 'conv-9'), JSON.stringify({ event: 'message_end', conversation_id: 'conv-9' })])),
    )
    const conv: string[] = []
    await streamChat({ query: 'x' }, { onConversation: (id) => conv.push(id) })
    expect(conv).toContain('conv-9')
  })

  it('累计口径的 answer 不会产生重复文本', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([msg('你好'), msg('你好世界'), msg('你好世界！')])))
    const answer = await streamChat({ query: 'x' })
    expect(answer).toBe('你好世界！')
  })

  it('跨 TCP 分片的事件能被正确重组（切在事件中间也不丢字）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([msg('断点'), msg('传输')], { chunkSize: 7 })))
    const answer = await streamChat({ query: 'x' })
    expect(answer).toBe('断点传输')
  })

  it('上游返回 JSON 错误（应用未发布）时走错误分流，而不是当成空回答', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(400, { code: 'invalid_param', message: 'Workflow not published', status: 400 }),
      ),
    )
    const errors: string[] = []
    await expect(streamChat({ query: 'x' }, { onError: (m) => errors.push(m) })).rejects.toThrow()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('发布')
  })

  it('app_unavailable 翻译成可执行的中文提示，不把英文原文丢给使用者', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(400, { code: 'app_unavailable', message: 'App unavailable', status: 400 })),
    )
    const errors: string[] = []
    await expect(streamChat({ query: 'x' }, { onError: (m) => errors.push(m) })).rejects.toThrow()
    expect(errors[0]).toContain('Dify 应用当前不可用')
  })

  it('2xx 但既非 SSE 又不是可解析出回答的 JSON（网关错误页）仍走错误分流', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('上游网关返回了 HTML', { status: 200 })))
    const errors: string[] = []
    await expect(streamChat({ query: 'x' }, { onError: (m) => errors.push(m) })).rejects.toThrow()
    expect(errors[0]).toContain('上游网关返回了 HTML')
  })

  it('流里一个有效事件都没有时明确报错，而不是静默返回空串', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([])))
    const errors: string[] = []
    await expect(streamChat({ query: 'x' }, { onError: (m) => errors.push(m) })).rejects.toThrow(/未返回任何内容/)
    expect(errors).toHaveLength(1)
  })

  it('请求发往同源代理且不带任何凭据（密钥不进浏览器）', async () => {
    const spy = vi.fn(async () => sseResponse([msg('好')]))
    vi.stubGlobal('fetch', spy)
    await streamChat({ query: 'x', conversationId: 'conv-1', user: USER_GUID })
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(difyUrl('01'))
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({
      query: 'x',
      conversation_id: 'conv-1',
      user: USER_GUID,
      response_mode: 'streaming',
    })
    const headers = init.headers as Record<string, string>
    expect(Object.keys(headers)).toEqual(['Content-Type', 'Accept'])
    expect(JSON.stringify(init)).not.toMatch(/Bearer|app-/)
  })

  it('首轮不传 conversation_id，避免 Dify 收到空串被当成非法会话', async () => {
    const spy = vi.fn(async () => sseResponse([msg('好')]))
    vi.stubGlobal('fetch', spy)
    await streamChat({ query: 'x' })
    const init = spy.mock.calls[0]![1] as RequestInit
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect('conversation_id' in body).toBe(false)
  })

  /* ── 多应用：一套调用按阶段选路 ─────────────────────────────── */

  it('阶段缺省为 01 知识宣教', async () => {
    const spy = vi.fn(async () => sseResponse([msg('好')]))
    vi.stubGlobal('fetch', spy)
    await streamChat({ query: 'x' })
    expect(spy.mock.calls[0]![0]).toBe(`${DIFY_ENDPOINT}/01`)
  })

  it('阶段进路径后缀，四个阶段各自可达（02/03/04 尚未接线但通道是通的）', async () => {
    for (const stage of DIFY_STAGES) {
      const spy = vi.fn(async () => sseResponse([msg('好')]))
      vi.stubGlobal('fetch', spy)
      await streamChat({ query: 'x', stage })
      expect(spy.mock.calls[0]![0]).toBe(`${DIFY_ENDPOINT}/${stage}`)
    }
  })

  it('阶段注册表与 xlsx 的四个使用阶段一一对应', () => {
    expect(DIFY_STAGES).toEqual(['01', '02', '03', '04'])
    expect(DIFY_STAGE_LABELS['01']).toBe('知识宣教')
    expect(DIFY_STAGE_LABELS['04']).toBe('结案报告')
  })

  /* ── 上下文变量 inputs ─────────────────────────────────────── */

  it('给了 inputs 就带上（供 02/03/04 传案例背景设定）', async () => {
    const spy = vi.fn(async () => sseResponse([msg('好')]))
    vi.stubGlobal('fetch', spy)
    await streamChat({ query: 'x', inputs: { case_brief: '某中学食堂', round: 2 } })
    const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string)
    expect(body.inputs).toEqual({ case_brief: '某中学食堂', round: 2 })
  })

  it('没给 inputs 时连键都不出现，不给上游塞空对象', async () => {
    const spy = vi.fn(async () => sseResponse([msg('好')]))
    vi.stubGlobal('fetch', spy)
    await streamChat({ query: 'x' })
    const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string)
    expect('inputs' in body).toBe(false)
  })

  /* ── 响应模式：streaming / blocking ─────────────────────────── */

  it('缺省走 streaming：请求体带 response_mode=streaming，Accept 要 SSE', async () => {
    const spy = vi.fn(async () => sseResponse([msg('好')]))
    vi.stubGlobal('fetch', spy)
    await streamChat({ query: 'x' })
    const init = spy.mock.calls[0]![1] as RequestInit
    expect(JSON.parse(init.body as string).response_mode).toBe('streaming')
    expect((init.headers as Record<string, string>).Accept).toBe('text/event-stream')
  })

  it('要求 blocking 时透传：response_mode=blocking，Accept 转为 JSON', async () => {
    const spy = vi.fn(async () =>
      new Response(JSON.stringify({ event: 'message', answer: '阻塞模式的回答', conversation_id: 'c-b' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', spy)
    await streamChat({ query: 'x', responseMode: 'blocking' })
    const init = spy.mock.calls[0]![1] as RequestInit
    expect(JSON.parse(init.body as string).response_mode).toBe('blocking')
    // 喊错 Accept 会让上游/中间层误判调用方期待流，错误形态也更难读
    expect((init.headers as Record<string, string>).Accept).toBe('application/json')
  })

  it('blocking 的单条 JSON（Dify 文档给出的形态）能被解开，并带出 conversation_id', async () => {
    // 这一段刻意照抄官方文档的 blocking 响应示例结构（含 metadata.usage / retriever_resources）
    const docShape = {
      event: 'message',
      message_id: '9da23599-e713-473b-982c-4328d4f5c78a',
      conversation_id: '45701982-8118-4bc5-8e9b-64562b4555f2',
      mode: 'chat',
      answer: 'iPhone 13 Pro Max specs are listed here:...',
      metadata: {
        usage: { prompt_tokens: 1033, completion_tokens: 128, total_tokens: 1161, currency: 'USD', latency: 0.768 },
        retriever_resources: [
          {
            position: 1,
            dataset_id: '101b4c97-fc2e-463c-90b1-5261a4cdcafb',
            segment_id: 'ed599c7f-2766-4294-9d1d-e5235a61270a',
            score: 0.98457545,
            content: '"Model","Release Date"\n"iPhone 13 Pro Max","September 24, 2021"',
          },
        ],
      },
      created_at: 1705407629,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(docShape), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    const seen: string[] = []
    const convs: string[] = []
    const answer = await streamChat(
      { query: 'x', responseMode: 'blocking' },
      { onUpdate: (t) => seen.push(t), onConversation: (id) => convs.push(id) },
    )
    expect(answer).toBe('iPhone 13 Pro Max specs are listed here:...')
    // blocking 只回调一次（没有中间态可回调）——调用方不该期待逐字
    expect(seen).toEqual(['iPhone 13 Pro Max specs are listed here:...'])
    expect(convs).toEqual(['45701982-8118-4bc5-8e9b-64562b4555f2'])
  })

  it('blocking 下 metadata / retriever_resources 不会被误当回答念出去', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            event: 'message',
            answer: '正文',
            conversation_id: 'c-m',
            metadata: { usage: { total_tokens: 1161, currency: 'USD' }, retriever_resources: [{ score: 0.98 }] },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    const answer = await streamChat({ query: 'x', responseMode: 'blocking' })
    expect(answer).toBe('正文')
    expect(answer).not.toMatch(/1161|USD|0\.98/)
  })

  it('blocking 下 onNode 永不触发（没有流就没有节点事件）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ event: 'message', answer: '好', conversation_id: 'c-n' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    const nodes: string[] = []
    await streamChat({ query: 'x', responseMode: 'blocking' }, { onNode: (t) => nodes.push(t) })
    expect(nodes).toEqual([])
  })

  /* ── 补齐的事件语义 ────────────────────────────────────────── */

  it('message_replace 是替换语义：旧文被顶掉而不是拼在后面', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          msg('这段话含违规内容'),
          JSON.stringify({ event: 'message_replace', answer: '换个说法重新回答' }),
        ]),
      ),
    )
    const seen: string[] = []
    const answer = await streamChat({ query: 'x' }, { onUpdate: (t) => seen.push(t) })
    expect(answer).toBe('换个说法重新回答')
    // 若按增量 merge，这里会是「这段话含违规内容换个说法重新回答」——正是要防的
    expect(seen.at(-1)).toBe('换个说法重新回答')
    expect(answer).not.toContain('违规')
  })

  it('text_chunk 的正文在 data.text 里，也要认', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          JSON.stringify({ event: 'text_chunk', data: { text: '分段' } }),
          JSON.stringify({ event: 'text_chunk', data: { text: '回答' } }),
        ]),
      ),
    )
    expect(await streamChat({ query: 'x' })).toBe('分段回答')
  })

  it('裸 [DONE] 哨兵按无事件跳过，不影响已收内容', async () => {
    const payload = `data: ${msg('完整回答')}\n\ndata: [DONE]\n\n`
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(payload))
        c.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })),
    )
    expect(await streamChat({ query: 'x' })).toBe('完整回答')
  })

  /* ── 非 SSE 的 2xx：网关把流式降级成一次性 JSON ────────────── */

  it('2xx 但不是 SSE、且是带 answer 的 JSON 时按成功处理（不再当错误丢掉）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ answer: '一次性回答', conversation_id: 'conv-7' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })),
    )
    const seen: string[] = []
    const conv: string[] = []
    const answer = await streamChat({ query: 'x' }, { onUpdate: (t) => seen.push(t), onConversation: (i) => conv.push(i) })
    expect(answer).toBe('一次性回答')
    expect(seen).toEqual(['一次性回答'])
    expect(conv).toContain('conv-7')
  })

  it('工作流形态的 data.outputs.text 也认（为将来加工作流应用留口）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: { outputs: { text: '工作流输出' } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })),
    )
    expect(await streamChat({ query: 'x' })).toBe('工作流输出')
  })

  it('2xx + JSON 但对象里没有可识别的回答字段时也报错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ code: 'boom' }), { status: 200, headers: { 'content-type': 'application/json' } })),
    )
    await expect(streamChat({ query: 'x' })).rejects.toThrow(/对话服务返回错误/)
  })

  /* ── 错误文案的分流口径 ─────────────────────────────────────── */

  it('internal_server_error 指向「user 须为 UUID」，且不甩锅给模型供应商 / 上游编排', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(500, {
          code: 'internal_server_error',
          message: 'The server encountered an internal error and was unable to complete your request.',
          status: 500,
        }),
      ),
    )
    const errors: string[] = []
    await expect(streamChat({ query: 'x' }, { onError: (m) => errors.push(m) })).rejects.toThrow()
    expect(errors[0]).toContain('Dify 返回内部错误')
    expect(errors[0]).toContain('UUID')
    expect(errors[0]).toContain('运行日志')
    // 反向取证（两条都踩过坑，钉住不许回退）：
    //  1. 早期版本把成因猜成「模型供应商凭据失效」—— 已被同密钥的
    //     `POST /conversations/:id/name` 走同一模型配置却能 200 反证。
    //  2. 中间版本改猜「该应用的编排执行有问题 / 已发布快照坏了」—— 也被推翻了：
    //     单变量对照（`_probe-user-format.cjs`）证明只要 user 是 UUID 就 200。
    //     这两条都是「用自己的错误输入测出 500，却把账算到上游头上」。
    expect(errors[0]).not.toContain('模型供应商')
    expect(errors[0]).not.toContain('额度')
    expect(errors[0]).not.toContain('编排')
    expect(errors[0]).not.toContain('快照')
  })

  it('上游回 HTML 错误页时给可执行提示，不把 <html> 甩到页面上', async () => {
    // 实测：Dify 工作进程崩掉时 HTTP 层回的就是这种页（流式请求下尤其常见）
    const html = '<html>\n  <head>\n    <title>Internal Server Error</title>\n  </head>\n</html>'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(html, { status: 500, headers: { 'content-type': 'text/html' } })),
    )
    const errors: string[] = []
    await expect(streamChat({ query: 'x' }, { onError: (m) => errors.push(m) })).rejects.toThrow()
    expect(errors[0]).toContain('网页错误页')
    expect(errors[0]).toContain('HTTP 500')
    expect(errors[0]).not.toContain('<html>')
  })

  it('代理返回的中文 message 原样保留（比通用提示更具体，带阶段号）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(500, { code: 'not_configured', message: '未配置阶段 03 的 DIFY_API_KEY_03，请在 frontend/.env.local 填写后重启 dev server' }),
      ),
    )
    const errors: string[] = []
    await expect(streamChat({ query: 'x', stage: '03' }, { onError: (m) => errors.push(m) })).rejects.toThrow()
    expect(errors[0]).toContain('阶段 03')
    // 不该被通用提示顶掉，也不该在末尾再缀一个错误码
    expect(errors[0]).not.toContain('not_configured')
  })
})

/**
 * Chatflow 的**真实事件形态**回归。
 *
 * 背景：此前 E2E 桩只发 `message` + `message_end` 两种事件，等于把「上游只发这几种」
 * 当成了前提。而真实 Chatflow 会先推 `workflow_started` / `node_started` / `node_finished`，
 * 收尾推 `workflow_finished`，部分编排下**正文只出现在终帧的 `data.outputs` 里**，
 * `message` 一个字都不吐。这正是「上游成功、页面却是空气泡」的成因，故单列一组用例钉住。
 */
describe('streamChat · Chatflow 真实事件形态', () => {
  const frame = (event: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ event, ...extra })

  it('整条真实序列（含 ping / workflow_* / [DONE]）不影响正常流式累加', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          frame('ping'),
          frame('workflow_started', { conversation_id: 'conv-rt' }),
          frame('node_started', { data: { node_id: 'n1', title: 'LLM' } }),
          msg('食源性疾病', 'conv-rt'),
          msg('是一类疾病', 'conv-rt'),
          frame('node_finished', { data: { node_id: 'n1', status: 'succeeded' } }),
          frame('workflow_finished', {
            conversation_id: 'conv-rt',
            data: { status: 'succeeded', outputs: { answer: '食源性疾病是一类疾病' } },
          }),
          frame('message_end', { conversation_id: 'conv-rt' }),
          '[DONE]',
        ])),
    )
    const seen: string[] = []
    const answer = await streamChat({ query: '什么是食源性疾病' }, { onUpdate: (t) => seen.push(t) })
    expect(answer).toBe('食源性疾病是一类疾病')
    // 恰好两次更新（两个 message 增量）：终帧因为「已经流出了内容」而不再回调，
    // 否则打字机会在末尾被整段文本整体重置一次 —— 这正是这里要钉住的性质。
    expect(seen).toEqual(['食源性疾病', '食源性疾病是一类疾病'])
  })

  /* ── 节点进度：把「首字前的 2~3 秒」讲清楚的唯一数据来源 ── */

  it('node_started 回调节点标题（等待期进度文案的来源）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          frame('workflow_started', { conversation_id: 'conv-n' }),
          frame('node_started', { data: { node_id: 'n1', title: '知识检索' } }),
          frame('node_started', { data: { node_id: 'n2', title: 'LLM' } }),
          msg('答案', 'conv-n'),
          frame('message_end', { conversation_id: 'conv-n' }),
        ])),
    )
    const nodes: string[] = []
    const answer = await streamChat({ query: 'q' }, { onNode: (t) => nodes.push(t) })
    expect(nodes).toEqual(['知识检索', 'LLM'])
    expect(answer).toBe('答案')
  })

  it('只认 node_started，不认 node_finished（否则文案会跳回上一个节点）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          frame('workflow_started', { conversation_id: 'conv-nf' }),
          frame('node_started', { data: { node_id: 'n1', title: '知识检索' } }),
          frame('node_finished', { data: { node_id: 'n1', title: '知识检索', status: 'succeeded' } }),
          msg('答案', 'conv-nf'),
          frame('message_end', { conversation_id: 'conv-nf' }),
        ])),
    )
    const nodes: string[] = []
    await streamChat({ query: 'q' }, { onNode: (t) => nodes.push(t) })
    expect(nodes).toEqual(['知识检索'])
  })

  it('聊天助手型应用不推 node_* → onNode 一次都不触发，也不影响回答', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([msg('纯聊天助手回答', 'conv-plain'), frame('message_end', {})])),
    )
    const nodes: string[] = []
    const answer = await streamChat({ query: 'q' }, { onNode: (t) => nodes.push(t) })
    expect(nodes).toEqual([])
    expect(answer).toBe('纯聊天助手回答')
  })

  it('没传 onNode 时收到 node_started 不报错（回调是可选的）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          frame('node_started', { data: { node_id: 'n1', title: '知识检索' } }),
          msg('答案', 'conv-opt'),
          frame('message_end', { conversation_id: 'conv-opt' }),
        ])),
    )
    await expect(streamChat({ query: 'q' })).resolves.toBe('答案')
  })

  it('node_started 缺 title（部分版本不带）时静默跳过，不回调空串', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          frame('node_started', { data: { node_id: 'n1' } }),
          msg('答案', 'conv-nt'),
          frame('message_end', { conversation_id: 'conv-nt' }),
        ])),
    )
    const nodes: string[] = []
    await streamChat({ query: 'q' }, { onNode: (t) => nodes.push(t) })
    expect(nodes).toEqual([])
  })

  it('只收到 message_end、一个字都没吐 → 报错而不是 resolve 空串', async () => {
    // 原缺陷：message_end 提前 return，绕过了函数末尾的空回答守卫，
    // 于是「上游只发结束帧」会静默 resolve 出空串 —— 页面上字幕条直接消失。
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([frame('message_end', { conversation_id: 'conv-empty' })])),
    )
    const errors: string[] = []
    await expect(streamChat({ query: 'q' }, { onError: (m) => errors.push(m) })).rejects.toThrow(
      '未返回任何内容',
    )
    expect(errors).toHaveLength(1)
  })

  it('上游一个字都不吐、正文只在 workflow_finished.data.outputs → 兜底取到，不再是空气泡', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          frame('workflow_started', { conversation_id: 'conv-only-final' }),
          frame('workflow_finished', {
            conversation_id: 'conv-only-final',
            data: { status: 'succeeded', outputs: { answer: '熟食室温放置不超过 2 小时。' } },
          }),
          frame('message_end', { conversation_id: 'conv-only-final' }),
        ])),
    )
    const answer = await streamChat({ query: '熟食能放多久' })
    expect(answer).toBe('熟食室温放置不超过 2 小时。')
  })

  it('outputs 里混着过程字段时只认正文键，绝不把 elapsed_time 当回答念出去', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          frame('workflow_finished', {
            data: { status: 'succeeded', outputs: { elapsed_time: '3.2', answer: '中心温度≥70℃。' } },
          }),
          frame('message_end', {}),
        ])),
    )
    expect(await streamChat({ query: 'q' })).toBe('中心温度≥70℃。')
  })

  it('outputs 认不出正文键 → 报「未返回任何内容」，不静默空白', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          frame('workflow_finished', { data: { status: 'succeeded', outputs: { elapsed_time: '1.1' } } }),
          frame('message_end', {}),
        ])),
    )
    const errors: string[] = []
    await expect(streamChat({ query: 'q' }, { onError: (m) => errors.push(m) })).rejects.toThrow(
      '未返回任何内容',
    )
    expect(errors).toHaveLength(1)
  })

  it('workflow_finished.status=failed → 抛可读错误并回调 onError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          frame('workflow_finished', {
            data: { status: 'failed', error: 'Model provider credential is invalid.' },
          }),
          frame('message_end', {}),
        ])),
    )
    const errors: string[] = []
    await expect(streamChat({ query: 'q' }, { onError: (m) => errors.push(m) })).rejects.toThrow(
      'Model provider credential is invalid.',
    )
    expect(errors[0]).toContain('credential')
  })

  it('status=failed 但没给 error 文案 → 回落到中文提示，不把 undefined 显示给使用者', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([frame('workflow_finished', { data: { status: 'failed' } }), frame('message_end', {})]),
      ),
    )
    const errors: string[] = []
    await expect(streamChat({ query: 'q' }, { onError: (m) => errors.push(m) })).rejects.toThrow()
    expect(errors[0]).toContain('工作流执行中断')
    expect(errors[0]).not.toContain('undefined')
  })
})

describe('pickTextFromOutputs', () => {
  it('字符串直接可用；去空白后为空则视为不可用', () => {
    expect(pickTextFromOutputs('甲')).toBe('甲')
    expect(pickTextFromOutputs('   ')).toBe('')
  })

  it('按 answer / text / output / result / content 顺序取正文键', () => {
    expect(pickTextFromOutputs({ answer: '甲' })).toBe('甲')
    expect(pickTextFromOutputs({ text: '乙' })).toBe('乙')
    expect(pickTextFromOutputs({ output: '丙' })).toBe('丙')
    expect(pickTextFromOutputs({ result: '丁' })).toBe('丁')
    expect(pickTextFromOutputs({ content: '戊' })).toBe('戊')
    expect(pickTextFromOutputs({ answer: '优先', text: '其次' })).toBe('优先')
  })

  it('只有过程字段 / 非对象 → 空串（宁可报错，不可念错）', () => {
    expect(pickTextFromOutputs({ elapsed_time: '3.2' })).toBe('')
    expect(pickTextFromOutputs({ answer: 42 })).toBe('')
    expect(pickTextFromOutputs(null)).toBe('')
    expect(pickTextFromOutputs(undefined)).toBe('')
    expect(pickTextFromOutputs(['甲'])).toBe('')
  })
})

describe('extractAnswerFromJson', () => {
  it('answer 字段', () => {
    expect(extractAnswerFromJson('{"answer":"甲"}').answer).toBe('甲')
  })

  it('data.outputs 为字符串', () => {
    expect(extractAnswerFromJson('{"data":{"outputs":"乙"}}').answer).toBe('乙')
  })

  it('data.outputs.answer', () => {
    expect(extractAnswerFromJson('{"data":{"outputs":{"answer":"丙"}}}').answer).toBe('丙')
  })

  it('顺带带出 conversation_id，便于继续多轮', () => {
    expect(extractAnswerFromJson('{"answer":"甲","conversation_id":"c1"}').conversationId).toBe('c1')
  })

  it('认不出的一律返回空串，绝不把整个对象当回答', () => {
    expect(extractAnswerFromJson('<html>').answer).toBe('')
    expect(extractAnswerFromJson('{"foo":1}').answer).toBe('')
    expect(extractAnswerFromJson('"裸字符串"').answer).toBe('')
  })
})

describe('difyUrl', () => {
  it('前缀 + 阶段，缺省 01', () => {
    expect(difyUrl()).toBe(`${DIFY_ENDPOINT}/01`)
    expect(difyUrl('04')).toBe(`${DIFY_ENDPOINT}/04`)
  })
})

describe('difyUser', () => {
  it('生成 GUID（UUID v4）格式的匿名标识，且同一会话内保持稳定', () => {
    const first = difyUser()
    expect(first).toMatch(GUID_RE)
    expect(difyUser()).toBe(first)
  })

  it('存储里的旧格式（非 GUID）id 会被弃用，并回写为 GUID', async () => {
    // 换格式时最容易漏的一步：只管生成、不管读取，
    // 于是老浏览器里那个 `stu-xxxxxxxx` 会一直被返回，GUID 要求形同虚设。
    //
    // 这里必须拿一个**全新的模块实例**：`difyUser` 内有模块级 memoryUser，
    // 上面的用例已经把它填上了；不重置模块的话，本用例即便读到了存量值也会
    // 直接命中内存兜底，断言「已回写存储」就会失真。
    vi.resetModules()
    const store = new Map<string, string>([['gwa10343033.dify-user.v2', 'stu-legacyid']])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    const fresh = await import('../lib/dify')
    const got = fresh.difyUser()
    expect(got).not.toBe('stu-legacyid')
    expect(got).toMatch(GUID_RE)
    expect(store.get('gwa10343033.dify-user.v2')).toBe(got)
  })
})
