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
