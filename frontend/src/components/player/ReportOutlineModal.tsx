import { useEffect, useRef } from 'react'
import './ReportOutlineModal.css'

/**
 * 《食品安全事故流行病学调查报告提纲》弹窗（对齐 Figma 370:1988 / Group 1171275685）。
 * 1200 宽白卡：浅蓝头条（竖条 + 标题 + X）64px，正文为六部分提纲真实文本（28px），
 * 内容超过可视高度时在主体内纵向滚动；底部固定「确认」栏，确认（或右上 X）返回上一级。
 * 弹窗出现时同步播放解说音频 0.mp3，离开（确认/关闭/卸载）即停止。
 */

const REPORT_TITLE = '食品安全事故流行病学调查报告提纲'

/** 报告提纲解说音频（资料分析及调查结论） */
const REPORT_AUDIO = '/Audio/资料分析及调查结论/0.mp3'

/** 六部分：章节标题 + 若干段落（保持 Figma 原文；段落内 \n 转换行） */
const SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: '一、背景',
    paragraphs: [
      '调查任务来源(何时接报或接到上级行政部门调查指示)、事故简单描述(事故发生的时间、地点、波及范围、基本经过等)、参与事故调查的机构与人员、调查目的简述。',
    ],
  },
  {
    heading: '二、基本情况',
    paragraphs: [
      '事故发生地的基本情况，如气候、风俗习惯、人口数、社区的社会经济状况、学校/工厂/企业规模、住宿非住宿、食品企业的日常活动和操作等。',
    ],
  },
  {
    heading: '三、调查过程',
    paragraphs: [
      '（一）目的：开展调查时需要达到的目标，目的描述要简明扼要、有逻辑性；',
      '（二）方法：包括流行病学的内容（调查人群描述、病例定义、如何开展病例搜索、如何选择病例和对照、资料收集方法、资料分析方法等）与实验室检测的内容（样本采集与运送方法、采用的实验室检测技术和数据分析方法）；',
    ],
  },
  {
    heading: '四、调查结果',
    paragraphs: [
      '描述所有来自临床、实验室、现场流行病学调查和食品卫生学调查方面的结果（可以按照“方法”部分的顺序来描述结果，但不要在此部分解释或讨论数据）。',
      '（一）现场流行病学调查：总发病数、罹患率、疾病临床信息（症状体征、住院转归、临床检验结果）、疾病潜伏期（最短最长、平均）、病例三间分布特征、危险因素暴露情况（发病前72小时或重点可疑餐次的饮食史、可疑食品进食时间与数量）、分析性流行病学研究（队列研究或病例对照研究）结果等；',
      '（二）食品卫生学调查：可疑食品及其原料的来源、剩余数量及流向；可疑食品的制作时间、配方、加工方法和加工环境卫生状况；成品（包括半成品）的保存、运输、销售条件；食品制作人员的卫生和健康状况；分析造成食品污染的环节。',
      '（三）实验室检验结果：所采集的样本类型与数量、实验室检验项目与结果。',
    ],
  },
  {
    heading: '五、调查结论',
    paragraphs: [
      '概括事故调查中的主要发现和特点，作出结论的主要依据、理由。调查结论内容应当包括事故范围、发病人数、致病因子、污染食品及污染原因。不能作出调查结论的事项应当说明原因。',
    ],
  },
  {
    heading: '六、建议',
    paragraphs: [
      '提出防控建议，如发布食品消费预警，召回相关食品，对污染食品的无害化处理，清洗消毒加工场所，改进加工工艺，维修或更换生产设备，调离受感染的从业人员，加强从业人员培训，开展公众宣传教育等。',
    ],
  },
]

export default function ReportOutlineModal({ onConfirm }: { onConfirm: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  // 弹窗出现即播放解说音频；离开（确认/关闭导致卸载）时停止并复位
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = 0
    el.play().catch(() => {})
    return () => {
      el.pause()
      el.currentTime = 0
    }
  }, [])

  return (
    <div className="rp-mask">
      {/* 报告提纲解说音频（隐藏控件，仅发声） */}
      <audio ref={audioRef} src={REPORT_AUDIO} preload="auto" />

      <section className="rp-panel" role="dialog" aria-modal="true" aria-label={REPORT_TITLE}>
        {/* 头条 */}
        <div className="rp-head">
          <span className="rp-head-bar" />
          <span className="rp-head-title">{REPORT_TITLE}</span>
          <button type="button" className="rp-close" aria-label="关闭" onClick={onConfirm}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3 3L15 15M15 3L3 15" stroke="#A5B0C5" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="rp-divider" />

        {/* 正文（滚动区） */}
        <div className="rp-body">
          {SECTIONS.map((sec) => (
            <section key={sec.heading} className="rp-section">
              <h3 className="rp-heading">{sec.heading}</h3>
              {sec.paragraphs.map((p, i) => (
                <p key={i} className="rp-para">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        {/* 底部固定确认栏 */}
        <div className="rp-footer">
          <button type="button" className="rp-confirm-btn" onClick={onConfirm}>
            确认
          </button>
        </div>
      </section>
    </div>
  )
}
