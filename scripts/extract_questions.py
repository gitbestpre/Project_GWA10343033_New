# -*- coding: utf-8 -*-
"""
从《食品致病性微生物污染事件_选择题.xlsx》提取选择题，生成前端数据模块。

仅使用 Python 标准库（xlsx 本质是 zip + XML），无需 openpyxl。
重跑：python scripts/extract_questions.py
输入：食品致病性微生物污染事件_选择题.xlsx（工作表「选择题 (2)」）
输出：frontend/src/data/questions.ts

表头列：SN | Type | Question | Options_A..F | Key | Score | Scoring | Analysis | Jump
题型  ：S_Choice=单选，M_Choice=多选（Key 形如 A|B|C）
"""
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "食品致病性微生物污染事件_选择题.xlsx")
OUT_TS = os.path.join(ROOT, "frontend", "src", "data", "questions.ts")

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
ns = {"a": NS}
OPTION_COLS = ["Options_A", "Options_B", "Options_C", "Options_D", "Options_E", "Options_F"]
KEYS = ["A", "B", "C", "D", "E", "F"]


def col_letter(ref: str) -> str:
    m = re.match(r"[A-Z]+", ref)
    return m.group(0) if m else ""


def load_shared_strings(z: zipfile.ZipFile):
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    out = []
    for si in root.findall("a:si", ns):
        out.append("".join(t.text or "" for t in si.iter(f"{{{NS}}}t")))
    return out


def cell_value(c, shared):
    t = c.get("t")
    v = c.find("a:v", ns)
    is_el = c.find("a:is", ns)
    if t == "s" and v is not None:
        return shared[int(v.text)]
    if t == "inlineStr" and is_el is not None:
        return "".join(x.text or "" for x in is_el.iter(f"{{{NS}}}t"))
    if t == "b" and v is not None:
        return "TRUE" if v.text == "1" else "FALSE"
    if v is not None:
        return v.text
    return None


def main():
    with zipfile.ZipFile(XLSX) as z:
        shared = load_shared_strings(z)
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))

    rows = sheet.findall(".//a:row", ns)
    parsed = []
    header = {}
    for ri, row in enumerate(rows):
        cells = {}
        for c in row.findall("a:c", ns):
            cells[col_letter(c.get("r"))] = cell_value(c, shared)
        if ri == 0:
            # 表头：列字母 -> 列名
            for letter, name in cells.items():
                if name:
                    header[str(name).strip()] = letter
            continue

        def col(name):
            letter = header.get(name)
            return (cells.get(letter) or "").strip() if letter else ""

        sn = col("SN")
        qtype = col("Type")
        question = col("Question")
        key = col("Key")
        # 只要题目、题型、答案齐全的行才算有效题
        if not sn or not question or not key:
            continue

        options = []
        for header_name, letter_key in zip(OPTION_COLS, KEYS):
            text = col(header_name)
            if text:
                options.append({"key": letter_key, "text": text})

        answer_keys = [k.strip() for k in key.split("|") if k.strip()]
        parsed.append({
            "id": sn,
            "type": "single" if qtype.upper().startswith("S") else "multiple",
            "question": question,
            "options": options,
            "answerKeys": answer_keys,
            "scoring": col("Scoring"),
            "analysis": col("Analysis"),
        })

    # 生成 TypeScript
    lines = []
    lines.append("// 该文件由 scripts/extract_questions.py 从")
    lines.append("// 《食品致病性微生物污染事件_选择题.xlsx》自动生成，请勿手改。")
    lines.append("// 更新题库后重跑脚本即可。")
    lines.append("")
    lines.append("export type QuizType = 'single' | 'multiple'")
    lines.append("")
    lines.append("export interface QuizOption {")
    lines.append("  /** 选项字母 A-F */")
    lines.append("  key: string")
    lines.append("  text: string")
    lines.append("}")
    lines.append("")
    lines.append("export interface QuizQuestion {")
    lines.append("  /** 题号，如 H_01 */")
    lines.append("  id: string")
    lines.append("  /** single=单选，multiple=多选 */")
    lines.append("  type: QuizType")
    lines.append("  question: string")
    lines.append("  options: QuizOption[]")
    lines.append("  /** 正确选项字母集合；单选 1 个，多选多个 */")
    lines.append("  answerKeys: string[]")
    lines.append("  /** 评分说明，如“答对得全分，答错不得分” */")
    lines.append("  scoring?: string")
    lines.append("  /** 答案解析 */")
    lines.append("  analysis?: string")
    lines.append("}")
    lines.append("")
    lines.append("export const QUESTIONS: QuizQuestion[] = " + json.dumps(parsed, ensure_ascii=False, indent=2))
    lines.append("")
    lines.append("/** 按题号取题，未找到返回 undefined */")
    lines.append("export function getQuestionById(id: string): QuizQuestion | undefined {")
    lines.append("  return QUESTIONS.find((q) => q.id === id)")
    lines.append("}")
    lines.append("")

    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
    with open(OUT_TS, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))

    print(f"提取题目 {len(parsed)} 道 -> {os.path.relpath(OUT_TS, ROOT)}")
    for q in parsed:
        print(f"  {q['id']:<6}{q['type']:<9}答案={'|'.join(q['answerKeys']):<14}选项{len(q['options'])}  {q['question'][:24]}")


if __name__ == "__main__":
    main()
