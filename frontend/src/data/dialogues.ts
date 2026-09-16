// 该文件由 scripts/extract_dialogues.py 从
// 《食品致病性微生物污染事件_语音文档.xlsx》工作表
// 「现场流行病学调查」「食品卫生学调查」自动生成，请勿手改。
// 更新对话后重跑脚本即可：python scripts/extract_dialogues.py

export interface DialogueLine {
  /** 语音文档中的行 ID */
  id: string
  /** 说话角色，如 王医师 / 张医生 / 采样人员 */
  role: string
  /** 角色性别（可空），用于配音/头像区分 */
  gender?: string | null
  /** 字幕文本 */
  text: string
  /** 语音文件地址（/Audio/...） */
  audio: string
  /** 该条对话的背景视频（静音循环） */
  video: string
}

/** 视频2（接报电话）结束后的对话，仅前 2 条
 */
export const FIELD_DIALOGUES: DialogueLine[] = [
  {
    "id": "0",
    "role": "王医师",
    "gender": null,
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

/** 处置反馈弹窗“我已了解”后的逐级汇报对话（语音文档第 3、4 条）：
 *  * 疾控值班王医师向办公室尤主任电话汇报，尤主任决定启动应急小组。
 *  * 背景视频 5.mp4 / 6.mp4 为双人分屏通话画面（本身无有效音轨，配音走 mp3）。
 */
export const CDC_REPORT_DIALOGUES: DialogueLine[] = [
  {
    "id": "3",
    "role": "王医师",
    "gender": null,
    "text": "尤主任，您好。我是今天值班的医师，我接到市中心医院急诊科报告，他们从凌晨4点开始，收治了20多名患者，都有不同程度的呕吐、腹痛、腹泻、发热，而且这些患者在酒店参加过寿宴，怀疑是一场群体食物中毒事件。",
    "audio": "/Audio/现场流行病学调查/03.mp3",
    "video": "/Video/5.mp4"
  },
  {
    "id": "4",
    "role": "尤主任",
    "gender": null,
    "text": "谢谢您。我马上通知中心应急工作小组成员，准备出发。",
    "audio": "/Audio/现场流行病学调查/04.mp3",
    "video": "/Video/6.mp4"
  }
]

/** 视频11（采样员出示证件/对话）结束后的现场采样对话（语音文档 0-5 条）：
 *  * 采样人员 张峰 ↔ 好运来酒店大堂经理 钱强，共 6 句。
 *  * 背景循环用 11.mp4 静音（对话场景本身），配音走 Audio/食品卫生学调查/0-05.mp3。
 */
export const FH_SAMPLING_DIALOGUES: DialogueLine[] = [
  {
    "id": "0",
    "role": "采样人员",
    "gender": null,
    "text": "您好，我是食品药品监督管理局采样员-张峰，这是我的工作证件。",
    "audio": "/Audio/食品卫生学调查/0.mp3",
    "video": "/Video/11.mp4"
  },
  {
    "id": "1",
    "role": "酒店主管",
    "gender": null,
    "text": "您好，我是好运来酒店的大堂经理，我叫钱强。",
    "audio": "/Audio/食品卫生学调查/01.mp3",
    "video": "/Video/11.mp4"
  },
  {
    "id": "2",
    "role": "采样人员",
    "gender": null,
    "text": "请问，6月4日寿宴的剩菜是否留存?",
    "audio": "/Audio/食品卫生学调查/02.mp3",
    "video": "/Video/11.mp4"
  },
  {
    "id": "3",
    "role": "酒店主管",
    "gender": null,
    "text": "有留存，在储存柜中。",
    "audio": "/Audio/食品卫生学调查/03.mp3",
    "video": "/Video/11.mp4"
  },
  {
    "id": "4",
    "role": "采样人员",
    "gender": null,
    "text": "好的，我现在要采集剩余饭菜样品，请带我去厨房?",
    "audio": "/Audio/食品卫生学调查/04.mp3",
    "video": "/Video/11.mp4"
  },
  {
    "id": "5",
    "role": "酒店主管",
    "gender": null,
    "text": "好的，这边请。",
    "audio": "/Audio/食品卫生学调查/05.mp3",
    "video": "/Video/11.mp4"
  }
]

/** 后厨采样结束、进入「从业人员采样」后，视频13 同步的采样对话（语音文档第 10、11 条）：
 *  * 采样人员 张峰 ↔ 后厨人员，共 2 句；背景循环用 13.mp4 静音（访谈场景），配音走 10/11.mp3。
 *  * 注：语音表第 10 条角色列为空，按负责人截图确认为「采样人员」。
 */
export const FH_PRACTITIONER_DIALOGUES: DialogueLine[] = [
  {
    "id": "10",
    "role": "采样人员",
    "gender": null,
    "text": "您好，我是食品药品监督管理局采样员张峰。接下来将要对你进行采样生物样本，请放轻松，请不要紧张。",
    "audio": "/Audio/食品卫生学调查/10.mp3",
    "video": "/Video/13.mp4"
  },
  {
    "id": "11",
    "role": "后厨人员",
    "gender": null,
    "text": "好的",
    "audio": "/Audio/食品卫生学调查/11.mp3",
    "video": "/Video/13.mp4"
  }
]
