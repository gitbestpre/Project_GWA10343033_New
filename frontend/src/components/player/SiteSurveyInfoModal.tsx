/**
 * 9.mp4 播放结束后的“现场调查信息”弹窗（对齐 Figma 301:445）。
 * 1200×700 白卡（圆角 20）：顶部 64px 头部（浅蓝 #f4f8fd + 蓝色竖条 #395ba8
 * + 标题“现场调查信息” + 右上关闭 X），下方 1px 分割线；
 * 正文引导句（加粗）+ 现场流行病学调查长文（28px / 行高 45，区域可纵向滚动）；
 * 底部居中蓝色“我已了解”按钮 191×60，点击进入 10.mp4。
 */
const INTRO = '通过现场调查得到以下信息：'
const BODY =
  '经现场流行病学调查，信息如下:首发病例于6月4日22时出现症状，末例病例于6日8时发病，' +
  '高峰期为5日5时~17时，流行曲线呈点源暴发模式，单峰分布，最短潜伏期3小时，最长潜伏期33小时，' +
  '平均潜伏期为12小时。病例主要表现为腹泻、呕吐、发热，部分病例伴腹痛、乏力、寒战等症状。' +
  '腹泻次数多为10-20次/天，大便性状为黄色或黄绿色水样。发热多数为中等发热以上，病程多为3-7天。' +
  '大部分患者以轻症为主，临床辅助检查结果显示，白细胞和中性粒细胞比例升高，经抗感染、补液及' +
  '对症治疗后好转，无危重和死亡病例。病例全部分布在同一个就餐大厅，病例就座的座位分布无规律性。' +
  '该酒店的厨房饮用水的水质检测未发现致病菌。 请你根据上述信息，制定病例定义。根据制定的病例定义，展开病例搜索。'

export default function SiteSurveyInfoModal({ onAck }: { onAck: () => void }) {
  return (
    <div className="si-mask">
      <section
        className="si-card"
        role="dialog"
        aria-modal="true"
        aria-label="现场调查信息"
      >
        {/* 头部 */}
        <header className="si-head">
          <span className="si-head-bar" />
          <h2 className="si-head-title">现场调查信息</h2>
          <button type="button" className="si-close" aria-label="关闭" onClick={onAck}>
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3 3L15 15M15 3L3 15" stroke="#A5B0C5" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* 正文（引导句 + 可滚动长文） */}
        <div className="si-body">
          <p className="si-intro">{INTRO}</p>
          <p className="si-text">{BODY}</p>
        </div>

        {/* 主操作 */}
        <button type="button" className="si-ack-btn" onClick={onAck}>
          <span>我已了解</span>
        </button>
      </section>
    </div>
  )
}
