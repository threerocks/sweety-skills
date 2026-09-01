#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pass 3: mine the main corpus (two GeekTime course dirs, team-authored, user-designated as his own).

Registers: hx = Harness course chapters, cc = ClaudeCode course chapters, talk = livestream transcript.
Excluded: quiz stubs, CC livestream stub. Headings dropped entirely (structure is out of scope).
Outputs: course_report.txt (freq battery), course_kwic.txt (candidates+examples), course_sents.json.
"""
import re, os, glob, collections, json

DIRS = {
    "hx": "/Users/liulei/source/HarnessAgent脚手架实战课/md",
    "cc": "/Users/liulei/source/ClaudeCode工程化实战/md",
}
EXCLUDE = ["结课测试", "直播回放｜不止Skills"]
TALK = "直播回放：5倍效率提升"
OUT = os.path.dirname(os.path.abspath(__file__))
HAN = r"一-鿿"

def clean(text):
    stats = {}
    stats["bold_spans"] = len(re.findall(r"\*\*[^*\n]{1,40}\*\*", text))
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"`[^`\n]+`", " ", text)
    text = re.sub(r"https?://\S+", " ", text)
    kept = []
    for line in text.split("\n"):
        s = line.strip()
        if s.startswith("#"):            # headings = structure, drop
            continue
        if s.startswith("> 直播嘉宾"):
            continue
        han = len(re.findall(f"[{HAN}]", s))
        if s and han < len(s) * 0.25 and len(s) > 8:
            continue
        kept.append(line)
    text = "\n".join(kept)
    text = re.sub(r"你好，我是(黄佳|邢云阳)。?", " ", text)
    text = re.sub(r"我是(黄佳|邢云阳)。?", " ", text)
    text = re.sub(r"<[^>\n]{1,80}>", " ", text)
    text = re.sub(r"[*_>|]{1,3}", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text, stats

SENT_SPLIT = re.compile(r"(?<=[。！？!?；;…\n])")

def sentences(text):
    for s in SENT_SPLIT.split(text):
        s = s.strip()
        if len(re.findall(f"[{HAN}]", s)) >= 3:
            yield s

def main():
    sents = []          # (register, file, sentence)
    grams = {r: {2: collections.Counter(), 3: collections.Counter(), 4: collections.Counter()} for r in ("hx", "cc", "talk")}
    starters = {r: collections.Counter() for r in ("hx", "cc", "talk")}
    punct = {r: collections.Counter() for r in ("hx", "cc", "talk")}
    chars = collections.Counter()
    bold = collections.Counter()
    nfiles = collections.Counter()

    for reg0, d in DIRS.items():
        for f in sorted(glob.glob(os.path.join(d, "*.md"))):
            name = os.path.basename(f)
            if any(x in name for x in EXCLUDE):
                continue
            reg = "talk" if TALK in name else reg0
            text, st = clean(open(f, encoding="utf-8").read())
            nfiles[reg] += 1
            bold[reg] += st["bold_spans"]
            han_n = len(re.findall(f"[{HAN}]", text))
            chars[reg] += han_n
            for ch in text:
                if ch in "，。、：；！？…—～~（）()【】《》!?":
                    punct[reg][ch] += 1
            for s in sentences(text):
                sents.append((reg, name, s))
                m = re.match(f"[{HAN}]{{2}}", s)
                if m:
                    starters[reg][m.group(0)] += 1
                for run in re.findall(f"[{HAN}]+", s):
                    for n in (2, 3, 4):
                        for i in range(len(run) - n + 1):
                            grams[reg][n][run[i:i + n]] += 1

    with open(os.path.join(OUT, "course_report.txt"), "w", encoding="utf-8") as w:
        w.write(f"files={dict(nfiles)} han={dict(chars)} sents={collections.Counter(r for r,_,_ in sents)}\n")
        for reg in ("hx", "cc", "talk"):
            ss = [s for r, _, s in sents if r == reg]
            lens = [len(s) for s in ss]
            commas = [s.count("，") for s in ss]
            w.write(f"[{reg}] avg_len={sum(lens)/len(ss):.0f} avg_commas={sum(commas)/len(ss):.1f} "
                    f">=80char={sum(1 for L in lens if L>=80)*100//len(ss)}% maxcommas={max(commas)} "
                    f"bold_per_10k={bold[reg]*10000//max(chars[reg],1)}\n")
        for reg in ("hx", "cc", "talk"):
            total = max(chars[reg], 1)
            w.write(f"\n== [{reg}] PUNCT per 10k han ==\n")
            for p, c in punct[reg].most_common(22):
                w.write(f"{p!r}\t{c}\t{c*10000//total}\n")
            w.write(f"\n== [{reg}] STARTERS top 60 ==\n")
            for g, c in starters[reg].most_common(60):
                w.write(f"{g}\t{c}\n")
            for n in (3, 4):
                w.write(f"\n== [{reg}] {n}-GRAMS top 220 (min 5; talk min 3) ==\n")
                floor = 3 if reg == "talk" else 5
                for g, c in grams[reg][n].most_common(220):
                    if c < floor:
                        break
                    w.write(f"{g}\t{c}\n")
    json.dump(sents, open(os.path.join(OUT, "course_sents.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"files={dict(nfiles)} han={dict(chars)} sents={len(sents)}")

main()
