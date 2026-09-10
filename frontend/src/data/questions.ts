// 该文件由 scripts/extract_questions.py 从
// 《食品致病性微生物污染事件_选择题.xlsx》自动生成，请勿手改。
// 更新题库后重跑脚本即可。

export type QuizType = 'single' | 'multiple'

export interface QuizOption {
  /** 选项字母 A-F */
  key: string
  text: string
}

export interface QuizQuestion {
  /** 题号，如 H_01 */
  id: string
  /** single=单选，multiple=多选 */
  type: QuizType
  question: string
  options: QuizOption[]
  /** 正确选项字母集合；单选 1 个，多选多个 */
  answerKeys: string[]
  /** 评分说明，如“答对得全分，答错不得分” */
  scoring?: string
  /** 答案解析 */
  analysis?: string
}

export const QUESTIONS: QuizQuestion[] = [
  {
    "id": "H_01",
    "type": "single",
    "question": "如果您是接诊医生，您觉得现在最应该做什么?",
    "options": [
      {
        "key": "A",
        "text": "向医院院长报告"
      },
      {
        "key": "B",
        "text": "找其他医生来帮忙"
      },
      {
        "key": "C",
        "text": "向当地食品安全监督管理、卫生行政部门报告情况"
      },
      {
        "key": "D",
        "text": "联系患者所在社区或单位"
      },
      {
        "key": "E",
        "text": "联系酒店"
      }
    ],
    "answerKeys": [
      "C"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_02",
    "type": "multiple",
    "question": "如果你是CDC的值班医师，你应该了解哪些情况?",
    "options": [
      {
        "key": "A",
        "text": "报告人的姓名，电话及联系方式"
      },
      {
        "key": "B",
        "text": "中毒人数，发病时间"
      },
      {
        "key": "C",
        "text": "住院情况，主要临床症状"
      },
      {
        "key": "D",
        "text": "患者有否共同聚餐经历"
      },
      {
        "key": "E",
        "text": "患者认为自己因何得病"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_03",
    "type": "single",
    "question": "如果你是区市场监督管理局接到报案(或卫生行政部门应急值班室)值班人员，记录",
    "options": [
      {
        "key": "A",
        "text": "向单位分管领导汇报"
      },
      {
        "key": "B",
        "text": "向上级单位报告"
      },
      {
        "key": "C",
        "text": "向当地卫生行政部门报告"
      },
      {
        "key": "D",
        "text": "马上去市中心医院"
      },
      {
        "key": "E",
        "text": "马上去H酒店"
      }
    ],
    "answerKeys": [
      "A"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_04",
    "type": "multiple",
    "question": "如果你是CDC的尤主任，接到报案后，需要如何做?",
    "options": [
      {
        "key": "A",
        "text": "上报区食品药品监督管理局相关领导"
      },
      {
        "key": "B",
        "text": "上报区卫健委相关领导"
      },
      {
        "key": "C",
        "text": "上报区人民政府"
      },
      {
        "key": "D",
        "text": "直接奔赴市中心医院"
      },
      {
        "key": "E",
        "text": "马上去H酒店"
      }
    ],
    "answerKeys": [
      "A",
      "B"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_05",
    "type": "multiple",
    "question": "食品安全事故调查组由哪些部分组成?",
    "options": [
      {
        "key": "A",
        "text": "调查机构负责人"
      },
      {
        "key": "B",
        "text": "食药监管人员"
      },
      {
        "key": "C",
        "text": "流行病学调查人员"
      },
      {
        "key": "D",
        "text": "实验室检测人员"
      },
      {
        "key": "E",
        "text": "消杀人员"
      },
      {
        "key": "F",
        "text": "有关支持部门负责人"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_06",
    "type": "multiple",
    "question": "现场流行病学调查步骤一般包括那些?",
    "options": [
      {
        "key": "A",
        "text": "核实诊断"
      },
      {
        "key": "B",
        "text": "制定病例定义"
      },
      {
        "key": "C",
        "text": "病例搜索"
      },
      {
        "key": "D",
        "text": "个案调查"
      },
      {
        "key": "E",
        "text": "描述性流行病学分析"
      },
      {
        "key": "F",
        "text": "分析性流行病学研究"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_07",
    "type": "multiple",
    "question": "描述性流行病学分析包括哪些方面内容?",
    "options": [
      {
        "key": "A",
        "text": "临床特征"
      },
      {
        "key": "B",
        "text": "时间分布"
      },
      {
        "key": "C",
        "text": "地区分布"
      },
      {
        "key": "D",
        "text": "人群分布"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_08",
    "type": "multiple",
    "question": "食品卫生学调查主要包括哪几方面内容?",
    "options": [
      {
        "key": "A",
        "text": "访谈相关人员"
      },
      {
        "key": "B",
        "text": "查阅相关记录"
      },
      {
        "key": "C",
        "text": "现场勘查"
      },
      {
        "key": "D",
        "text": "样本采集"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_09",
    "type": "multiple",
    "question": "采样前，可查阅哪些相关记录?",
    "options": [
      {
        "key": "A",
        "text": "可疑食品进货记录、可疑餐次的食谱或可疑食品的配方"
      },
      {
        "key": "B",
        "text": "生产加工工艺流程图、生产车间平面布局图"
      },
      {
        "key": "C",
        "text": "生产加工过程关键环节时间、温度"
      },
      {
        "key": "D",
        "text": "设备维修、清洁、消毒记录"
      },
      {
        "key": "E",
        "text": "食品加工人员的出勤记录、可疑食品销售和分配记录"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_10",
    "type": "multiple",
    "question": "采样时应记录哪些内容?",
    "options": [
      {
        "key": "A",
        "text": "采样时间"
      },
      {
        "key": "B",
        "text": "采样地点"
      },
      {
        "key": "C",
        "text": "采样数量"
      },
      {
        "key": "D",
        "text": "采样人"
      },
      {
        "key": "E",
        "text": "被采样人或被采样单位签字"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_11",
    "type": "multiple",
    "question": "可采集的生物样本有哪些?",
    "options": [
      {
        "key": "A",
        "text": "粪便(肛拭子)"
      },
      {
        "key": "B",
        "text": "血液"
      },
      {
        "key": "C",
        "text": "尿液"
      },
      {
        "key": "D",
        "text": "呕吐物"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_12",
    "type": "single",
    "question": "实验中检出金黄色葡萄球菌和沙门菌这两种致病菌(见上表)。基于上述资料，你认为导致这起暴发的致病因子是由什么引起的?",
    "options": [
      {
        "key": "A",
        "text": "沙门氏菌"
      },
      {
        "key": "B",
        "text": "脉冲场凝胶电泳"
      },
      {
        "key": "C",
        "text": "沙门氏菌和金黄色葡萄球菌混合"
      },
      {
        "key": "D",
        "text": "大肠埃希氏菌"
      }
    ],
    "answerKeys": [
      "A"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_17",
    "type": "single",
    "question": "根据微生物检验结果，为判定同种可疑致病微生物的同源性，还需要做何检测?",
    "options": [
      {
        "key": "A",
        "text": "荧光定量PCR"
      },
      {
        "key": "B",
        "text": "脉冲场凝胶电泳"
      },
      {
        "key": "C",
        "text": "显微镜镜检法"
      },
      {
        "key": "D",
        "text": "微生物测试片检测技术"
      }
    ],
    "answerKeys": [
      "B"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_18",
    "type": "single",
    "question": "你认为引起食物中毒的可疑食物是什么?",
    "options": [
      {
        "key": "A",
        "text": "素炒粉干"
      },
      {
        "key": "B",
        "text": "白灼菜心"
      },
      {
        "key": "C",
        "text": "水果拼盘"
      },
      {
        "key": "D",
        "text": "幸福煲仔"
      },
      {
        "key": "E",
        "text": "清蒸鸦片鱼"
      }
    ],
    "answerKeys": [
      "A"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_19",
    "type": "multiple",
    "question": "食品安全事故调查结论包括那些?",
    "options": [
      {
        "key": "A",
        "text": "是否定性为食品安全事故"
      },
      {
        "key": "B",
        "text": "事故范围"
      },
      {
        "key": "C",
        "text": "发病人数"
      },
      {
        "key": "D",
        "text": "致病因子"
      },
      {
        "key": "E",
        "text": "污染食品及污染原因"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_20",
    "type": "multiple",
    "question": "做出调查结论的依据包括那些?",
    "options": [
      {
        "key": "A",
        "text": "现场流行病学调查"
      },
      {
        "key": "B",
        "text": "食品违法行为"
      },
      {
        "key": "C",
        "text": "实验室检验"
      },
      {
        "key": "D",
        "text": "是否有死亡病例"
      },
      {
        "key": "E",
        "text": "食品卫生学调查"
      }
    ],
    "answerKeys": [
      "A",
      "C",
      "E"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_21",
    "type": "multiple",
    "question": "在确定致病因子、致病食品或污染原因等时，应当参照相关诊断标准或规范，并参考哪些推论原则?",
    "options": [
      {
        "key": "A",
        "text": "现场流行病学调查结果、食品卫生学调查结果和实验室检验结果相互支持的，调查组可以做出调查结论。"
      },
      {
        "key": "B",
        "text": "现场流行病学调查结果得到食品卫生学调查或实验室检验结果之一支持的，如结果具有合理性且能够解释大部分病例的，调查组可以做出调查结论。"
      },
      {
        "key": "C",
        "text": "现场流行病学调查结果未得到食品卫生学调查和实验室检验结果支持，但现场流行病学调查结果可以判定致病因子范围、致病餐次或致病食品，经调查机构专家组3名以上具有高级职称的专家审定，可以做出调查结论。"
      },
      {
        "key": "D",
        "text": "现场流行病学调查、食品卫生学调查和实验室检验结果不能支持事故定性的，应当做出相应调查结论并说明原因。"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  },
  {
    "id": "H_22",
    "type": "multiple",
    "question": "调查结论中因果推论应当考虑哪些因素?",
    "options": [
      {
        "key": "A",
        "text": "关联的时间顺序：可疑食品进食在前，发病在后"
      },
      {
        "key": "B",
        "text": "关联的特异性：病例均进食过可疑食品，未进食者均未发病"
      },
      {
        "key": "C",
        "text": "关联的强度：OR值或RR值越大，可疑食品与事故的因果关联性越大"
      },
      {
        "key": "D",
        "text": "剂量反应关系：进食可疑食品的数量越多，发病的危险性越高"
      },
      {
        "key": "E",
        "text": "关联的一致性:病例临床表现与检出的致病因子所致疾病的临床表现一致，或病例生物标本与可疑食品或相关的环境样品中检出的致病因子相同"
      },
      {
        "key": "F",
        "text": "终止效应:停止食用可疑食品或采取针对性的控制措施后，经过疾病的一个最长潜伏期后没有新发病例。"
      }
    ],
    "answerKeys": [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F"
    ],
    "scoring": "答对得全分，答错不得分",
    "analysis": ""
  }
]

/** 按题号取题，未找到返回 undefined */
export function getQuestionById(id: string): QuizQuestion | undefined {
  return QUESTIONS.find((q) => q.id === id)
}
