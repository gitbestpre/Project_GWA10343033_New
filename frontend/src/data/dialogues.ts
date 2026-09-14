// 该文件由 scripts/extract_dialogues.py 从
// 《食品致病性微生物污染事件_语音文档.xlsx》工作表「现场流行病学调查」自动生成，请勿手改。
// 更新对话后重跑脚本即可。

export interface DialogueLine {
  /** 语音文档中的行 ID */
  id: string
  /** 说话角色，如 王医师 / 张医生 / 旁白 */
  role: string
  /** 角色性别（可空），用于配音/头像区分 */
  gender?: string | null
  /** 字幕文本 */
  text: string
  /** 语音文件地址（/Audio/...） */
  audio: string
  /** 该条对话的背景视频（3.mp4 / 4.mp4 本身无音轨） */
  video: string
}

/** 视频2（接报电话）结束后的对话，仅前 2 条 */
export const FIELD_DIALOGUES: DialogueLine[] = [
  {
    "id": "0",
    "role": "王医师",
    "gender": "男",
    "text": "您好，这里是海河市红林区市场监督管理局，有什么需要帮助，请讲。",
    "audio": "/Audio/现场流行病学调查/0.mp3",
    "video": "/Video/3.mp4"
  },
  {
    "id": "1",
    "role": "张医生",
    "gender": null,
    "text": "您好，我是海河市中心医院急诊科张医生，目前我院接诊了一批患者，均有不同程度的呕吐、腹痛、腹泻、发热，他们都是共同参加寿宴的家人，我怀疑是食源性疾病事件，特向贵单位报告。",
    "audio": "/Audio/现场流行病学调查/01.mp3",
    "video": "/Video/4.mp4"
  }
]

/**
 * 处置反馈弹窗“我已了解”后的逐级汇报对话（语音文档第 3、4 条）：
 * 疾控值班王医师向办公室尤主任电话汇报，尤主任决定启动应急小组。
 * 背景视频 5.mp4 / 6.mp4 为双人分屏通话画面（本身无有效音轨，配音走 mp3）。
 */
export const CDC_REPORT_DIALOGUES: DialogueLine[] = [
  {
    "id": "3",
    "role": "王医师",
    "gender": "男",
    "text": "尤主任，您好。我是今天值班的医师，我接到市中心医院急诊科报告，他们从凌晨4点开始，收治了20多名患者，都有不同程度的呕吐、腹痛、腹泻、发热，而且这些患者在酒店参加过寿宴，怀疑是一场群体食物中毒事件。",
    "audio": "/Audio/现场流行病学调查/03.mp3",
    "video": "/Video/5.mp4"
  },
  {
    "id": "4",
    "role": "尤主任",
    "gender": "男",
    "text": "谢谢您。我马上通知中心应急工作小组成员，准备出发。",
    "audio": "/Audio/现场流行病学调查/04.mp3",
    "video": "/Video/6.mp4"
  }
]
