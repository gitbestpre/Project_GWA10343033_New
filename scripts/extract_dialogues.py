# -*- coding: utf-8 -*-
"""
从《食品致病性微生物污染事件_语音文档.xlsx》提取「现场流行病学调查」对话，
生成前端数据模块 frontend/src/data/dialogues.ts。

仅使用 Python 标准库（xlsx 本质是 zip + XML），无需 openpyxl。
重跑：python scripts/extract_dialogues.py

工作表「现场流行病学调查」(sheet2) 列：
  A=ID | B=角色 | C=性别(可空) | D=内容
音频文件位于 Audio/现场流行病学调查/，按 ID 命名：
  ID 0 -> 0.mp3；ID>=1 -> 两位补零，如 1 -> 01.mp3、2 -> 02.mp3。

本阶段（视频2 接报电话后）只播放前 LIMIT 条对话。
"""
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "食品致病性微生物污染事件_语音文档.xlsx")
OUT_TS = os.path.join(ROOT, "frontend", "src", "data", "dialogues.ts")

# 工作表名 -> (sheetN.xml, 音频子目录)
SHEET_NAME = "现场流行病学调查"
SHEET_FILE = "xl/worksheets/sheet2.xml"
AUDIO_SUBDIR = "现场流行病学调查"

# 本阶段只取前 2 条对话（王医师、张医生）；后续阶段需要更多时调整此处
LIMIT = 2

# 每条对话对应的背景视频（3.mp4 / 4.mp4 本身无音轨，仅作画面）。
# 未列出的 ID 默认用 3.mp4。
VIDEO_BY_ID = {
    "0": "/Video/3.mp4",  # 王医师（接听方）
    "1": "/Video/4.mp4",  # 张医生（报告方）
}
DEFAULT_VIDEO = "/Video/3.mp4"

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
ns = {"a": NS}


def col_letter(ref: str) -> str:
    m = re.match(r"[A-Z]+", ref)
    return m.group(0) if m else ""


def load_shared_strings(z: zipfile.ZipFile):
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return ["".join(t.text or "" for t in si.iter(f"{{{NS}}}t"))
            for si in root.findall("a:si", ns)]


def cell_value(c, shared):
    t = c.get("t")
    v = c.find("a:v", ns)
    is_el = c.find("a:is", ns)
    if t == "s" and v is not None:
        return shared[int(v.text)]
    if t == "inlineStr" and is_el is not None:
        return "".join(x.text or "" for x in is_el.iter(f"{{{NS}}}t"))
    if v is not None:
        return v.text
    return None


def audio_name_for_id(raw_id: str) -> str:
    """ID 0 -> 0.mp3；其余两位补零（1 -> 01.mp3）。"""
    n = int(raw_id)
    return ("0" if n == 0 else f"{n:02d}") + ".mp3"


def main():
    with zipfile.ZipFile(XLSX) as z:
        shared = load_shared_strings(z)
        sheet = ET.fromstring(z.read(SHEET_FILE))

    rows = sheet.findall(".//a:row", ns)
    parsed = []
    for ri, row in enumerate(rows):
        if ri == 0:
            continue  # 表头
        cells = {}
        for c in row.findall("a:c", ns):
            cells[col_letter(c.get("r"))] = cell_value(c, shared)

        raw_id = (cells.get("A") or "").strip()
        role = (cells.get("B") or "").strip()
        gender = (cells.get("C") or "").strip()
        # 该表内容在 D 列
        content = (cells.get("D") or "").strip()
        if not raw_id or not content:
            continue

        parsed.append({
            "id": raw_id,
            "role": role or "旁白",
            "gender": gender or None,
            "text": content,
            "audio": f"/Audio/{AUDIO_SUBDIR}/{audio_name_for_id(raw_id)}",
            "video": VIDEO_BY_ID.get(raw_id, DEFAULT_VIDEO),
        })

    dialogues = parsed[:LIMIT]

    lines = []
    lines.append("// 该文件由 scripts/extract_dialogues.py 从")
    lines.append("// 《食品致病性微生物污染事件_语音文档.xlsx》工作表「现场流行病学调查」自动生成，请勿手改。")
    lines.append("// 更新对话后重跑脚本即可。")
    lines.append("")
    lines.append("export interface DialogueLine {")
    lines.append("  /** 语音文档中的行 ID */")
    lines.append("  id: string")
    lines.append("  /** 说话角色，如 王医师 / 张医生 / 旁白 */")
    lines.append("  role: string")
    lines.append("  /** 角色性别（可空），用于配音/头像区分 */")
    lines.append("  gender?: string | null")
    lines.append("  /** 字幕文本 */")
    lines.append("  text: string")
    lines.append("  /** 语音文件地址（/Audio/...） */")
    lines.append("  audio: string")
    lines.append("  /** 该条对话的背景视频（3.mp4 / 4.mp4 本身无音轨） */")
    lines.append("  video: string")
    lines.append("}")
    lines.append("")
    lines.append("/** 视频2（接报电话）结束后的对话，仅前 2 条 */")
    lines.append("export const FIELD_DIALOGUES: DialogueLine[] = "
                 + json.dumps(dialogues, ensure_ascii=False, indent=2))
    lines.append("")

    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
    with open(OUT_TS, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))

    print(f"提取对话 {len(dialogues)} 条（表内共 {len(parsed)} 条有效，LIMIT={LIMIT}）"
          f" -> {os.path.relpath(OUT_TS, ROOT)}")
    for d in dialogues:
        print(f"  ID {d['id']:<3}{d['role']}({d['gender'] or '-'})  {d['audio']}")
        print(f"        {d['text'][:40]}...")


if __name__ == "__main__":
    main()
