import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import StageLayout from '../components/layout/StageLayout'
import Header from '../components/Header'
import AiCompanionModal from '../components/player/AiCompanionModal'
import ExitConfirmModal from '../components/player/ExitConfirmModal'
import QuizRail from '../components/player/QuizRail'
import TaskListModal from '../components/player/TaskListModal'
import {
  MODULE_FIRST_STEP,
  discardSession,
  makeStepGuard,
  markDone,
  markStudying,
  readProgress,
} from '../lib/moduleProgress'
import './EpidemiologyPlayer.css'
import './LabTestingPlayer.css'

/* ------------------------------------------------------------------ *
 * 实验室检测模块 · 样品处理操作链
 *
 *   watch17       查看实验视频 17.mp4（原生控制条，下一步 / 退出视频；徽标「查看实验视频」）
 *   play01        下一步播 01.mp4，同步讲解音 7.mp3
 *   tools         01 播完：右侧 10 件道具栏，提示「把缓冲蛋白胨水(BPW)放至秤上」
 *                            → 点道具栏 BPW
 *   op02          播 02.mp4（BPW 上秤，末值 362.00g），道具栏常驻
 *   tareWait      02 末帧：画面自带「请点击归零」红箭头引导，叠加秤面橙色 Tare 钮热区 → 点热区
 *   op03          播 03.mp4（归零 0.00g），道具栏常驻
 *   pickFoodWait  03 末帧：提示「点击食品样品」+ 音效 8.mp3 → 点道具栏「食品样品」
 *   op04          播 04.mp4（食品样品投入 BPW），道具栏常驻
 *   pickHomoWait  04 末帧：提示「点击匀质机」→ 点道具栏「匀质机」
 *   op05          播 05.mp4（匀质机就位），同步音效 9.mp3
 *   handleWait    05 末帧：叠「把手.png」红色把手闪烁特写 + 提示「请点击红色区域」
 *                            → 点红色区域（匀质机门锁把手）
 *   op06          播 06.mp4（压下把手、门打开）
 *   bpwWait       06 末帧：提示「点击画面中的 BPW」→ 点画面左侧 BPW 烧杯
 *   op07          播 07.mp4（BPW 倒入匀质机）
 *   incubatorWait 07 末帧：提示「点击道具栏的隔水式恒温培养箱」→ 点道具栏「培养箱」
 *   op08          播 08.mp4（培养箱就位 / 开关），同步音效 10.mp3
 *   switchP1Wait  08 末帧：提示「点击面板上的开关」→ 点控制面板 ON/OFF 翘板开关
 *   op09          播 09.mp4（开关闭合）
 *   okWait        09 末帧：画面自带「样品处理完成」对话框（蓝「确定」）→ 点「确定」热区
 *   op10          播 10.mp4，同步音效 11.mp3；**徽标由「样品处理」改为「增菌培养」**
 *   scTtbWait     10 末帧：提示「点击 SC 增菌液和 TTB 增菌液」→ 点道具栏两件（须都点到）
 *   op11          播 11.mp4，同步音效 12.mp3
 *   pipetteWait   11 末帧：提示「点击移液枪」→ 点画面中第 4 支（最右 1mL）移液枪
 *   op12          播 12.mp4，同步音效 13.mp3，并显示底部提示（接种说明）
 *   incubator2Wait 12 末帧：提示「点击道具栏的隔水式恒温培养箱」→ 点道具栏「培养箱」
 *   op13_1        播 13.1.mp4，同步音效 14.mp3
 *   switchP2Wait  13.1 末帧：提示「点击面板上的开关」→ 点控制面板 ON/OFF 翘板开关
 *   op13_2        播 13.2.mp4
 *   endWait       13.2 末帧：画面自带「开始培养。+ 继续」→ 点「继续」热区 → op13_4
 *   op13_4        播 13.4.mp4
 *   switchP3Wait  13.4 末帧：提示「点击面板上的开关」→ 点控制面板 ON/OFF 翘板开关
 *   op14          播 14.mp4
 *   go2Wait       14 末帧：提示「点击「继续」」→ 点「继续」热区 → op15
 *   op15          播 15.mp4（24 小时后观察增菌培养液）
 *   ok2Wait       15 末帧：对话框蓝色「确定」→ 点「确定」热区 → op16
 *   op16          播 16.mp4，同步音效 15.mp3（增菌培养完成）
 *   ok3Wait       16 末帧：对话框蓝色「确定」→ 点「确定」热区 → op17
 *   op17          播 17.mp4，同步音效 16.mp3；**徽标改「分离培养」**
 *   alcoholWait   17 末帧：提示「点击「酒精灯」」→ 点画面台面上的酒精灯 → op18
 *   op18          播 18.mp4，同步音效 17.mp3（酒精灯点燃）
 *   pickLoopWait  18 末帧：提示「点击道具栏的「接种环」」→ 点道具栏 → op19
 *   op19          播 19.mp4，同步音效 18.mp3
 *   go3Wait       19 末帧：「继续」气泡 → 点「继续」热区 → op20
 *   op20          播 20.mp4，同步音效 19.mp3
 *   go4Wait       20 末帧：「继续」气泡 → 点「继续」热区 → op21
 *   op21          播 21.mp4
 *   incubator3Wait 21 末帧：提示「点击道具栏的「隔水式恒温培养箱」」→ 点道具栏 → op22
 *   op22          播 22.mp4
 *   switchP4Wait  22 末帧：面板 ON/OFF 开关（与 08 同位，复用 SWITCH_HOTSPOT）→ 点开关 → op23
 *   op23          播 23.mp4
 *   go5Wait       23 末帧：「继续」气泡 → 点「继续」热区 → op24
 *   op24          播 24.mp4
 *   ok4Wait       24 末帧：对话框蓝「确定」→ 点「确定」热区 → op25
 *   op25          播 25.mp4，同步音效 20+21.mp3；**徽标改「鉴定-1」**
 *   pickTsiWait   25 末帧：提示「点击「三糖铁（TSI）琼脂」」→ 点道具栏 → op26
 *   op26          播 26.mp4
 *   incubator4Wait 26 末帧：提示「点击道具栏的「隔水式恒温培养箱」」→ 点道具栏 → op27
 *   op27          播 27.mp4
 *   switchP5Wait  27 末帧：面板 ON/OFF 开关（**27 的开关不在 08 的位置**，用 SWITCH_HOTSPOT_27）
 *   op28          播 28.mp4
 *   go6Wait       28 末帧：「继续」气泡 → 点「继续」热区 → op29
 *   op29          播 29.mp4，同步音效 22.mp3
 *   ok5Wait       29 末帧：对话框蓝「确定」→ op30
 *   op30          播 30.mp4
 *   ok6Wait       30 末帧：对话框蓝「确定」→ op31
 *   op31          播 31.mp4，同步音效 23+29.mp3；**徽标改「鉴定-2」**
 *   ok7Wait       31 末帧：对话框蓝「确定」→ op32
 *   op32          播 32.mp4
 *   pickDishWait  32 末帧：提示「点击道具栏的「平皿」」→ 点道具栏 → op33
 *   op33          播 33.mp4，同步音效 24.mp3
 *   pickLoop2Wait 33 末帧：提示「点击道具栏的「接种环」」→ 点道具栏 → op34
 *   op34          播 34.mp4
 *   pickSerumWait 34 末帧：提示「点击道具栏的「多价菌体（O）抗血清」」→ 点道具栏 → op35
 *   op35          播 35.mp4，同步音效 25.mp3
 *   salineWait    35 末帧：提示「点击桌面的「生理盐水」」→ 点画面台面上的生理盐水瓶 → op36
 *   op36          播 36.mp4，同步音效 26.mp3
 *   ok8Wait       36 末帧：对话框蓝「确定」→ op37
 *   op37          播 37.mp4
 *   ok9Wait       37 末帧：对话框蓝「确定」→ op38
 *   op38          播 38.mp4，同步音效 27+28.mp3；**徽标改「鉴定-3」**
 *   ok10Wait      38 末帧：对话框蓝按钮「**我已了解**」→ op39
 *   op39          播 39.mp4（此段**只有画面，没有侧栏**）
 *   quizWait      39 **播完**停末帧（同一 video 元素不重挂），此时右侧才出现
 *                 「知识考核」侧栏（H_12 / H_17 两题）并常驻待答
 *
 * 音频归属依据 docs/实验室检测_分步明细对照表.html（权威规格，与 AN文件/3实验室检测.fla
 *   根时间轴帧标签逐条同序对应）。三段「合成音档」：25.mp4←20+21.mp3、31.mp4←23+29.mp3、
 *   38.mp4←27+28.mp3（素材目录另有 20/21/23/27/28/29.mp3 单支版本，本页按规格用合成档）。
 *
 * 「待确认①」的落实（2026-09-18 负责人指定）：规格对照表末行 38.mp4 点「确定」后的去向
 *   原为待定，素材目录里的 39.mp4 / 40.mp4 未出现在对照表、也不在原 FLA 时间轴中。
 *   负责人现在给定：**38.mp4 末帧按钮为「我已了解」，点它 → 播 39.mp4，并在右侧显示
 *   选择题 H_13、H_14**（xlsx 行号；题库 id 为 H_12 / H_17，见 QUIZ_QIDS 注释）。
 *   39.mp4 自身末帧也带一个「我已了解」按钮（实测 [507..703, 776..836]）——它是否要接
 *   40.mp4 仍未定，故本页**不给它加热区**，考核完成后停在 quizWait。（40.mp4 是空 3D 场景。）
 *   39.mp4 未配 mp3：对照表未列该段，且其前一档 38.mp4 已播 27+28.mp3 合成音档。
 *
 * 13.x / 14 子镜头说明（2026-09-18 负责人在 13.2 之后追加 4 段，见下表）：
 *   **13.1 = 面板操作段（末帧只有温度提示条，停此帧点开关）**、
 *   **13.2 = 收尾段（末帧带「开始培养。/继续」气泡，停此帧点继续）**、
 *   **13.4 = 第二组面板操作段（末帧无气泡，停此帧点开关）**、
 *   **14   = 第二组收尾段（末帧带「继续」气泡，停此帧点继续）**。
 *   13.4 与 14 的真末帧控制面板与 08/13.1/13.2 **同位**（2026-09-18 实测复核：
 *   绿翘板 13.4=[580,510,613,551]、14=[582,508,613,551]，蓝显示屏同为 x≈146..335/y≈466..597），
 *   故 **复用 SWITCH_HOTSPOT / GO_HOTSPOT**，无需另取坐标。
 *   13.3（TTB 组）仍未使用。
 *
 * 底部提示胶囊：样品处理阶段（tools 起）容器始终保留且**始终可见**（无文案时为空胶囊，
 *   保持同一高度/位置，避免画面忽隐忽现）——2026-09-17 负责人明确要求。
 * 道具栏：tools 起常驻；每步仅当前目标道具可点。
 *   **不再做任何高亮**（2026-09-17 负责人明确要求：提示点击道具栏中物品不需要高亮），
 *   曾用的 --hot 蓝环与「已用道具高亮」一并移除，目标只靠底部文案指明。
 *   例外：scTtbWait 需**同时**点 SC 与 TTB 两件，两件都可点（同一阶段多目标）。
 * 全程：左上机器人+白胶囊徽标共 **7 段 6 个切换点**（规格「徽标分段」列）——
 *       查看17=「查看实验视频」→ 01~09=「样品处理」→ 10~16=「增菌培养」
 *       → **17~24=「分离培养」**（规格明确：17.mp4 改挂分离培养，与旧实现不同）
 *       → 25~30=「鉴定-1」→ 31~37=「鉴定-2」→ 38~39=「鉴定-3」（含 39.mp4 与其后的侧栏考核）；
 *       顶栏返回弯箭头（/lab-testing -> /case-study）随时退出。
 *
 * 左上角徽标是两个热区（与现场流行病学调查 / 食品卫生学调查同款，2026-09-18 接上）：
 *   机器人头像 → AI 学伴对话窗；胶囊文字 → 任务列表（本模块 7 段，当前段高亮，
 *   点其它段「重新开始 / 开始执行」跳到该段首个环节）。弹窗与阶段状态机解耦，
 *   任何阶段可开、关闭回原阶段；打开期间隐藏本页热区（它们 z 38~40 高于遮罩）
 *   并暂停正在播放的视频/配音，关闭后从暂停处续播，避免遮罩后默默推进链路。
 *
 * 音效归属依据原 Flash 工程 AN文件/3实验室检测.fla 时间轴（帧标签 + createjs.Sound.play）：
 *   428「点击匀质机」→ sy9 ｜ 561「点击培养箱跳下一帧」｜ 660「点击开关往后走帧」→ sy10
 *   766「点击确定」→ sy11 ｜ 836「点击SC增菌液和TTB增菌液」→ sy12 ｜ 988「点击移液枪」→ sy13
 *   1476「点击隔水式恒温培养器」→ sy14 ｜ 1592「点击开关」｜ 1618「点击继续」
 * 即 syN 对应「第 N-1 段操作视频」的音效，故 11/12/13/14.mp3 分别伴 10/11/12/13.1。
 * （该 FLA 中 sy8 落在 BPW 帧，与本项目「8.mp3 归食品样品」的口径不同，
 *   此处以需求方指定为准，若需回到 FLA 口径只改 PHASE_AUDIO 一行。）
 * 全部操作视频音轨实测为静音（Web Audio 峰值 0），故 mp3 与视频可同时播放、不会叠加。
 * ------------------------------------------------------------------ */

/**
 * 全链 41 步的阶段常量表 —— **同时充当断点校验白名单**（见下方 `isLabStep`）。
 *
 * 阶段类型由本表派生（`type LabPhase = (typeof LAB_PHASES)[number]`），于是
 * `makeStepGuard(LAB_PHASES)` 天然与类型定义**同源**：新增/改名阶段只改这一处，
 * 断点白名单不可能忘记同步（两处手抄迟早会漂移，脏断点会让续做跳错段）。
 * 顺序 = 链路播放顺序（watch17 为查看段，其后按操作视频编号），便于人工核对。
 */
const LAB_PHASES = [
  'watch17',
  'play01',
  'tools',
  'op02',
  'tareWait',
  'op03',
  'pickFoodWait',
  'op04',
  'pickHomoWait',
  'op05',
  'handleWait',
  'op06',
  'bpwWait',
  'op07',
  'incubatorWait',
  'op08',
  'switchP1Wait',
  'op09',
  'okWait',
  'op10',
  'scTtbWait',
  'op11',
  'pipetteWait',
  'op12',
  'incubator2Wait',
  'op13_1',
  'switchP2Wait',
  'op13_2',
  'endWait',
  'op13_4',
  'switchP3Wait',
  'op14',
  'go2Wait',
  'op15',
  'ok2Wait',
  'op16',
  'ok3Wait',
  'op17',
  'alcoholWait',
  'op18',
  'pickLoopWait',
  'op19',
  'go3Wait',
  'op20',
  'go4Wait',
  'op21',
  'incubator3Wait',
  'op22',
  'switchP4Wait',
  'op23',
  'go5Wait',
  'op24',
  'ok4Wait',
  'op25',
  'pickTsiWait',
  'op26',
  'incubator4Wait',
  'op27',
  'switchP5Wait',
  'op28',
  'go6Wait',
  'op29',
  'ok5Wait',
  'op30',
  'ok6Wait',
  'op31',
  'ok7Wait',
  'op32',
  'pickDishWait',
  'op33',
  'pickLoop2Wait',
  'op34',
  'pickSerumWait',
  'op35',
  'salineWait',
  'op36',
  'ok8Wait',
  'op37',
  'ok9Wait',
  'op38',
  'ok10Wait',
  'op39',
  'quizWait',
] as const

type LabPhase = (typeof LAB_PHASES)[number]

/** 会「自动播放操作视频」的阶段（键即操作视频编号） */
type OpPhase =
  | 'play01'
  | 'op02'
  | 'op03'
  | 'op04'
  | 'op05'
  | 'op06'
  | 'op07'
  | 'op08'
  | 'op09'
  | 'op10'
  | 'op11'
  | 'op12'
  | 'op13_1'
  | 'op13_2'
  | 'op13_4'
  | 'op14'
  | 'op15'
  | 'op16'
  | 'op17'
  | 'op18'
  | 'op19'
  | 'op20'
  | 'op21'
  | 'op22'
  | 'op23'
  | 'op24'
  | 'op25'
  | 'op26'
  | 'op27'
  | 'op28'
  | 'op29'
  | 'op30'
  | 'op31'
  | 'op32'
  | 'op33'
  | 'op34'
  | 'op35'
  | 'op36'
  | 'op37'
  | 'op38'
  | 'op39'

/** 操作讲解 / 提示配音 / 操作音效（Audio/实验室检测/） */
const NARRATE_7 = '/Audio/实验室检测/7.mp3' // 01 同步操作讲解
const EFFECT_8 = '/Audio/实验室检测/8.mp3' // 点击食品样品
const EFFECT_9 = '/Audio/实验室检测/9.mp3' // 点击匀质机（与 05 同时）
const EFFECT_10 = '/Audio/实验室检测/10.mp3' // 点击隔水式恒温培养箱（与 08 同时）
const EFFECT_11 = '/Audio/实验室检测/11.mp3' // 点击开关（与 10 同时）
const EFFECT_12 = '/Audio/实验室检测/12.mp3' // 点击 SC / TTB 增菌液（与 11 同时）
const EFFECT_13 = '/Audio/实验室检测/13.mp3' // 点击移液枪（与 12 同时）
const EFFECT_14 = '/Audio/实验室检测/14.mp3' // 点击隔水式恒温培养箱（与 13.1 同时）
const EFFECT_15 = '/Audio/实验室检测/15.mp3' // 点击「确定」（与 16 同时：增菌培养完成）
const EFFECT_16 = '/Audio/实验室检测/16.mp3' // 点击「确定」（与 17 同时）
// —— 分离培养 / 鉴定段（17.mp4 起，音效归属见 docs/实验室检测_分步明细对照表.html）——
const EFFECT_17 = '/Audio/实验室检测/17.mp3' // 点击酒精灯（与 18 同时）
const EFFECT_18 = '/Audio/实验室检测/18.mp3' // 点击接种环（与 19 同时）
const EFFECT_19 = '/Audio/实验室检测/19.mp3' // 点击「继续」（与 20 同时）
const EFFECT_22 = '/Audio/实验室检测/22.mp3' // 点击「确定」（与 29 同时）
const EFFECT_24 = '/Audio/实验室检测/24.mp3' // 点击接种环（与 33 同时）
const EFFECT_25 = '/Audio/实验室检测/25.mp3' // 点击生理盐水（与 35 同时）
const EFFECT_26 = '/Audio/实验室检测/26.mp3' // 点击「确定」（与 36 同时）
/** 三段「合成音档」：素材目录中与 20/21/23/27/28/29.mp3 单支版本并存，规格指定用合成档 */
const COMPOSITE_20_21 = '/Audio/实验室检测/20+21.mp3' // 与 25 同时（TSI 接种前讲解）
const COMPOSITE_23_29 = '/Audio/实验室检测/23+29.mp3' // 与 31 同时
const COMPOSITE_27_28 = '/Audio/实验室检测/27+28.mp3' // 与 38 同时（鉴定-3）

/** 操作视频（Video/操作视频/） */
const OP_SRC: Record<OpPhase, string> = {
  play01: '/Video/操作视频/01.mp4',
  op02: '/Video/操作视频/02.mp4',
  op03: '/Video/操作视频/03.mp4',
  op04: '/Video/操作视频/04.mp4',
  op05: '/Video/操作视频/05.mp4',
  op06: '/Video/操作视频/06.mp4',
  op07: '/Video/操作视频/07.mp4',
  op08: '/Video/操作视频/08.mp4',
  op09: '/Video/操作视频/09.mp4',
  op10: '/Video/操作视频/10.mp4',
  op11: '/Video/操作视频/11.mp4',
  op12: '/Video/操作视频/12.mp4',
  op13_1: '/Video/操作视频/13.1.mp4',
  op13_2: '/Video/操作视频/13.2.mp4',
  op13_4: '/Video/操作视频/13.4.mp4',
  op14: '/Video/操作视频/14.mp4',
  op15: '/Video/操作视频/15.mp4',
  op16: '/Video/操作视频/16.mp4',
  op17: '/Video/操作视频/17.mp4',
  op18: '/Video/操作视频/18.mp4',
  op19: '/Video/操作视频/19.mp4',
  op20: '/Video/操作视频/20.mp4',
  op21: '/Video/操作视频/21.mp4',
  op22: '/Video/操作视频/22.mp4',
  op23: '/Video/操作视频/23.mp4',
  op24: '/Video/操作视频/24.mp4',
  op25: '/Video/操作视频/25.mp4',
  op26: '/Video/操作视频/26.mp4',
  op27: '/Video/操作视频/27.mp4',
  op28: '/Video/操作视频/28.mp4',
  op29: '/Video/操作视频/29.mp4',
  op30: '/Video/操作视频/30.mp4',
  op31: '/Video/操作视频/31.mp4',
  op32: '/Video/操作视频/32.mp4',
  op33: '/Video/操作视频/33.mp4',
  op34: '/Video/操作视频/34.mp4',
  op35: '/Video/操作视频/35.mp4',
  op36: '/Video/操作视频/36.mp4',
  op37: '/Video/操作视频/37.mp4',
  op38: '/Video/操作视频/38.mp4',
  op39: '/Video/操作视频/39.mp4',
}

/** 会自动播放操作视频的阶段（= OP_SRC 的键集，单一来源，避免清单漂移） */
const OP_PLAY_PHASES: OpPhase[] = Object.keys(OP_SRC) as OpPhase[]

const isOpPlay = (p: LabPhase): p is OpPhase => (OP_PLAY_PHASES as LabPhase[]).includes(p)

/** 等待阶段沿用「上一段操作视频」并停在末帧（不换源、不重挂，保持同一 video 元素） */
const WAIT_REUSES: Partial<Record<LabPhase, OpPhase>> = {
  tools: 'play01',
  tareWait: 'op02',
  pickFoodWait: 'op03',
  pickHomoWait: 'op04',
  handleWait: 'op05',
  bpwWait: 'op06',
  incubatorWait: 'op07',
  switchP1Wait: 'op08',
  okWait: 'op09',
  scTtbWait: 'op10',
  pipetteWait: 'op11',
  incubator2Wait: 'op12',
  switchP2Wait: 'op13_1',
  endWait: 'op13_2',
  switchP3Wait: 'op13_4',
  go2Wait: 'op14',
  ok2Wait: 'op15',
  ok3Wait: 'op16',
  // —— 分离培养 / 鉴定-1 / 鉴定-2 / 鉴定-3（17.mp4 起，规格序号 20–41）——
  alcoholWait: 'op17',
  pickLoopWait: 'op18',
  go3Wait: 'op19',
  go4Wait: 'op20',
  incubator3Wait: 'op21',
  switchP4Wait: 'op22',
  go5Wait: 'op23',
  ok4Wait: 'op24',
  pickTsiWait: 'op25',
  incubator4Wait: 'op26',
  switchP5Wait: 'op27',
  go6Wait: 'op28',
  ok5Wait: 'op29',
  ok6Wait: 'op30',
  ok7Wait: 'op31',
  pickDishWait: 'op32',
  pickLoop2Wait: 'op33',
  pickSerumWait: 'op34',
  salineWait: 'op35',
  ok8Wait: 'op36',
  ok9Wait: 'op37',
  ok10Wait: 'op38',
  // 39.mp4 播完停末帧：与 op39 共用同一 video 元素（不换源、不重挂），侧栏考核在此期间常驻
  quizWait: 'op39',
}

/** 操作视频元素需挂载的阶段（播放阶段 + 其后停末帧的等待阶段） */
const OP_VIDEO_PHASES: LabPhase[] = [...OP_PLAY_PHASES, ...(Object.keys(WAIT_REUSES) as LabPhase[])]

/* ------------------------------------------------------------------ *
 * 学习进度（断点续做）—— 与 moduleProgress 存储层对接
 *
 * 负责人 2026-09-18：点进模块即「学习中」、走到终点才是「已学习」，
 * 中途返回则下次点击进来要**继续上次的进度**（步骤级，不恢复视频秒数）。
 * ------------------------------------------------------------------ */

const MODULE_ID = 'lab-testing' as const
/** 本模块第一步（首次进入 / 「重新学习」的起点，也是断点非法时的兜底） */
const FIRST_STEP = MODULE_FIRST_STEP[MODULE_ID] as LabPhase
/** 断点校验：白名单即 LAB_PHASES，与类型定义同源，脏数据/旧版本残留一律判为无断点 */
const isLabStep = makeStepGuard(LAB_PHASES)

/**
 * 断点 → **恢复时的起步阶段**。
 *
 * 等待阶段（`tools` / `switchP1Wait` / `bpwWait` …）本身是「上一段操作视频停在末帧」
 * 的状态：视频元素靠 `autoPlay` 起播，直接落进等待阶段会让该段视频**从头重播**，
 * 而点击光圈/热区一挂载就亮 —— 学员还没看到操作就被引着点掉，语义上也不像
 * 「回到该步骤开头重播」。
 *
 * 故等待阶段一律**回退到它复用的那段操作视频**（见 WAIT_REUSES）：
 * 从该段开头重播 → 播完自然落到同一个等待阶段，与第一次走这段时的体验完全一致。
 * 非等待阶段（操作播放段 / watch17 查看段）本身就是该步的开头，原样返回。
 */
const resumePhaseOf = (step: string | null | undefined): LabPhase =>
  isLabStep(step) ? (WAIT_REUSES[step] ?? step) : FIRST_STEP

/**
 * 「知识考核」**整段**：38.mp4 点「我已了解」→ 播 39.mp4 → 其末帧停留待答。
 *
 * 这两段右侧都不出道具栏、底部不出提示胶囊（提示改由侧栏自身承载）。
 * ⚠ 注意区分：本常量是「考核**阶段全集**」（用于排除道具栏 / 徽标分段），
 *   **不是**「侧栏渲染时机」—— 侧栏只在 `QUIZ_RAIL_PHASES` 渲染。
 */
const QUIZ_PHASES: LabPhase[] = ['op39', 'quizWait']

/**
 * 「知识考核」侧栏**实际渲染**的阶段 —— **只有 `quizWait`**。
 *
 * 负责人 2026-09-18：「视频 39.mp4 播放完再显示选择题」——
 * 故 `op39`（39.mp4 播放中）**不渲染** `QuizRail`，等视频 `ended` 进入 `quizWait` 才挂载。
 *
 * 副作用（正向）：
 *   · 39.mp4 开头 0~0.7s 的 PFGE 说明框（硬边框右缘实测 x1498）不再被 630 宽侧栏压住
 *     —— 原先「保持 630 宽 vs 压说明框」的取舍**随之消失**，全程零遮挡；
 *   · 学员先完整看一遍操作演示，再作答，顺序更贴合教学设计。
 * 另：`.lab-quiz-rail` 无入场动画（CSS 只有 `[data-hidden]` 显隐），故挂载即全不透明，
 *   晚 0.7s 挂载不会产生「半透明滑入」的中间态。
 */
const QUIZ_RAIL_PHASES: LabPhase[] = ['quizWait']

/**
 * 「鉴定-3」收尾段的**全部阶段**（与 `BADGE_TIERS` 末段一致，改分段时两处同步）。
 *
 * 负责人 2026-09-17：**鉴定-3 的阶段不用显示道具栏** ——
 * 本段已无任何道具点击需求（唯一的画面交互是 38 末帧的「我已了解」），
 * 38.mp4 起画面需满宽展示，39.mp4 起右侧又要让位给知识考核侧栏。
 */
const FINAL_STAGE_PHASES: LabPhase[] = ['op38', 'ok10Wait', ...QUIZ_PHASES]

/**
 * 道具栏常驻阶段（tools 起，贯穿整条实验室检测操作链；01 播放中尚无道具栏）。
 * ⚠ 必须排除 **FINAL_STAGE_PHASES 全部**（四个阶段都在 OP_VIDEO_PHASES 里）：
 *   · op39 / quizWait 与道具栏同为右侧浮窗且 z-index 都是 30，同时渲染会互相压盖
 *     （quizWait 曾被漏掉 → 道具栏在侧栏背后重复渲染，只是看不见）；
 *   · op38 / ok10Wait 按负责人要求「鉴定-3 整段不出道具栏」。
 */
const RAIL_PHASES: LabPhase[] = OP_VIDEO_PHASES.filter(
  (p) => p !== 'play01' && !FINAL_STAGE_PHASES.includes(p),
)

/**
 * 侧栏考核题目 id（**题库 `questions.ts` 的 id，不是《选择题.xlsx》的行号**）。
 *
 * ⚠ 两套编号有偏移，负责人说的「H_13、H_14」是 xlsx 行号，对应到题库里是 H_12 / H_17：
 *   · xlsx H_13「实验中检出金黄色葡萄球菌和沙门菌…致病因子由什么引起」→ 题库 **H_12**（单选，答案 A）
 *   · xlsx H_14「…为判定同种可疑致病微生物的同源性，还需要做何检测」→ 题库 **H_17**（单选，答案 B）
 *   题库里根本不存在 id 为 H_13 / H_14 的题目（id 从 H_12 直接跳到 H_17），
 *   故只能按**题干文字**对齐，不能按 id 直接取。改动前务必比对题干。
 */
const QUIZ_QIDS = ['H_12', 'H_17']

/** 每个等待阶段「当前可点击的目标道具」；scTtbWait 为**多目标**（须全部点到才前进） */
const PICK_TARGETS: Partial<Record<LabPhase, string[]>> = {
  tools: ['bpw'],
  pickFoodWait: ['food-sample'],
  pickHomoWait: ['homogenizer'],
  incubatorWait: ['incubator'],
  scTtbWait: ['sc-broth', 'ttb-broth'],
  incubator2Wait: ['incubator'],
  pickLoopWait: ['inoculating-loop'],
  incubator3Wait: ['incubator'],
  pickTsiWait: ['tsi-agar'],
  incubator4Wait: ['incubator'],
  pickDishWait: ['petri-dish'],
  pickLoop2Wait: ['inoculating-loop'],
  pickSerumWait: ['o-antiserum'],
}

/** 阶段 → 操作视频（点道具栏后进入哪一段） */
const PICK_NEXT: Partial<Record<LabPhase, Partial<Record<string, LabPhase>>>> = {
  tools: { bpw: 'op02' },
  pickFoodWait: { 'food-sample': 'op04' },
  pickHomoWait: { homogenizer: 'op05' },
  incubatorWait: { incubator: 'op08' },
  scTtbWait: { 'sc-broth': 'op11', 'ttb-broth': 'op11' }, // 两件都点中后才前进
  incubator2Wait: { incubator: 'op13_1' },
  pickLoopWait: { 'inoculating-loop': 'op19' },
  incubator3Wait: { incubator: 'op22' },
  pickTsiWait: { 'tsi-agar': 'op26' },
  incubator4Wait: { incubator: 'op27' },
  pickDishWait: { 'petri-dish': 'op33' },
  pickLoop2Wait: { 'inoculating-loop': 'op34' },
  pickSerumWait: { 'o-antiserum': 'op35' },
}

/** 各引导阶段底部提示胶囊文案（无键则不显示文案，但胶囊容器始终可见） */
const HINT_TEXT: Partial<Record<LabPhase, string>> = {
  tools: '提示：把缓冲蛋白胨水（BPW）放至秤上',
  pickFoodWait: '提示：点击食品样品',
  pickHomoWait: '提示：点击匀质机',
  handleWait: '提示：请点击红色区域',
  bpwWait: '提示：点击画面中的 BPW',
  incubatorWait: '提示：点击道具栏的隔水式恒温培养箱',
  switchP1Wait: '提示：点击面板上的开关',
  okWait: '提示：点击「确定」继续',
  scTtbWait: '提示：点击SC增菌液和TTB增菌液',
  pipetteWait: '提示：点击移液枪',
  // [img4]：12.mp4 播放期间的接种说明。原文措辞待负责人确认，仅此一处文案常量。
  op12: '提示：用移液枪吸取菌液，分别接种至SC增菌液与TTB增菌液中',
  incubator2Wait: '提示：点击道具栏的隔水式恒温培养箱',
  switchP2Wait: '提示：点击面板上的开关',
  endWait: '提示：点击「继续」',
  // —— 13.2 之后追加的 4 段（2026-09-18 负责人指定） ——
  switchP3Wait: '提示：点击面板上的开关',
  go2Wait: '提示：点击「继续」',
  ok2Wait: '提示：点击「确定」继续',
  ok3Wait: '提示：点击「确定」继续',
  // —— 分离培养 / 鉴定段（规格序号 20–41）——
  alcoholWait: '提示：点击「酒精灯」',
  pickLoopWait: '提示：点击道具栏的「接种环」',
  go3Wait: '提示：点击「继续」',
  go4Wait: '提示：点击「继续」',
  incubator3Wait: '提示：点击道具栏的「隔水式恒温培养箱」',
  switchP4Wait: '提示：点击面板上的开关',
  go5Wait: '提示：点击「继续」',
  ok4Wait: '提示：点击「确定」',
  pickTsiWait: '提示：点击「三糖铁（TSI）琼脂」',
  incubator4Wait: '提示：点击道具栏的「隔水式恒温培养箱」',
  switchP5Wait: '提示：点击面板上的开关',
  go6Wait: '提示：点击「继续」',
  ok5Wait: '提示：点击「确定」',
  ok6Wait: '提示：点击「确定」',
  ok7Wait: '提示：点击「确定」',
  pickDishWait: '提示：点击道具栏的「平皿」',
  pickLoop2Wait: '提示：点击道具栏的「接种环」',
  pickSerumWait: '提示：点击道具栏的「多价菌体（O）抗血清」',
  salineWait: '提示：点击桌面的「生理盐水」',
  ok8Wait: '提示：点击「确定」',
  ok9Wait: '提示：点击「确定」',
  ok10Wait: '提示：点击「我已了解」',
  // —— 鉴定-3 收尾：39.mp4 播完（quizWait）才出侧栏 ——
  // ⚠ `op39` **刻意不给文案**：该段侧栏尚未出现（负责人 2026-09-18「播完再显示选择题」），
  //   若沿旧文案「请完成右侧知识考核」会指向一个还不存在的对象。
  //   与其余纯播放段（op03…op11 等）一致：只保留空胶囊容器。
  quizWait: '提示：请完成右侧知识考核',
}

/** 各阶段配音 / 操作音效：进入即播（覆盖前一条）；无键则停掉正在响的配音 */
const PHASE_AUDIO: Partial<Record<LabPhase, string>> = {
  play01: NARRATE_7,
  pickFoodWait: EFFECT_8,
  op05: EFFECT_9,
  op08: EFFECT_10,
  op10: EFFECT_11,
  op11: EFFECT_12,
  op12: EFFECT_13,
  op13_1: EFFECT_14,
  op16: EFFECT_15,
  op17: EFFECT_16,
  // —— 分离培养 / 鉴定段（规格序号 20–41）——
  op18: EFFECT_17,
  op19: EFFECT_18,
  op20: EFFECT_19,
  op25: COMPOSITE_20_21,
  op29: EFFECT_22,
  op31: COMPOSITE_23_29,
  op33: EFFECT_24,
  op35: EFFECT_25,
  op36: EFFECT_26,
  op38: COMPOSITE_27_28,
}

/**
 * 左上角徽标文案分段（规格「徽标分段」列：7 段 / 6 个切换点）。
 * 切换点分别在 01.mp4、10.mp4、**17.mp4**、25.mp4、31.mp4、38.mp4 起。
 * 注意：规格明确 **17.mp4（序号 20）改挂「分离培养」**——此处与旧实现（op17 仍属增菌培养）不同。
 */
const BADGE_TIERS: { label: string; phases: LabPhase[] }[] = [
  {
    label: '样品处理',
    phases: [
      'play01', 'tools',
      'op02', 'tareWait',
      'op03', 'pickFoodWait',
      'op04', 'pickHomoWait',
      'op05', 'handleWait',
      'op06', 'bpwWait',
      'op07', 'incubatorWait',
      'op08', 'switchP1Wait',
      'op09', 'okWait',
    ],
  },
  {
    label: '增菌培养',
    phases: [
      'op10', 'scTtbWait',
      'op11', 'pipetteWait',
      'op12', 'incubator2Wait',
      'op13_1', 'switchP2Wait',
      'op13_2', 'endWait', 'op15',
      'op13_4', 'switchP3Wait',
      'op14', 'go2Wait',
      'ok2Wait', 'op16', 'ok3Wait',
    ],
  },
  {
    label: '分离培养',
    phases: [
      'op17', 'alcoholWait',
      'op18', 'pickLoopWait',
      'op19', 'go3Wait',
      'op20', 'go4Wait',
      'op21', 'incubator3Wait',
      'op22', 'switchP4Wait',
      'op23', 'go5Wait',
      'op24', 'ok4Wait',
    ],
  },
  {
    label: '鉴定-1',
    phases: [
      'op25', 'pickTsiWait',
      'op26', 'incubator4Wait',
      'op27', 'switchP5Wait',
      'op28', 'go6Wait',
      'op29', 'ok5Wait',
      'op30', 'ok6Wait',
    ],
  },
  {
    label: '鉴定-2',
    phases: [
      'op31', 'ok7Wait',
      'op32', 'pickDishWait',
      'op33', 'pickLoop2Wait',
      'op34', 'pickSerumWait',
      'op35', 'salineWait',
      'op36', 'ok8Wait',
      'op37', 'ok9Wait',
    ],
  },
  {
    label: '鉴定-3',
    // 收尾段：38.mp4 → 点「我已了解」→ 39.mp4（同时右侧出知识考核）→ 末帧停留待答
    phases: ['op38', 'ok10Wait', 'op39', 'quizWait'],
  },
]

/**
 * 左上角徽标「胶囊文字」点开的任务列表项：与 7 段徽标文案一一对应，
 * entry 为该段的**首个环节**（任务列表点「重新开始 / 开始执行」的跳转目标）。
 *
 * 单一来源：除 watch17（「查看实验视频」自成一档、不在 BADGE_TIERS 内）外，
 * 各段的 entry 直接取 BADGE_TIERS 的 phases[0]，改分段只改 BADGE_TIERS 一处。
 * 跳段安全性：各段 entry 的播放源两两不同——查看段是根目录 17.mp4（watchRef 独立元素），
 * 操作段分别是 操作视频/01、10、17、25、31、38.mp4。故跳转必然换 src（或换元素）→
 * 从 0 重新播放，不会出现「跳回同一源视频却停在末帧不播」的死角。
 */
const BADGE_SEGMENTS: { name: string; entry: LabPhase }[] = [
  { name: '查看实验视频', entry: 'watch17' },
  ...BADGE_TIERS.map((t) => ({ name: t.label, entry: t.phases[0] })),
]

/** 供 TaskListModal 渲染的 {no, name} 列表（排序 01..07） */
const LAB_TASK_LIST = BADGE_SEGMENTS.map((s, i) => ({
  no: String(i + 1).padStart(2, '0'),
  name: s.name,
}))

/**
 * 02.mp4 末帧秤面右侧橙色 Tare（归零）按钮热区。
 * 像素实测橙钮 bbox x1117..1171 / y728..751（中心 1144,739），外扩为 100×64 容错热区，
 * 右缘 1194 避开末帧自带的红色引导箭头。
 */
const TARE_HOTSPOT = { left: 1094, top: 707, width: 100, height: 64 }

/**
 * 05.mp4 末帧「把手」红色闪烁区域热区。
 * 引导图 /images/lab-tools/handle.png 本身即 1920×1080 透明叠加层，
 * 红色把手像素实测 bbox x953..1058 / y511..734（与 05.mp4 末帧蓝球把手重合），
 * 热区在此基础上外扩 20px 容错。
 */
const HANDLE_HOTSPOT = { left: 933, top: 491, width: 145, height: 263 }

/**
 * 06.mp4 末帧画面左侧 BPW 烧杯热区。
 * 2026-09-17 负责人复核指出「点击区域需要修改」，并给出应覆盖的区域框；
 * 该框像素实测（截图 1678×880，映射 stage=shot/0.8736，竖轴 offset -64.7）
 * 得 stage x232..546 / y369..840 → 314×471，本热区即按其取值。
 * 说明：小于此范围的旧热区（x300..490/y410..790）会让「框内但热区外」的点击无响应；
 *      取框全量后，学习者按引导框点击必命中。左侧 232 不与右侧匀质机机体（x≈560 起）相交。
 */
const BPW_HOTSPOT = { left: 232, top: 369, width: 314, height: 471 }

/**
 * BPW 可点视觉光圈（呼吸）相对热区左上角的偏移，用于让光圈贴合烧杯本体、
 * 而热区按上面的容错框放大——视觉与命中区解耦，避免大范围光晕误导。
 *
 * 2026-09-17 负责人复核：「白色框没有和视频中的物品对应」。
 * 原因：旧值（绝对 stage x300..490 / y410..790）是按「查看者截图」反推出来的，
 *      截图缩放 + 浏览器 UI 偏移带来系统误差，框整体偏左约 14px、偏窄约 37px、
 *      下缘超出杯底约 29px，肉眼即见「框挂在杯子左外侧」。
 * 现改为**直接在 06.mp4 末帧上量取**：以 ROI 左右边缘带自适应取背景基准、逐行做背景差分，
 * 提取烧杯（含瓶盖高光带与底部投影）真实可见范围 = stage x314..529 / y419..762
 * （取跨行 5%~95% 分位抗噪，避免右墙外的小器皿把 bbox 拉宽到 619）。
 * 四周再各留 7~8px 呼吸位（另有 3px box-shadow 外扩，视觉净空约 10~11px），
 * 减去热区左上角 (232, 369) 得下列相对值；视频为 object-fit:fill 铺满 1920×1080，
 * 故 stage 坐标与视频像素 1:1，无需再做任何映射换算。
 * 留 7~8px 而非刚好 6px：阈值 40/45 两次独立测量会差 1~2px，卡死边界会让断言随机翻车。
 */
const BPW_CUE = { left: 74, top: 42, width: 230, height: 359 }

/* ------------------------------------------------------------------ *
 * 08.mp4 之后的 5 处热区：全部在 1920×1080 末帧上**直接量取**
 * （视频为 object-fit: fill 铺满 1920×1080 舞台，故 stage 坐标 = 视频像素 1:1）
 *
 * 测量口径：绿开关用「绿色翘板连通域 + 邻域 ON/OFF/POWER 白字带」定范围；
 *           蓝按钮用「饱和蓝连通域」；移液枪用「逐行背景差分（右侧纯背景列取基准）」。
 * 热区一律比可见物体外扩数十像素作容错（学习者按光圈点击必命中）。
 *
 * ⚠ 末帧必须取「运行时真末帧」——即播到 ended 后停在的那一帧。
 *   踩坑记录：最初用 `seek(duration - 0.001)` 取帧，实际落在帧边界之前的
 *   倒数若干帧上，据此量出的开关坐标会整体偏移数十像素（曾偏差约 48px）。
 *   必须用 `ended` 事件后取帧，才能得到运行时真正停留的那一帧。
 *
 * 2026-09-18 复核（六帧两两像素差分 + 元素连通域扫描，均为真末帧）：
 *   08 / 13.1 / 13.2 / 13.3 / 13.4 / 14 六帧中，控制面板的**绿色翘板开关
 *   均在 x577..615 / y507..555、蓝色数码显示屏均在 x144..335 / y464..598**，
 *   即各帧面板元素完全同位 → SWITCH_HOTSPOT 对 08 与 13.1 通用，无需分设。
 *   「继续」气泡只出现在 13.2 末帧（按钮 x706..798 / y608..647），
 *   13.1 末帧仅有温度提示条、无气泡（近白像素占比 15% vs 13.2 的 67.8%）。
 * ------------------------------------------------------------------ */

/**
 * 隔水式恒温培养箱控制面板的 ON/OFF 翘板开关（08 与 13.1 末帧共用，见上方说明）。
 * 实测末帧绿翘板 [577,507,615,555]，其 ON / OFF / POWER 白字分布使整个开关组件
 * 可见范围约 x579..620 / y469..604；热区四周留容错，得 130×170。
 * 六帧复核确认各帧同位，故无需按视频分别取值。
 */
const SWITCH_HOTSPOT = { left: 535, top: 452, width: 130, height: 170 }

/**
 * 09.mp4 末帧：画面自带对话框「相关信息 / 样品处理完成」中的蓝色「确定」按钮。
 * 实测按钮 [887,695,1032,749]（146×55），热区外扩至 184×80（四周 19/17/20/9px）。
 */
const OK_HOTSPOT = { left: 868, top: 678, width: 184, height: 80 }

/**
 * 13.2.mp4 末帧：「开始培养。」提示条内的蓝色「继续」按钮。
 * 实测按钮 [706,608,798,647]（93×40），热区外扩至 132×54，四边净空约 12/8/28/7px。
 * 14.mp4 末帧的「继续」按钮与之同位（2026-09-18 实测蓝字 [716,616,799,643]，
 * 相对本热区四周净空 22/16/27/11px），故 endWait（13.2）与 go2Wait（14）共用本热区。
 */
const GO_HOTSPOT = { left: 694, top: 600, width: 132, height: 54 }

/**
 * 15.mp4 末帧：对话框底部的蓝色「确定」按钮（24 小时后观察增菌培养液）。
 * 2026-09-18 真末帧（ended 抽取）实测按钮 [902,852,1049,909] → 148×58、实心占比 ≈98.8%；
 * 热区按 09 的 OK_HOTSPOT 口径外扩 19/17/20/9px，得 186×83。
 */
const OK2_HOTSPOT = { left: 883, top: 835, width: 186, height: 83 }

/**
 * 16.mp4 末帧：对话框底部的蓝色「确定」按钮（增菌培养完成）。
 * 2026-09-18 真末帧实测按钮 [898,552,1047,611] → 150×60、实心占比 ≈95.9%；
 * 热区同样外扩 19/17/20/9px，得 188×85。
 */
const OK3_HOTSPOT = { left: 879, top: 535, width: 188, height: 85 }

/**
 * 11.mp4 末帧：画面左侧移液枪架上的第 4 支（最右、规格 1mL）移液枪。
 * 12.mp4 实测操作的正是这一支（白色按钮帽 → 深蓝枪身 → 透明枪尖）。
 * 枪身列带 x347..383；背景差分定出整支枪纵向可见范围 y123..618。
 * 热区 80×520 覆盖按钮帽与枪尖（四周 17/11/10/14px），左缘 330 不与第 3 支（止于 x321）相交。
 */
const PIPETTE_HOTSPOT = { left: 330, top: 112, width: 80, height: 520 }

/* ------------------------------------------------------------------ *
 * 分离培养 / 鉴定-1 / 鉴定-2 / 鉴定-3 段（17.mp4 起，规格序号 20–41）的热区
 *
 * 取数口径（2026-09-17 在本机重跑，全部在 .f38/ 的**真末帧**上，
 * 即用 ended 事件抽出的「运行时真正停留的那一帧」，t == duration）：
 *   · 「继续」气泡 / 「确定」按钮 → 饱和蓝连通域 B>150 && B-R>30 && G∈(90,190)，
 *     8-连通洪水填充，area>1500 && fill>0.45；先在真值已知的帧上自校验口径可用。
 *   · 面板绿翘板 → G>R+20 && G>B+20 && G>100 连通域；
 *     自校验：08/13.2/13.4/14/28 六帧翘板均落在 [580,508,615,553]（口径可信），
 *     据此判定 **22.mp4 的开关与 08 同位（复用 SWITCH_HOTSPOT）**，
 *     而 **27.mp4 的翘板在 [629,488,659,529]**（机位不同）→ 另设 SWITCH_HOTSPOT_27。
 *   · 场景物体（酒精灯 / 生理盐水）→ 与 BPW 同一套「热区容错 + 光圈贴合」解耦做法：
 *     热区放大作容错，光圈（::before）用 --cue-* 单独贴住物体本体。
 *     酒精灯：17.mp4 取「白灯芯帽（sat<38 且 lum>150）+ 灯体最宽处」→ 整灯 x650..913 / y534..890。
 *     生理盐水：35.mp4 取「暗蓝瓶盖（B−R>25）+ 瓶身最宽处」→ 整瓶 x1206..1353 / y398..723。
 *     ⚠ 两者都曾因为只量到「物体下段」而漏掉上方（灯帽 / 瓶盖）——量取时必须覆盖整件物体。
 *
 * 复用说明：23.mp4(go5Wait) 与 28.mp4(go6Wait) 的「继续」按钮落在既有 GO_HOTSPOT 内
 *   （实测 [708,610,798,645] / [712,611,801,647]），直接复用，不另设常量。
 * ------------------------------------------------------------------ */

/**
 * 17.mp4 末帧：台面上**未点燃**的酒精灯（点它才进入 18.mp4 点燃）。
 * ⚠ 2026-09-18 负责人指出「热区范围需要加长区域」：原热区（620,655,390,280）只罩到灯体下段，
 *   灯的白灯芯帽既不在光圈里、也点不到。原生帧实测（17.mp4 真末帧）：
 *     · 白灯芯帽 x745..825 / y536..686（逐行白块扫描，sat<38 且 lum>150）
 *     · 灯体最宽 x650..913（y690..890 处），灯底 ≈ y890（y895 起全暗 = 台面）
 *     → **整盏灯 x650..913 / y534..890（264×357）**
 *   热区按整灯外扩约 32px 作容错；光圈按整灯外扩 8px 贴住，二者仍解耦。
 */
const ALCOHOL_LAMP_HOTSPOT = { left: 618, top: 498, width: 330, height: 428 }

/** 酒精灯光圈相对热区左上角的偏移（贴住整盏灯 x642..922 / y526..899，净空 8px） */
const ALCOHOL_LAMP_CUE = { left: 24, top: 28, width: 280, height: 373 }

/**
 * 19.mp4 / 20.mp4 末帧：「继续」气泡内的蓝色按钮。
 * 实测 19=[1114,742,1203,773]、20=[1114,740,1203,774]（90×32 / 90×35）——
 * 位置与 13.2/14 的 GO_HOTSPOT（x694..826 / y600..654）**不同**，故另设本条。
 * 四边净空 18/13/26/9px。
 */
const RIGHT_GO_HOTSPOT = { left: 1096, top: 729, width: 133, height: 53 }

/**
 * 27.mp4 末帧：控制面板 ON/OFF 翘板开关。
 * ⚠ 27 的机位与 08 不同：其绿翘板实测 [629,488,659,529]，比 08 的 [580,508,615,553]
 *   偏移 (+49, −20)，**不能复用 SWITCH_HOTSPOT**。按 SWITCH_HOTSPOT 对翘板的相对留白
 *   （左 45 / 上 56 / 右 52 / 下 69）平移得本条。
 */
const SWITCH_HOTSPOT_27 = { left: 584, top: 432, width: 130, height: 170 }

/** 24.mp4 与 30.mp4 末帧：对话框蓝色「确定」（两帧同位，实测均 [900,558,1045,611]），外扩至 184×80 */
const OK4_HOTSPOT = { left: 884, top: 549, width: 184, height: 80 }

/** 29.mp4 末帧：对话框蓝色「确定」（实测 [903,875,1048,927]），外扩至 184×80 */
const OK5_HOTSPOT = { left: 884, top: 866, width: 184, height: 80 }

/** 31.mp4 末帧：对话框蓝色「确定」（实测 [900,604,1045,656]），外扩至 184×80 */
const OK7_HOTSPOT = { left: 884, top: 595, width: 184, height: 80 }

/** 36.mp4 末帧：对话框蓝色「确定」（实测 [902,897,1047,949]），外扩至 184×80 */
const OK8_HOTSPOT = { left: 884, top: 888, width: 184, height: 80 }

/** 37.mp4 末帧：对话框蓝色「确定」（实测 [900,527,1045,579]），外扩至 184×80 */
const OK9_HOTSPOT = { left: 884, top: 518, width: 184, height: 80 }

/**
 * 38.mp4 末帧：对话框底部蓝色按钮「我已了解」（**不是**其余对话框的「确定」）。
 * ⚠ 2026-09-18 复核：38.mp4 已被替换过，旧常量（实测 [887,781,1032,835]）已失效。
 *   新真末帧上按饱和蓝连通域实测按钮 [836,766,1085,841]（250×76），
 *   比旧「确定」宽 105px、且中心左移 49px —— 位置/尺寸都变了，不能沿用旧值。
 *   按本页其余「确定」热区的同样留白（左右各 +9、上下各 +12）外扩为 268×100。
 */
const OK10_HOTSPOT = { left: 827, top: 754, width: 268, height: 100 }

/**
 * 35.mp4 末帧：桌面上的「生理盐水」瓶（蓝盖玻璃瓶立在蓝背景前）。
 * ⚠ 2026-09-18 负责人指出「热区范围需要加长区域」：原热区（1175,478,210,275）只罩到瓶身，
 *   瓶的蓝色瓶盖既不在光圈里、也点不到。原生帧实测（35.mp4 真末帧）：
 *     · 蓝瓶盖 x1240..1318 / y398..520（B−R>25 的暗蓝连通扫描）
 *     · 瓶身 x1206..1353（y540..685），瓶底 ≈ y723（y725 起整行转暗 = 台面）
 *     → **整瓶 x1206..1353 / y398..723（148×326）**
 *   热区按整瓶外扩约 32px 作容错；光圈按整瓶外扩 8px 贴住。右侧道具栏（x1640..1900）无重叠。
 */
const SALINE_HOTSPOT = { left: 1174, top: 366, width: 212, height: 390 }

/** 生理盐水光圈相对热区左上角的偏移（贴住整瓶 x1198..1362 / y390..732，净空 8px） */
const SALINE_CUE = { left: 24, top: 24, width: 164, height: 342 }

/* ------------------------------------------------------------------ *
 * 「点画面热区 → 进入下一段」的**单一来源表**
 *
 * 全链 41 步里，除「点道具栏」（PICK_TARGETS/PICK_NEXT）、「点秤面归零」（tareWait）、
 * 「点红色闪烁区域」（handleWait）三类外，其余都归到下面两张表：
 *   · CLICK_SPOTS —— 末帧自带按钮/开关（确定 / 继续 / 面板开关 / 移液枪），
 *     热区透明、由 ::before 光圈圈出可点处（.lab-spot，对话框小按钮加 --tight）。
 *   · SCENE_SPOTS —— 末帧画面里的场景物体（BPW 烧杯 / 酒精灯 / 生理盐水瓶），
 *     热区放大作容错、光圈另按 cue 贴住物体（.lab-bpw-hotspot）。
 * 新增段只需在这两张表各加一行，JSX 不必再逐个写分支。
 * ------------------------------------------------------------------ */

type Box = { left: number; top: number; width: number; height: number }

const CLICK_SPOTS: Partial<
  Record<LabPhase, { box: Box; label: string; tight: boolean; next: LabPhase | null }>
> = {
  // —— 样品处理 ——
  switchP1Wait: { box: SWITCH_HOTSPOT, label: '面板开关', tight: false, next: 'op09' }, // 08 末帧 绿翘板
  okWait: { box: OK_HOTSPOT, label: '确定', tight: true, next: 'op10' }, // 09 末帧 实测按钮 [887,695,1032,749]
  // —— 增菌培养 ——
  pipetteWait: { box: PIPETTE_HOTSPOT, label: '移液枪', tight: false, next: 'op12' }, // 11 末帧 第 4 支 1mL
  switchP2Wait: { box: SWITCH_HOTSPOT, label: '面板开关', tight: false, next: 'op13_2' }, // 13.1 末帧（与 08 同位）
  endWait: { box: GO_HOTSPOT, label: '继续', tight: true, next: 'op13_4' }, // 13.2 末帧 实测 [706,608,798,647]
  switchP3Wait: { box: SWITCH_HOTSPOT, label: '面板开关', tight: false, next: 'op14' }, // 13.4 末帧（与 08 同位）
  go2Wait: { box: GO_HOTSPOT, label: '继续', tight: true, next: 'op15' }, // 14 末帧（与 13.2 同位）
  ok2Wait: { box: OK2_HOTSPOT, label: '确定', tight: true, next: 'op16' }, // 15 末帧 实测 [902,852,1049,909]
  ok3Wait: { box: OK3_HOTSPOT, label: '确定', tight: true, next: 'op17' }, // 16 末帧 实测 [898,552,1047,611]
  // —— 分离培养（规格序号 20–27）——
  go3Wait: { box: RIGHT_GO_HOTSPOT, label: '继续', tight: true, next: 'op20' }, // 19 末帧 实测 [1114,742,1203,773]
  go4Wait: { box: RIGHT_GO_HOTSPOT, label: '继续', tight: true, next: 'op21' }, // 20 末帧 实测 [1114,740,1203,774]
  switchP4Wait: { box: SWITCH_HOTSPOT, label: '面板开关', tight: false, next: 'op23' }, // 22 末帧 翘板 [580,508,613,553]（与 08 同位）
  go5Wait: { box: GO_HOTSPOT, label: '继续', tight: true, next: 'op24' }, // 23 末帧 实测 [708,610,798,645]
  ok4Wait: { box: OK4_HOTSPOT, label: '确定', tight: true, next: 'op25' }, // 24 末帧 实测 [900,558,1045,611]
  // —— 鉴定-1（规格序号 28–33）——
  switchP5Wait: { box: SWITCH_HOTSPOT_27, label: '面板开关', tight: false, next: 'op28' }, // 27 末帧 翘板 [629,488,659,529]
  go6Wait: { box: GO_HOTSPOT, label: '继续', tight: true, next: 'op29' }, // 28 末帧 实测 [712,611,801,647]
  ok5Wait: { box: OK5_HOTSPOT, label: '确定', tight: true, next: 'op30' }, // 29 末帧 实测 [903,875,1048,927]
  ok6Wait: { box: OK4_HOTSPOT, label: '确定', tight: true, next: 'op31' }, // 30 末帧 与 24 同位
  // —— 鉴定-2（规格序号 34–40）——
  ok7Wait: { box: OK7_HOTSPOT, label: '确定', tight: true, next: 'op32' }, // 31 末帧 实测 [900,604,1045,656]
  ok8Wait: { box: OK8_HOTSPOT, label: '确定', tight: true, next: 'op37' }, // 36 末帧 实测 [902,897,1047,949]
  ok9Wait: { box: OK9_HOTSPOT, label: '确定', tight: true, next: 'op38' }, // 37 末帧 实测 [900,527,1045,579]
  // —— 鉴定-3（规格序号 41）——
  ok10Wait: { box: OK10_HOTSPOT, label: '我已了解', tight: true, next: 'op39' }, // 38 末帧 实测 [836,766,1085,841]
}

/** 画面里的场景物体热区（热区容错 + 光圈贴本体） */
const SCENE_SPOTS: Partial<Record<LabPhase, { box: Box; cue: Box; label: string; next: LabPhase }>> = {
  bpwWait: { box: BPW_HOTSPOT, cue: BPW_CUE, label: '缓冲蛋白胨水（BPW）', next: 'op07' }, // 06 末帧
  alcoholWait: { box: ALCOHOL_LAMP_HOTSPOT, cue: ALCOHOL_LAMP_CUE, label: '酒精灯', next: 'op18' }, // 17 末帧
  salineWait: { box: SALINE_HOTSPOT, cue: SALINE_CUE, label: '生理盐水', next: 'op36' }, // 35 末帧
}



/** 右侧道具栏的 10 件道具（5 行 × 2 列）。
 *  id 驱动交互：bpw / food-sample / homogenizer / incubator 在不同阶段可点，其余暂为展示。
 *  顺序与原型 FLA 道具栏元件 gj_btn1..10（row-major）一致。 */
const LAB_TOOLS: { id: string; img: string; label: string }[] = [
  { id: 'homogenizer', img: '/images/lab-tools/homogenizer.png', label: '匀质机' },
  { id: 'incubator', img: '/images/lab-tools/incubator.png', label: '隔水式恒温培养箱' },
  { id: 'food-sample', img: '/images/lab-tools/food-sample.png', label: '食品样品' },
  { id: 'bpw', img: '/images/lab-tools/bpw.png', label: '缓冲蛋白胨水（BPW）' },
  { id: 'sc-broth', img: '/images/lab-tools/sc-broth.png', label: 'SC增菌液' },
  { id: 'ttb-broth', img: '/images/lab-tools/ttb-broth.png', label: 'TTB增菌液' },
  { id: 'inoculating-loop', img: '/images/lab-tools/inoculating-loop.png', label: '接种环' },
  { id: 'tsi-agar', img: '/images/lab-tools/tsi-agar.png', label: '三糖铁（TSI）琼脂' },
  { id: 'petri-dish', img: '/images/lab-tools/petri-dish.png', label: '平皿' },
  { id: 'o-antiserum', img: '/images/lab-tools/o-antiserum.png', label: '多价菌体（O）抗血清' },
]

const PILL_H = 64
const CAP_R = 31.614 // 右端圆头半径（与食品卫生 stage-pill 同几何）
const TEXT_LEFT = 34
const TEXT_RIGHT_PAD = 46
const PILL_FONT =
  '500 26px "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'

function buildPillPath(width: number): string {
  const t = width - CAP_R
  return [
    `M ${t.toFixed(3)} 0`,
    `C ${(t + 17.46).toFixed(3)} 0 ${width.toFixed(3)} 14.154 ${width.toFixed(3)} 31.614`,
    `C ${width.toFixed(3)} 49.074 ${(t + 17.46).toFixed(3)} 63.228 ${t.toFixed(3)} 63.228`,
    'H 0',
    'C 8.358 53.378 13.375 40.780 13.375 27.050',
    'C 13.375 17.263 10.826 8.051 6.335 0',
    'Z',
  ].join(' ')
}

function StagePill({ text }: { text: string }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [textW, setTextW] = useState(() => text.length * 27)
  useLayoutEffect(() => {
    if (textRef.current) setTextW(textRef.current.offsetWidth)
  }, [text])
  const width = Math.ceil(TEXT_LEFT + textW + TEXT_RIGHT_PAD)
  const d = buildPillPath(width)
  return (
    <span className="lab-badge-pill" style={{ width, height: PILL_H }}>
      <svg
        className="lab-pill-svg"
        width={width}
        height={PILL_H}
        viewBox={`0 0 ${width} ${PILL_H}`}
        aria-hidden="true"
      >
        <defs>
          <mask id="lab-pill-inside" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={width} height={PILL_H} fill="black" />
            <path d={d} fill="white" stroke="white" strokeWidth="4" />
          </mask>
        </defs>
        <path d={d} fill="#ffffff" />
        <path d={d} fill="none" stroke="#1949A9" strokeWidth="4" mask="url(#lab-pill-inside)" />
      </svg>
      <span ref={textRef} className="lab-badge-text" style={{ font: PILL_FONT, left: TEXT_LEFT }}>
        {text}
      </span>
    </span>
  )
}

/** 画面内按钮热区：热区透明，光圈（::before）圈出末帧自带的按钮可点处 */
function Spot({
  box,
  label,
  tight,
  onClick,
}: {
  box: Box
  label: string
  tight: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={tight ? 'lab-spot lab-spot--tight' : 'lab-spot'}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      aria-label={label}
      onClick={onClick}
    />
  )
}

/** 场景物体热区：热区按容错框放大，光圈由 --cue-* 注入、贴住物体本体（与 BPW 同一做法） */
function SceneSpot({
  box,
  cue,
  label,
  onClick,
}: {
  box: Box
  cue: Box
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="lab-bpw-hotspot"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        ['--cue-left' as string]: `${cue.left}px`,
        ['--cue-top' as string]: `${cue.top}px`,
        ['--cue-w' as string]: `${cue.width}px`,
        ['--cue-h' as string]: `${cue.height}px`,
      }}
      aria-label={label}
      onClick={onClick}
    />
  )
}

export default function LabTestingPlayer() {
  const navigate = useNavigate()
  // 断点续做：首次挂载读一次存储 —— 有合法断点就回到该步（等待阶段回退到其操作视频开头重播），
  // 否则从第一步（17.mp4 查看段）开始
  const [phase, setPhase] = useState<LabPhase>(() => resumePhaseOf(readProgress(MODULE_ID).step))
  const [needPlay, setNeedPlay] = useState(false)
  // scTtbWait 为多目标阶段：已点中的增菌液 id（两件都点中才前进）
  const [pickedBroths, setPickedBroths] = useState<string[]>([])
  /** 中途退出确认弹窗（Figma 1:7889「退出提示」）：保存进度并退出 / 直接退出 */
  const [exitPrompt, setExitPrompt] = useState(false)

  // 每推进一步即写回断点：模块选择页据此显示「学习中」/「已学习」，也是下次进入的续做点。
  // 状态语义见 moduleProgress：已「已学习」的模块不因再进来一次而降级。
  useEffect(() => {
    markStudying(MODULE_ID, phase)
  }, [phase])

  /** 中途退出请求（顶栏返回弯箭头 / 查看段的「退出视频」）→ 先弹「退出提示」 */
  const requestExit = () => setExitPrompt(true)

  /** 保存进度并退出：断点已随 phase 持续写入，直接回模块选择页 */
  const handleSaveAndExit = () => {
    setExitPrompt(false)
    navigate('/case-study')
  }

  /** 直接退出：本次学习成绩不予记录 —— 清掉本次断点再回模块选择页 */
  const handleDiscardAndExit = () => {
    discardSession(MODULE_ID)
    setExitPrompt(false)
    navigate('/case-study')
  }

  /** 走到模块终点（知识考核末题答完）：标记「已学习」后返回 —— 终点的返回不弹退出确认 */
  const handleFinish = () => {
    markDone(MODULE_ID)
    navigate('/case-study')
  }

  // 左上角徽标双热区（与现场流行病学调查 / 食品卫生学调查一致）：
  // 机器人头像 → AI 学伴；胶囊文字 → 任务列表。与阶段状态机解耦，任何阶段可开，关闭回原阶段。
  const [showCompanion, setShowCompanion] = useState(false)
  const [showTaskList, setShowTaskList] = useState(false)
  // 弹窗打开期间：隐藏本页热区（.lab-spot / .lab-bpw-hotspot / 引导层 z 38~40 都高于遮罩，
  // 不隐藏就会被透明热区透传点击、在遮罩后推进链路），并暂停播放中的媒体。
  const badgeModalOpen = showCompanion || showTaskList

  /** 任务列表点其它段「重新开始 / 开始执行」：跳到该徽标段首个环节 */
  const handleTaskJump = (taskName: string) => {
    setShowCompanion(false)
    setShowTaskList(false)
    setNeedPlay(false)
    setPickedBroths([])
    const seg = BADGE_SEGMENTS.find((s) => s.name === taskName)
    if (seg) setPhase(seg.entry)
  }

  /** 任务列表「返回 / 进行中」：仅关闭面板，回到当前阶段 */
  const handleTaskListBack = () => setShowTaskList(false)

  // 17.mp4（查看，原生控制条）
  const watchRef = useRef<HTMLVideoElement>(null)
  // 操作视频（01..15，自动播放，同一元素按 src 切换）
  const opRef = useRef<HTMLVideoElement>(null)
  // 讲解 / 提示 / 音效
  const narrRef = useRef<HTMLAudioElement>(null)

  const playAudio = (src: string) => {
    const el = narrRef.current
    if (!el) return
    if (el.src !== src) el.src = src
    el.currentTime = 0
    el.play().catch(() => {}) // 答题/点击后一般已获用户激活；被拦截则静默不阻塞
  }

  // 进入页面尝试有声自动播放 17.mp4；被拦截则显示点击播放提示
  useEffect(() => {
    if (phase !== 'watch17') return
    const el = watchRef.current
    if (!el) return
    el.play().catch((err: DOMException) => {
      if (err?.name !== 'AbortError' && el.paused) setNeedPlay(true)
    })
  }, [phase])

  // 操作视频自动播放：进入任一操作视频阶段（01..08）即播对应 mp4，并起该阶段配音/音效。
  // 元素带 key 重挂、src 已在 JSX 上，浏览器自动 load，切勿再手动 el.load()——
  // StrictMode 双调用 effect 时二次 load() 会中止首次 play()（AbortError），误弹点播遮罩。
  useEffect(() => {
    if (!isOpPlay(phase)) return
    setNeedPlay(false)
    const el = opRef.current
    if (el) {
      el.play().catch((err: DOMException) => {
        // 被后续 load/切源中止（AbortError）时视频实际仍会播放，不弹遮罩；仅确仍暂停才提示手动播放
        if (err?.name !== 'AbortError' && el.paused) setNeedPlay(true)
      })
    }
    const a = PHASE_AUDIO[phase]
    if (a) playAudio(a)
    else narrRef.current?.pause() // 该段无配音：停掉上一段音效，避免与视频音叠加
  }, [phase])

  // 等待阶段配音（提示音 8.mp3，随「提示点击食品样品」一起出）：进入即播，仅一次
  useEffect(() => {
    if (isOpPlay(phase)) return
    const a = PHASE_AUDIO[phase]
    if (a) playAudio(a)
  }, [phase])

  // 徽标弹窗打开期间暂停「正在播放」的视频与配音，关闭后从暂停位置续播（对齐现场流行病学调查）。
  // 只处理打开瞬间处于播放中的媒体（!paused && !ended）：停在末帧的视频不动，
  // 否则关闭弹窗会把末帧背景重新播一遍、把链路顶到下一段。
  //
  // ⚠ 判断「是否仍在播」不能用 `Number.isFinite(duration) && currentTime < duration - ε`：
  //   跳段（任务列表）后新视频刚 play()、**元数据还没到，duration 是 NaN**，
  //   该式恒为 false → 刚跳段就开弹窗时视频/配音都不会被暂停，会在遮罩后默默播完推进链路。
  //   （2026-09-18 实测：跳段到 25.mp4 后 4ms 开 AI 学伴，vTime 仍一路涨到 1.48s。）
  //   正确口径：duration 未知 = 还没播到末尾 = 仍在播；只有 duration 已知且已到末尾才排除。
  useEffect(() => {
    if (!badgeModalOpen) return
    const stageEl = document.querySelector('.lab-stage')
    if (!stageEl) return
    const media = Array.from(stageEl.querySelectorAll('video, audio')) as HTMLMediaElement[]
    const playing = media.filter(
      (m) =>
        !m.paused &&
        !m.ended &&
        !(Number.isFinite(m.duration) && m.currentTime >= m.duration - 0.05),
    )
    playing.forEach((m) => m.pause())
    return () => {
      playing.forEach((m) => {
        // 跳段会换源重挂媒体，document.contains 守卫避免操作已移除的元素
        if (document.contains(m) && !m.ended && m.paused) m.play().catch(() => {})
      })
    }
  }, [badgeModalOpen])

  const startWatch = () => {
    const el = watchRef.current
    if (!el) return
    el.muted = false
    setNeedPlay(false)
    el.play().catch(() => {})
  }

  const startOp = () => {
    const el = opRef.current
    if (!el) return
    el.muted = false
    setNeedPlay(false)
    el.play().catch(() => {})
    const a = isOpPlay(phase) ? PHASE_AUDIO[phase] : undefined
    if (a) playAudio(a)
  }

  // 点道具栏：仅当前等待阶段的目标道具生效。
  // scTtbWait 需 SC + TTB **两件都点中**才进入 11.mp4（其余阶段单目标即前进）。
  const handlePickTool = (id: string) => {
    const targets = PICK_TARGETS[phase]
    if (!targets || !targets.includes(id)) return
    const next = PICK_NEXT[phase]?.[id]
    if (!next) return
    setNeedPlay(false)
    if (targets.length === 1) {
      setPhase(next)
      return
    }
    // 多目标阶段：记录进度，全部点中才前进
    setPickedBroths((prev) => {
      const merged = prev.includes(id) ? prev : [...prev, id]
      if (targets.every((t) => merged.includes(t))) {
        setPhase(next)
        return []
      }
      return merged
    })
  }

  // 点秤面橙色 Tare 归零热区（02 末帧）→ 播 03.mp4
  const handleTare = () => setPhase('op03')

  // 点「把手」红色闪烁区域（05 末帧）→ 播 06.mp4
  const handleHandle = () => {
    setNeedPlay(false)
    setPhase('op06')
  }

  // 其余「点末帧里的按钮/开关」与「点场景物体」的步骤一律由 CLICK_SPOTS / SCENE_SPOTS
  // 两张表驱动，点击动作统一为「setNeedPlay(false) + setPhase(next)」，不再逐个写 handler。


  // 各操作视频播完去向
  const handleOpEnded = () => {
    if (phase === 'play01') setPhase('tools')
    else if (phase === 'op02') setPhase('tareWait')
    else if (phase === 'op03') setPhase('pickFoodWait')
    else if (phase === 'op04') setPhase('pickHomoWait')
    else if (phase === 'op05') setPhase('handleWait')
    else if (phase === 'op06') setPhase('bpwWait')
    else if (phase === 'op07') setPhase('incubatorWait')
    else if (phase === 'op08') setPhase('switchP1Wait')
    else if (phase === 'op09') setPhase('okWait')
    else if (phase === 'op10') setPhase('scTtbWait')
    else if (phase === 'op11') setPhase('pipetteWait')
    else if (phase === 'op12') setPhase('incubator2Wait')
    else if (phase === 'op13_1') setPhase('switchP2Wait')
    else if (phase === 'op13_2') setPhase('endWait')
    else if (phase === 'op13_4') setPhase('switchP3Wait')
    else if (phase === 'op14') setPhase('go2Wait')
    else if (phase === 'op15') setPhase('ok2Wait')
    else if (phase === 'op16') setPhase('ok3Wait')
    else if (phase === 'op17') setPhase('alcoholWait')
    else if (phase === 'op18') setPhase('pickLoopWait')
    else if (phase === 'op19') setPhase('go3Wait')
    else if (phase === 'op20') setPhase('go4Wait')
    else if (phase === 'op21') setPhase('incubator3Wait')
    else if (phase === 'op22') setPhase('switchP4Wait')
    else if (phase === 'op23') setPhase('go5Wait')
    else if (phase === 'op24') setPhase('ok4Wait')
    else if (phase === 'op25') setPhase('pickTsiWait')
    else if (phase === 'op26') setPhase('incubator4Wait')
    else if (phase === 'op27') setPhase('switchP5Wait')
    else if (phase === 'op28') setPhase('go6Wait')
    else if (phase === 'op29') setPhase('ok5Wait')
    else if (phase === 'op30') setPhase('ok6Wait')
    else if (phase === 'op31') setPhase('ok7Wait')
    else if (phase === 'op32') setPhase('pickDishWait')
    else if (phase === 'op33') setPhase('pickLoop2Wait')
    else if (phase === 'op34') setPhase('pickSerumWait')
    else if (phase === 'op35') setPhase('salineWait')
    else if (phase === 'op36') setPhase('ok8Wait')
    else if (phase === 'op37') setPhase('ok9Wait')
    else if (phase === 'op38') setPhase('ok10Wait')
  // —— 鉴定-3 收尾：39.mp4 播完 → 停末帧，此时才挂载右侧知识考核侧栏（不自动推进）——
  else if (phase === 'op39') setPhase('quizWait')
  }

  // —— 渲染派生值 ——
  const showRail = RAIL_PHASES.includes(phase)
  // 「知识考核」侧栏阶段：**仅 39.mp4 播完的末帧停留**（负责人 2026-09-18：
  // 「视频 39.mp4 播放完再显示选择题」）。op39 播放中不渲染，故右侧让位一事 39 段也成立。
  const showQuiz = QUIZ_RAIL_PHASES.includes(phase)
  // 底部提示胶囊：道具栏阶段与考核阶段都在。鉴定-3 整段（op38 起）虽不出道具栏，
  // 但 op38/ok10Wait 仍有「点击『我已了解』」的引导、quizWait 有「请完成右侧知识考核」，
  // 故提示照旧保留；op39（39.mp4 播放中）**有胶囊但无文案**（与其它纯播放段一致）。
  const showHint = showRail || showQuiz || FINAL_STAGE_PHASES.includes(phase)
  const pickTargets = PICK_TARGETS[phase] ?? []
  const hintText = HINT_TEXT[phase] // undefined 时只保留（可见的）空胶囊容器
  // 当前阶段的热区定义（两张单一来源表；不在表内则为 undefined）
  const sceneSpot = SCENE_SPOTS[phase]
  const clickSpot = CLICK_SPOTS[phase]
  // 等待阶段沿用上一段视频停末帧（tools<-01、tareWait<-02、…、switchP2Wait<-13.1、endWait<-13.2）
  const opSrcPhase: OpPhase = WAIT_REUSES[phase] ?? (isOpPlay(phase) ? phase : 'play01')
  const opSrc = OP_SRC[opSrcPhase]
  // key 与「源视频」一致：同一源的播放+末帧等待共用一个元素（不重挂），换源才重挂
  const opKey = opSrcPhase
  // 徽标文案：查看视频 / 样品处理 / 增菌培养 / 分离培养 / 鉴定-1..3（见 BADGE_TIERS）
  const badgeLabel =
    phase === 'watch17'
      ? '查看实验视频'
      : (BADGE_TIERS.find((t) => t.phases.includes(phase))?.label ?? '样品处理')

  return (
    <StageLayout background="#000">
      <div className="epi-stage lab-stage">
        {/* —— 阶段一：17.mp4 查看视频（原生控制条，不自动跳转） —— */}
        {phase === 'watch17' && (
          <video
            ref={watchRef}
            className="epi-video lab-video"
            src="/Video/17.mp4"
            controls
            autoPlay
            playsInline
            preload="auto"
            onPlay={() => setNeedPlay(false)}
          />
        )}

        {/* —— 操作视频 01..15：等待阶段停在同一元素末帧（不重挂），换源靠 key —— */}
        {OP_VIDEO_PHASES.includes(phase) && (
          <video
            key={opKey}
            ref={opRef}
            className="epi-video lab-video"
            src={opSrc}
            autoPlay
            playsInline
            preload="auto"
            onPlay={() => setNeedPlay(false)}
            onEnded={handleOpEnded}
          />
        )}

        {/* 讲解 / 提示配音 / 操作音效：随阶段换源（7.mp3 伴 01、8.mp3 伴食品样品提示、
            9.mp3 伴 05、10.mp3 伴 08、11.mp3 伴 10、12.mp3 伴 11、13.mp3 伴 12、
            14.mp3 伴 13.1、15.mp3 伴 16、16.mp3 伴 17），单元素复用 */}
        <audio ref={narrRef} preload="auto" />

        {/* 自动播放被拦截时的点击播放提示（仅纯播放阶段需要；等待阶段为静态末帧不弹） */}
        {needPlay && (phase === 'watch17' || isOpPlay(phase)) && (
          <button
            type="button"
            className="epi-play-hint"
            onClick={phase === 'watch17' ? startWatch : startOp}
          >
            点击播放视频
          </button>
        )}

        {/* 左上角阶段徽标：机器人头像 + 白胶囊「查看实验视频」。
            徽标是两个热区（与流行病学 / 食品卫生同款）：头像 → AI 学伴；胶囊文字 → 任务列表。
            每一页常驻，z-index=40 高于所有遮罩层；任务列表为全屏不透明页（Figma 393:499 内
            无徽标、靠右上「返回」退出），打开时隐藏徽标避免与标题重叠。 */}
        {!showTaskList && (
          <div className="lab-badge">
            <img
              className="lab-badge-avatar"
              src="/images/epidemiology/stage-robot.png"
              alt=""
              aria-hidden="true"
            />
            {/* 胶囊外包一层收缩定位容器，透明热区随胶囊宽度自适应（胶囊宽度按文案动态绘制） */}
            <span className="lab-badge-pill-slot">
              <StagePill text={badgeLabel} />
              {/* 胶囊热区 → 任务列表（填满 pill-slot，宽度随文案自适应） */}
              <button
                type="button"
                className="lab-badge-btn lab-badge-btn--pill"
                aria-label="打开任务列表"
                onClick={() => setShowTaskList(true)}
              />
            </span>

            {/* 机器人头像热区 → AI 学伴 */}
            <button
              type="button"
              className="lab-badge-btn lab-badge-btn--robot"
              aria-label="打开AI学伴"
              onClick={() => setShowCompanion(true)}
            />
          </div>
        )}

        {/* 阶段一右下操作区：下一步（播 01）+ 退出视频（先弹「退出提示」，与顶栏返回同口径） */}
        {phase === 'watch17' && !badgeModalOpen && (
          <div className="lab-actions">
            <button type="button" className="lab-next-btn" onClick={() => setPhase('play01')}>
              下一步
            </button>
            <button type="button" className="lab-exit-btn" onClick={requestExit}>
              退出视频
            </button>
          </div>
        )}

        {/* 阶段二/三不再显示右下「退出视频」；退出统一走顶栏返回弯箭头（/lab-testing -> /case-study） */}

        {/* —— 样品处理：右侧 10 件道具栏常驻（tools 起，排版对齐 Figma 355:482）。
            每步仅当前目标道具可点、其余全程仅展示；按负责人要求不做任何高亮，
            目标由底部提示文案指明（仅保留指针/键盘焦点等无碍提示的交互反馈）。
            scTtbWait 为多目标阶段：SC 与 TTB 两件都可点，点中一件先记为已选（data-picked），
            两件都点中才进入 11.mp4。 —— */}
        {showRail && (
          <aside className="lab-tools-rail" aria-label="道具栏">
            <div className="lab-tools-head">
              <span className="lab-tools-head-bar" aria-hidden="true" />
              <span className="lab-tools-head-title">道具栏</span>
            </div>
            <div className="lab-tools-grid">
              {LAB_TOOLS.map((t) => {
                const clickable = pickTargets.includes(t.id)
                const picked = pickedBroths.includes(t.id)
                return (
                  <div
                    key={t.id}
                    className={`lab-tool${clickable ? ' lab-tool--clickable' : ''}`}
                    {...(picked ? { 'data-picked': 'true' } : {})}
                    {...(clickable
                      ? { role: 'button', tabIndex: 0, onClick: () => handlePickTool(t.id),
                          onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handlePickTool(t.id)
                            }
                          } }
                      : {})}
                  >
                    <span className="lab-tool-chip">
                      <img className="lab-tool-img" src={t.img} alt={t.label} draggable={false} />
                    </span>
                    <span className="lab-tool-label">{t.label}</span>
                  </div>
                )
              })}
            </div>
          </aside>
        )}

        {/* 02.mp4 末帧：秤面橙色 Tare 归零按钮热区（末帧自带「请点击归零」红箭头，热区透明脉冲） */}
        {phase === 'tareWait' && (
          <button
            type="button"
            className="lab-tare-hotspot"
            style={{
              left: TARE_HOTSPOT.left,
              top: TARE_HOTSPOT.top,
              width: TARE_HOTSPOT.width,
              height: TARE_HOTSPOT.height,
            }}
            aria-label="归零"
            onClick={handleTare}
          />
        )}

        {/* 05.mp4 末帧：把手.png（1920×1080 透明叠加层）红色把手闪烁特写，
            提示「请点击红色区域」；热区仅覆盖红色区域外扩范围，避免误触他与机身。 */}
        {phase === 'handleWait' && !badgeModalOpen && (
          <>
            <img
              className="lab-guide-overlay"
              src="/images/lab-tools/handle.png"
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            <button
              type="button"
              className="lab-guide-hotspot"
              style={{
                left: HANDLE_HOTSPOT.left,
                top: HANDLE_HOTSPOT.top,
                width: HANDLE_HOTSPOT.width,
                height: HANDLE_HOTSPOT.height,
              }}
              aria-label="把手"
              onClick={handleHandle}
            />
          </>
        )}

        {/* —— 场景物体热区（BPW 烧杯 / 酒精灯 / 生理盐水瓶）——
            热区按容错框放大，光圈（::before）由 --cue-* 贴住物体本体，两者解耦：
            容错框内任意位置点击均可命中，视觉提示仍只框住物体。
            具体坐标与来源见 SCENE_SPOTS 及各常量上方注释。 */}
        {sceneSpot && !badgeModalOpen && (
          <SceneSpot
            box={sceneSpot.box}
            cue={sceneSpot.cue}
            label={sceneSpot.label}
            onClick={() => setPhase(sceneSpot.next)}
          />
        )}

        {/* —— 知识考核侧栏（**39.mp4 播完**才出现，即 quizWait 起；非模态、不遮罩视频）——
            负责人 2026-09-18：「视频39.mp4播放完再显示选择题」。故 39 播放中（op39）
            不渲染 —— 由 QUIZ_RAIL_PHASES 控制，`showQuiz` 只在 quizWait 为真。
            题目 id 见 QUIZ_QIDS：负责人所说的 H_13/H_14 是 xlsx 行号，题库里对应 H_12/H_17。
            ⚠ 这里**不能**用 `!badgeModalOpen &&` 卸载：侧栏是有状态的（已选/已判题），
              一卸载答题进度就全丢。改为常挂载 + data-hidden 隐藏（侧栏 z30 本就低于
              徽标弹窗遮罩 z35，被盖住也不会透传点击，与 z38~40 的热区不同）。
            一次一题；答完最后一题后自动回案例页（调查模块入口），与页面左上「退出」同去处。 */}
        {showQuiz && (
          <QuizRail qids={QUIZ_QIDS} hidden={badgeModalOpen} onBack={handleFinish} />
        )}

        {/* —— 画面内按钮热区（确定 / 继续 / 面板开关 / 移液枪）——
            热区透明、光圈圈出末帧自带按钮的可点处；具体坐标与实测依据见 CLICK_SPOTS。 */}
        {clickSpot && !badgeModalOpen && (
          <Spot
            box={clickSpot.box}
            label={clickSpot.label}
            tight={clickSpot.tight}
            onClick={() => {
              setNeedPlay(false)
              if (clickSpot.next) setPhase(clickSpot.next)
            }}
          />
        )}

        {/* 底部引导提示胶囊：样品处理阶段（tools 起）容器始终保留，无文案时仅留空胶囊；
            有文案时显示黄灯泡 + 提示文字（黑胶囊+灯泡延用食品卫生 .st-hint 同款）。 */}
        {showHint && !badgeModalOpen && (
          <div className="lab-hint" role="status" data-empty={hintText ? undefined : 'true'}>
            {hintText && (
              <>
                <svg className="lab-hint-bulb" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
                  <path
                    d="M20 6a10 10 0 00-6 18c1.4 1 2 2 2 3.5h8c0-1.5.6-2.5 2-3.5A10 10 0 0020 6z"
                    fill="#FDB806"
                    stroke="#FDB806"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path d="M17.5 31.5h5M18.5 35h3" fill="none" stroke="#FDB806" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="lab-hint-text">{hintText}</span>
              </>
            )}
          </div>
        )}

        {/* 顶部状态栏（阶段标签：实验室检测；返回弯箭头映射回 /case-study）。
            返回箭头改为先弹「退出提示」（保存进度并退出 / 直接退出），不再直接跳回模块页；
            走到终点的返回由 QuizRail 的 onBack（handleFinish）接管，不弹确认。 */}
        <Header
          variant="stats"
          stageLabel="实验室检测"
          onBack={requestExit}
        />

        {/* 中途退出确认（Figma 1:7889） */}
        {exitPrompt && (
          <ExitConfirmModal
            onSaveAndExit={handleSaveAndExit}
            onDiscardAndExit={handleDiscardAndExit}
            onCancel={() => setExitPrompt(false)}
          />
        )}


        {/* 左上角徽标双热区弹窗（与阶段状态机解耦，任何阶段可开，关闭回原阶段）：
            机器人头像 → AI 学伴对话窗；胶囊文字 → 任务列表（本模块 7 段徽标，当前段高亮）。 */}
        {showCompanion && <AiCompanionModal onClose={() => setShowCompanion(false)} />}
        {showTaskList && (
          <TaskListModal
            currentTask={badgeLabel}
            onBack={handleTaskListBack}
            onJump={handleTaskJump}
            tasks={LAB_TASK_LIST}
          />
        )}
      </div>
    </StageLayout>
  )
}
