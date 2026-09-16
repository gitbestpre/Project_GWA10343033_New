# -*- coding: utf-8 -*-
"""
从《食品致病性微生物污染事件_语音文档.xlsx》提取对话，生成前端数据模块
frontend/src/data/dialogues.ts。目前生成三组：

1) FIELD_DIALOGUES     「现场流行病学调查」ID 0-1  视频2（接报电话）后
2) CDC_REPORT_DIALOGUES「现场流行病学调查」ID 3-4  处置反馈弹窗后的逐级汇报
3) FH_SAMPLING_DIALOGUES「食品卫生学调查」ID 0-5   视频11（出示证件/采样对话）后

仅使用 Python 标准库（xlsx 本质是 zip + XML），无需 openpyxl。
重跑：python scripts/extract_dialogues.py

各工作表列结构（不一致，按表头自动识别，避免列错位）：
  * 现场流行病学调查：A=ID | B=角色 | C=性别 | D=内容
  * 食品卫生学调查  ：A=ID | B=角色 | C=内容 | D=语音模型（无性别列）
因此 parse_sheet 以表头文字定位「内容/性别」所在列。
音频按 ID 命名：ID 0 -> 0.mp3；ID>=1 -> 两位补零（1 -> 01.mp3）。
"""
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "食品致病性微生物污染事件_语音文档.xlsx")
OUT_TS = os.path.join(ROOT, "frontend", "src", "data", "dialogues.ts")

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


def parse_sheet(z: zipfile.ZipFile, shared, sheet_file: str) -> list:
    """解析工作表全部有效行。

    列位置按表头文字自适应（各表结构不一致）：
      * sheet2 现场流行病学调查：A=ID B=角色 C=性别 D=内容
      * sheet3 食品卫生学调查  ：A=ID B=角色 C=内容 D=语音模型
    先读表头定位「内容」与「性别」列，再逐行取值。
    """
    sheet = ET.fromstring(z.read(sheet_file))
    rows = sheet.findall(".//a:row", ns)

    # --- 表头定位 ---
    content_col, gender_col, role_col, id_col = "D", "C", "B", "A"
    if rows:
        header = {}
        for c in rows[0].findall("a:c", ns):
            header[col_letter(c.get("r"))] = (cell_value(c, shared) or "").strip()
        for letter, title in header.items():
            if title == "内容":
                content_col = letter
            elif title == "性别":
                gender_col = letter
            elif title == "角色":
                role_col = letter
            elif title == "ID":
                id_col = letter
        if "性别" not in header.values():
            gender_col = None

    parsed = []
    for ri, row in enumerate(rows):
        if ri == 0:
            continue  # 表头
        cells = {}
        for c in row.findall("a:c", ns):
            cells[col_letter(c.get("r"))] = cell_value(c, shared)

        raw_id = (cells.get(id_col) or "").strip()
        role = (cells.get(role_col) or "").strip()
        gender = (cells.get(gender_col) or "").strip() if gender_col else ""
        content = (cells.get(content_col) or "").strip()
        if not raw_id or not content:
            continue
        parsed.append({
            "id": raw_id,
            "role": role or "旁白",
            "gender": gender or None,
            "text": content,
        })
    return parsed


def build_lines(rows: list, audio_subdir: str, video_by_id: dict, default_video: str) -> list:
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "role": r["role"],
            "gender": r["gender"],
            "text": r["text"],
            "audio": f"/Audio/{audio_subdir}/{audio_name_for_id(r['id'])}",
            "video": video_by_id.get(r["id"], default_video),
        })
    return out


def take(rows: list, ids: list) -> list:
    """按 ID 顺序筛选（保持传入顺序）。"""
    m = {r["id"]: r for r in rows}
    return [m[i] for i in ids if i in m]


def main():
    with zipfile.ZipFile(XLSX) as z:
        shared = load_shared_strings(z)
        epi_rows = parse_sheet(z, shared, "xl/worksheets/sheet2.xml")      # 现场流行病学调查
        fh_rows = parse_sheet(z, shared, "xl/worksheets/sheet3.xml")       # 食品卫生学调查

    field = build_lines(
        take(epi_rows, ["0", "1"]), "现场流行病学调查",
        {"0": "/Video/3.mp4", "1": "/Video/4.mp4"}, "/Video/3.mp4")
    cdc = build_lines(
        take(epi_rows, ["3", "4"]), "现场流行病学调查",
        {"3": "/Video/5.mp4", "4": "/Video/6.mp4"}, "/Video/5.mp4")
    # 食品卫生学调查：视频11（采样员出示证件/对话）后的 6 句对话，
    # 背景循环用 11.mp4 静音（对话发生场景本身）。
    fh = build_lines(
        take(fh_rows, ["0", "1", "2", "3", "4", "5"]), "食品卫生学调查",
        {}, "/Video/11.mp4")

    groups = [
        ("视频2（接报电话）结束后的对话，仅前 2 条", "FIELD_DIALOGUES", field),
        ("处置反馈弹窗“我已了解”后的逐级汇报对话（语音文档第 3、4 条）：\n"
         " * 疾控值班王医师向办公室尤主任电话汇报，尤主任决定启动应急小组。\n"
         " * 背景视频 5.mp4 / 6.mp4 为双人分屏通话画面（本身无有效音轨，配音走 mp3）。",
         "CDC_REPORT_DIALOGUES", cdc),
        ("视频11（采样员出示证件/对话）结束后的现场采样对话（语音文档 0-5 条）：\n"
         " * 采样人员 张峰 ↔ 好运来酒店大堂经理 钱强，共 6 句。\n"
         " * 背景循环用 11.mp4 静音（对话场景本身），配音走 Audio/食品卫生学调查/0-05.mp3。",
         "FH_SAMPLING_DIALOGUES", fh),
    ]

    lines = []
    lines.append("// 该文件由 scripts/extract_dialogues.py 从")
    lines.append("// 《食品致病性微生物污染事件_语音文档.xlsx》工作表")
    lines.append("// 「现场流行病学调查」「食品卫生学调查」自动生成，请勿手改。")
    lines.append("// 更新对话后重跑脚本即可：python scripts/extract_dialogues.py")
    lines.append("")
    lines.append("export interface DialogueLine {")
    lines.append("  /** 语音文档中的行 ID */")
    lines.append("  id: string")
    lines.append("  /** 说话角色，如 王医师 / 张医生 / 采样人员 */")
    lines.append("  role: string")
    lines.append("  /** 角色性别（可空），用于配音/头像区分 */")
    lines.append("  gender?: string | null")
    lines.append("  /** 字幕文本 */")
    lines.append("  text: string")
    lines.append("  /** 语音文件地址（/Audio/...） */")
    lines.append("  audio: string")
    lines.append("  /** 该条对话的背景视频（静音循环） */")
    lines.append("  video: string")
    lines.append("}")
    lines.append("")
    for i, (comment, name, data) in enumerate(groups):
        if i > 0:
            lines.append("")
        for ln in comment.split("\n"):
            lines.append(("/** " + ln) if ln == comment.split("\n")[0] else " * " + ln)
        lines.append(" */")
        lines.append(f"export const {name}: DialogueLine[] = "
                     + json.dumps(data, ensure_ascii=False, indent=2))
    lines.append("")

    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
    with open(OUT_TS, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))

    for comment, name, data in groups:
        print(f"{name}: {len(data)} 条")
        for d in data:
            print(f"  ID {d['id']:<3}{d['role']}({d['gender'] or '-'})  {d['audio']}")
            print(f"        {d['text'][:40]}...")
    print(f"-> {os.path.relpath(OUT_TS, ROOT)}")


if __name__ == "__main__":
    main()
