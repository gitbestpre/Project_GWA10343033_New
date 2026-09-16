import { useState } from 'react'

/**
 * 食品卫生学调查 —— 采样前个人防护装备穿戴画面（对齐 Figma 帧 184:3874）。
 *
 * 交互规则（负责人 2026-09-14 定）：
 *   - 默认人物只穿白 T 恤（scene-08-001 常显），不叠加任何防护层；
 *   - 点击左侧道具栏某项 → 在人物身上叠加对应图层；再次点击可取消；
 *   - “手消毒”为动作步骤，无人物叠加图层，点击仅切换选中态（按钮高亮）；
 *   - 道具栏 7 项（合并内/外层手套为单个“一次性手套”，一次穿戴同时叠内、外两层）；
 *   - 按钮角标 = 该道具被点击穿戴的先后顺序（1 起算，随选择动态变化），
 *     未穿戴的道具不显示角标；
 *   - 提交时把“实际穿戴先后顺序”回传，弹出“你的穿戴记录 / 正确穿戴记录”对比。
 *
 * 结构（1920×1080，严格按 Figma 图层顺序）：
 *   - 房间背景 scene-bg.png（节点 184:3875）+ 15% 黑蒙（节点 184:3876）；
 *   - 基础人物 scene-08-001（白 T）常显；防护层按选中态叠加；
 *   - 左侧“穿戴背景”面板（540×944 @ (30,103)）+ T 恤图标 + 标题；
 *   - 7 个道具按钮（232×192 两列×四行，末行仅左列，坐标相对面板）：选中蓝渐变底图、
 *     未选白底淡蓝边；白底名条 + 道具图标 + 步骤角标；
 *   - 右下“提交”按钮（240×84 圆角42 白底）。
 */

/**
 * 正确穿戴记录（提交对比的标准答案，负责人 2026-09-14 以 Figma 记录卡截图为准，
 * 仅 3 项）：1 手消毒 → 2 一次性口罩 → 3 一次性手套。
 */
export const CORRECT_KEY_ORDER = ['handwash', 'mask', 'glove']

export interface PpeItemDef {
  key: string
  name: string
  icon: string
  /** 点击后叠加到人物身上的图层文件名（可多个，按数组顺序叠放）；手消毒无图层 */
  wearLayers: string[]
}

export const PPE_ITEMS: PpeItemDef[] = [
  { key: 'handwash', name: '手消毒', icon: 'item-handwash.png', wearLayers: [] },
  { key: 'cap', name: '一次性帽子', icon: 'item-cap.png', wearLayers: ['scene-08-005.png'] },
  { key: 'glove', name: '一次性手套', icon: 'item-inner-glove.png',
    // 先内后外：内层浅蓝在下、外层深蓝在上，同轮廓外层覆盖内层
    wearLayers: ['scene-inner-glove.png', 'scene-outer-glove.png'] },
  // 一次性口罩：道具图标与人物叠加层均取负责人提供的《一次性口罩.png》
  // （蓝色外科口罩，人物层已按白 T 人物面部坐标像素重定位；
  //   原 N95 白口罩层备份在 .ppe-glove-backup/scene-08-004.png）
  { key: 'mask', name: '一次性口罩', icon: 'item-n95.png', wearLayers: ['scene-08-004.png'] },
  { key: 'goggles', name: '护目镜', icon: 'item-goggles.png', wearLayers: ['scene-08-006.png'] },
  { key: 'shoecover', name: '鞋套', icon: 'item-shoecover.png', wearLayers: ['scene-08-009.png'] },
  { key: 'suit', name: '防护服', icon: 'item-suit.png', wearLayers: ['scene-08-008.png'] },
]

/** 场景叠加图层（顺序即遮挡叠序，与 Figma 组 184:3921 同源；
 *  内外手套采用负责人提供的原始叠加图（已按白 T 人物双手坐标像素重定位）。 */
export const SCENE_LAYERS = [
  '/images/food-hygiene/ppe/scene-08-001.png', // 基础人物：白 T 恤（常显）
  '/images/food-hygiene/ppe/scene-08-004.png', // 一次性口罩（蓝色外科口罩，已重定位）
  '/images/food-hygiene/ppe/scene-08-005.png', // 一次性帽子
  '/images/food-hygiene/ppe/scene-inner-glove.png', // 内层手套（浅蓝）
  '/images/food-hygiene/ppe/scene-outer-glove.png', // 外层手套（深蓝）
  '/images/food-hygiene/ppe/scene-08-006.png', // 护目镜
  '/images/food-hygiene/ppe/scene-08-008.png', // 防护服
  '/images/food-hygiene/ppe/scene-08-009.png', // 鞋套
]

/** 除基础人物外的可穿戴图层（点击道具后才叠加），按 Figma 叠序 */
const WEAR_LAYER_FILES = SCENE_LAYERS.slice(1).map((src) => src.split('/').pop() as string)

/**
 * 根据一组已穿戴道具 key，按 Figma 叠序返回对应的人物叠加图层完整 URL。
 * “手消毒”无图层；“一次性手套”一次返回内、外两层（内下外上）。
 */
export function wornLayerSrcs(keys: string[]): string[] {
  const fileSet = new Set<string>()
  for (const key of keys) {
    PPE_ITEMS.find((x) => x.key === key)?.wearLayers.forEach((f) => fileSet.add(f))
  }
  return WEAR_LAYER_FILES.filter((f) => fileSet.has(f)).map(
    (f) => `/images/food-hygiene/ppe/${f}`,
  )
}

/** 标准答案已在文件头定义（CORRECT_KEY_ORDER，3 项） */

/**
 * 静态穿戴背景：房间 + 15% 黑蒙 + 基础人物（可选叠加防护层）。
 * 供“提示”弹窗阶段（PpeHintModal）作背景使用——Figma 该弹窗背后即为
 * 更衣室里穿好全套 PPE 的人物（帧 184:3874 场景，无道具面板/提交）。
 */
export function PpeSceneBackdrop({
  allDressed = false,
  layers,
}: {
  allDressed?: boolean
  /** 自定义叠加图层（完整 URL）；提供时优先于 allDressed */
  layers?: string[]
}) {
  const list = layers ?? (allDressed ? SCENE_LAYERS : SCENE_LAYERS.slice(0, 1))
  return (
    <div className="pd-backdrop" aria-hidden="true">
      <img className="pd-room" src="/images/food-hygiene/ppe/scene-bg.png" alt="" draggable={false} />
      <div className="pd-dim" />
      <div className="pd-scene">
        {list.map((src) => (
          <img key={src} src={src} alt="" draggable={false} />
        ))}
      </div>
    </div>
  )
}

/**
 * 按钮栅格（两列×四行），坐标相对左侧面板（540×944 @ (30,103)）：
 *  Figma 舞台 x=56/312、y=189/401/613/825；面板原点 (30,103)
 *  → 面板内 x=26/282、y=86/298/510/722。
 *  PPE_ITEMS 按下图面板顺序排列（行优先）：手消毒/帽子、手套/口罩、护目镜/鞋套、防护服。
 */
const BTN_X = [26, 282]
const BTN_Y = [86, 298, 510, 722]

export default function PpeDressingScene({ onSubmit }: { onSubmit: (wornKeyOrder: string[]) => void }) {
  // 已穿戴道具 key，按点击先后排列；默认空 → 人物仅白 T。
  // 单一数据源：既决定按钮选中态（includes），也决定人物叠加层与提交顺序。
  const [order, setOrder] = useState<string[]>([])

  const toggle = (key: string) => {
    setOrder((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  // 按 Figma 叠加顺序收集已穿戴图层（跨道具的图层统一按 WEAR_LAYER_FILES 排序）
  const wornFileSet = new Set<string>()
  for (const key of order) {
    PPE_ITEMS.find((x) => x.key === key)?.wearLayers.forEach((f) => wornFileSet.add(f))
  }
  const activeLayers = WEAR_LAYER_FILES.filter((f) => wornFileSet.has(f))

  return (
    <div className="pd-layer" aria-label="采样前穿戴个人防护设备">
      {/* 房间背景 + 15% 黑蒙 */}
      <PpeSceneBackdrop />

      {/* 人物：基础白 T 常显 + 已穿戴防护层叠加（顺序与 Figma 组一致） */}
      <div className="pd-scene pd-scene--person" aria-hidden="true">
        {activeLayers.map((file) => (
          <img
            key={file}
            src={`/images/food-hygiene/ppe/${file}`}
            alt=""
            draggable={false}
          />
        ))}
      </div>

      {/* 左侧道具面板 */}
      <div className="pd-panel">
        <img className="pd-panel-bg" src="/images/food-hygiene/ppe/panel-bg.png" alt="" />
        {/* 标题“防护用品道具栏”：T 恤图标已烘在 panel-bg 蓝栏左上角（Figma 184:3880），
            文字左对齐于 T 恤右侧（Figma 184:3929 面板内 x76 y4，32px 白字） */}
        <h3 className="pd-panel-title">防护用品道具栏</h3>

        {PPE_ITEMS.map((it, i) => {
          const x = BTN_X[i % 2]
          const y = BTN_Y[Math.floor(i / 2)]
          const active = order.includes(it.key)
          const seq = order.indexOf(it.key) + 1 // 穿戴先后顺序（1 起算），未穿戴为 0 不显示
          return (
            <button
              type="button"
              key={it.key}
              className={`pd-item${active ? ' is-on' : ''}`}
              style={{ left: x, top: y }}
              aria-pressed={active}
              aria-label={`${it.name}${active ? `（第${seq}个穿戴）` : ''}`}
              onClick={() => toggle(it.key)}
            >
              {/* 选中态：Figma 蓝渐变切图；未选：CSS 白底淡蓝边 */}
              {active && (
                <img className="pd-item-bg" src="/images/food-hygiene/ppe/btn-active.png" alt="" />
              )}
              <span className="pd-item-label">{it.name}</span>
              <img
                className="pd-item-icon"
                src={`/images/food-hygiene/ppe/${it.icon}`}
                alt=""
                draggable={false}
              />
              {/* 选择顺序角标：按穿戴先后动态编号（1..n），未穿戴不显示 */}
              {active && <span className="pd-item-step">{seq}</span>}
            </button>
          )
        })}
      </div>

      {/* 右下提交：回传最终穿戴先后顺序 */}
      <button
        type="button"
        className="pd-submit"
        onClick={() => onSubmit(order)}
      >
        提交
      </button>
    </div>
  )
}
