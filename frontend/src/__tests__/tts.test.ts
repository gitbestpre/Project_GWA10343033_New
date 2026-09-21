import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VOICE_KEY,
  SEGMENT_MAX_CHARS,
  TTS_VOICES,
  buildPayload,
  findVoice,
  hexToBytes,
  segmentLines,
  stripMarkdown,
  textKey,
  toSpeakable,
} from '../lib/tts'

/* ───────── 可朗读化 ───────── */

describe('toSpeakable —— 排版文本 → 朗读文本', () => {
  it('去掉行首缩进与（1）式编号', () => {
    expect(toSpeakable('      （1）WHO定义')).toBe('WHO定义')
    expect(toSpeakable('（3）全球疾病负担')).toBe('全球疾病负担')
    expect(toSpeakable('      （五）小结')).toBe('小结')
  })

  it('圈码转为逗号，保留枚举停顿但不念符号', () => {
    expect(toSpeakable('包括：①甲肝；②戊肝')).toBe('包括：，甲肝；，戊肝')
  })

  it('符号换成中文读法', () => {
    expect(toSpeakable('中心温度≥70℃保持2分钟')).toBe('中心温度大于等于70摄氏度保持2分钟')
    expect(toSpeakable('潜伏期1~6小时')).toBe('潜伏期1到6小时')
    expect(toSpeakable('细菌数增长100倍×3')).toBe('细菌数增长100倍乘以3')
  })

  it('连续空白折叠；纯空白行得到空串', () => {
    expect(toSpeakable('  a   b  ')).toBe('a b')
    expect(toSpeakable('      ')).toBe('')
  })

  it('不改动本来就没有标记的正文（标题行原样保留）', () => {
    expect(toSpeakable('一、食源性疾病定义与分类')).toBe('一、食源性疾病定义与分类')
  })
})

/* ───────── 回答朗读前的 Markdown 清洗（只作用于 Dify 回答） ───────── */

describe('stripMarkdown —— 回答文本 → 可朗读文本', () => {
  it('去掉加粗/斜体/删除线标记，保留文字', () => {
    expect(stripMarkdown('**保持清洁**是第一条')).toBe('保持清洁是第一条')
    expect(stripMarkdown('*生熟分开*同样重要')).toBe('生熟分开同样重要')
    expect(stripMarkdown('~~过时说法~~')).toBe('过时说法')
    expect(stripMarkdown('__烧熟煮透__')).toBe('烧熟煮透')
  })

  it('去掉行首标题与列表标记', () => {
    expect(stripMarkdown('### 三、治疗原则')).toBe('三、治疗原则')
    expect(stripMarkdown('- 冷藏≤4℃')).toBe('冷藏≤4℃')
    expect(stripMarkdown('1. 查看保质期')).toBe('查看保质期')
  })

  it('链接与图片保留可见文字、丢掉地址', () => {
    expect(stripMarkdown('见[WHO五要点](https://who.int/x)第 1 条')).toBe('见WHO五要点第 1 条')
    expect(stripMarkdown('![示意图](/img/a.png)如下')).toBe('示意图如下')
  })

  it('行内代码的反引号与落单标记符号都被清掉（宁可少符号，不能念出「星号」）', () => {
    expect(stripMarkdown('用 `ORS` 补液')).toBe('用 ORS 补液')
    expect(stripMarkdown('未闭合的 **加粗')).toBe('未闭合的 加粗')
  })

  it('清洗结果仍然交给 toSpeakable 处理中文编号与符号（两道工序串联）', () => {
    // 回答里带 Markdown 列表 + 中文编号 + 度量符号时，两道工序都必须生效
    expect(toSpeakable(stripMarkdown('- **中心温度**≥70℃'))).toBe('中心温度大于等于70摄氏度')
  })
})

/* ───────── 分段 ───────── */

/** 造一页与真实正文同构的行（6 空格缩进 + （n）编号 + 长行），总长约 600 字 */
const makePage = () => [
  '一、主要传播途径',
  '食源性致病微生物主要通过食物链传播，涉及从农田到餐桌的全过程。',
  '      （1）原料污染途径',
  '        动物源性：畜禽养殖场环境污染，屠宰加工交叉污染，水产养殖水质污染；植物源性：灌溉水污染，土壤污染，采收运输污染。',
  '      （2）加工过程交叉污染',
  '        人员污染：带菌操作人员通过手部接触传播；设备器具污染：未清洗消毒的刀具砧板传播；环境污染：加工区空气、地面、排水沟藏匿病原体。',
  '      （3）储存不当导致增殖',
  '        温度失控：危险温度带（5~60℃）内细菌每20分钟增殖一代；时间累积：室温放置2小时可使细菌数增长100倍；反复污染：生熟混放、冷链中断。',
  '      （4）终端处理不当',
  '        烹饪不足：中心温度未达70℃，致病菌未杀灭；二次污染：熟食接触污染表面；不安全食用：生食高风险食材（生蚝、生鱼片、溏心蛋）。',
]

describe('segmentLines —— 按行切块', () => {
  it('每块不超过上限，且不留空块', () => {
    const segments = segmentLines(makePage(), SEGMENT_MAX_CHARS)
    expect(segments.length).toBeGreaterThan(1)
    for (const s of segments) {
      expect(s.text.length).toBeGreaterThan(0)
      expect(s.text.length).toBeLessThanOrEqual(SEGMENT_MAX_CHARS)
    }
  })

  it('lines 覆盖下标与输入数组一一对应（无漏、无重、递增）', () => {
    const lines = makePage()
    const covered = segmentLines(lines, SEGMENT_MAX_CHARS).flatMap((s) => s.lines)
    const nonEmpty = lines.map((l, i) => ({ l, i })).filter(({ l }) => toSpeakable(l) !== '').map(({ i }) => i)
    expect(covered).toEqual(nonEmpty)
  })

  it('空行被跳过但不打乱下标对应关系', () => {
    const lines = ['甲', '', '   ', '乙']
    const segments = segmentLines(lines)
    expect(segments.flatMap((s) => s.lines)).toEqual([0, 3])
  })

  it('每块文本都能在源行里找到出处（首行可朗读文本为其前缀）', () => {
    const lines = makePage()
    for (const seg of segmentLines(lines, SEGMENT_MAX_CHARS)) {
      const first = toSpeakable(lines[seg.lines[0]])
      expect(seg.text.startsWith(first.slice(0, 12))).toBe(true)
    }
  })

  it('超长单行按句读切开，且仍归属同一行下标', () => {
    const long = '甲。'.repeat(200) // 400 字，远超上限
    const segments = segmentLines([long], 100)
    expect(segments.length).toBeGreaterThan(3)
    for (const s of segments) {
      expect(s.text.length).toBeLessThanOrEqual(100)
      expect(s.lines).toEqual([0])
    }
  })

  it('全部行皆空时返回空数组（调用方据此禁用朗读）', () => {
    expect(segmentLines(['', '   '])).toEqual([])
  })
})

/* ───────── 缓存键 / 请求体 ───────── */

describe('textKey —— 缓存去重键', () => {
  it('同文本稳定、异文本不同', () => {
    expect(textKey('食源性疾病')).toBe(textKey('食源性疾病'))
    expect(textKey('食源性疾病')).not.toBe(textKey('食源性疾病 '))
    expect(textKey('a')).not.toBe(textKey('b'))
  })

  it('固定 16 位十六进制', () => {
    expect(textKey('任意文本')).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('buildPayload —— 与 Unity 端 SpeakWav_url 的请求口径一致', () => {
  // 音色已固定为默认「女主持人」（负责人撤掉了换音色入口，音色表只留这一项）
  const payload = buildPayload('测试文本', findVoice(DEFAULT_VOICE_KEY))

  it('顶层字段', () => {
    expect(payload.model).toBe('speech-02-turbo')
    expect(payload.text).toBe('测试文本')
    expect(payload.stream).toBe(false)
    expect(payload.output_format).toBe('hex')
    expect(payload.language_boost).toBe('Chinese')
  })

  it('voice_setting 携带音色 / 情绪 / 语速 / 音调 / 音量', () => {
    expect(payload.voice_setting).toEqual({
      voice_id: 'presenter_female',
      speed: 1,
      vol: 1,
      pitch: 0,
      emotion: 'neutral',
    })
  })

  it('audio_setting 携带采样率 / 码率 / 格式 / 声道', () => {
    expect(payload.audio_setting).toEqual({
      sample_rate: 32000,
      bitrate: 128000,
      format: 'mp3',
      channel: 1,
    })
  })
})

describe('findVoice', () => {
  it('默认音色是知识宣教用的女主持人', () => {
    expect(TTS_VOICES[0].key).toBe('narrator-female')
    expect(findVoice('narrator-female').voiceId).toBe('presenter_female')
  })

  it('未知 key 回落到默认音色而不是抛错', () => {
    expect(findVoice('no-such-voice').key).toBe(TTS_VOICES[0].key)
  })

  // 反向下钉：负责人已撤掉换音色入口并只保留女主持人。
  // 立一条「表里就只有这一项」，防止脚本里那 5 套角色音色被顺手加回来。
  it('音色表只保留默认一项（无换音色入口）', () => {
    expect(TTS_VOICES).toHaveLength(1)
    expect(TTS_VOICES[0].key).toBe(DEFAULT_VOICE_KEY)
  })
})

/* ───────── HEX 解码 ───────── */

describe('hexToBytes —— 对齐脚本 HexStringToByteArray', () => {
  it('解出 WAV 头 RIFF', () => {
    expect(Array.from(hexToBytes('52494646'))).toEqual([0x52, 0x49, 0x46, 0x46])
  })

  it('接受大写与前后空白', () => {
    expect(Array.from(hexToBytes(' 4D5A '))).toEqual([0x4d, 0x5a])
  })

  it('长度为奇数或含非法字符时抛错，而不是静默产出半截音频', () => {
    expect(() => hexToBytes('4D5')).toThrow()
    expect(() => hexToBytes('4D5G')).toThrow()
    expect(() => hexToBytes('')).toThrow()
  })
})
