#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pass 1: discover candidate voice tokens from liulei author corpus (juejin 36, minus translations)."""
import re, os, glob, collections, json, sys

CORPUS = "/Users/liulei/.codex/writing-style/liulei/corpus/2026-06-20-one-time-learning/juejin/raw"
OUT = os.path.dirname(os.path.abspath(__file__))

PERSONAL_PAT = re.compile(r"年终总结|年度总结|读研|硕士")

def load_and_clean(path):
    text = open(path, encoding="utf-8").read()
    # strip frontmatter
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)
    body_head = text[:800]
    is_translation = bool(re.search(r"翻译自|译自|原文[：:]\s*\S|原文链接|原文地址", body_head))
    # strip fenced code
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"~~~.*?~~~", " ", text, flags=re.S)
    # NOTE: run BEFORE inline-code strip so urls inside backticks also die
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)          # images
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)        # links -> text
    text = re.sub(r"`[^`\n]+`", " ", text)                       # inline code
    text = re.sub(r"https?://\S+", " ", text)
    text = text.replace("复制代码", " ")
    # drop code-ish lines: indented code or mostly-ASCII lines
    kept = []
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            kept.append(line); continue
        han = len(re.findall(r"[一-鿿]", stripped))
        if re.match(r"^(    |\t)", line) and han < max(2, len(stripped) * 0.3):
            continue
        if han < len(stripped) * 0.25 and len(stripped) > 8:
            continue
        kept.append(line)
    text = "\n".join(kept)
    text = re.sub(r"<[^>\n]{1,80}>", " ", text)                  # html tags
    text = re.sub(r"^\s*\|.*\|\s*$", lambda m: m.group(0).replace("|", " "), text, flags=re.M)  # table pipes
    text = re.sub(r"^#+\s*", "", text, flags=re.M)               # heading marks
    text = re.sub(r"[*_>]{1,3}", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text, is_translation

HAN = r"一-鿿"
SENT_SPLIT = re.compile(r"(?<=[。！？!?；;…\n])")

def sentences(text):
    for s in SENT_SPLIT.split(text):
        s = s.strip()
        if len(re.findall(f"[{HAN}]", s)) >= 3:
            yield s

def main():
    files = sorted(glob.glob(os.path.join(CORPUS, "*.md")))
    grams = {2: collections.Counter(), 3: collections.Counter(), 4: collections.Counter()}
    grams_by_reg = {r: {2: collections.Counter(), 3: collections.Counter(), 4: collections.Counter()} for r in ('tech','personal')}
    starters = collections.Counter()
    enders = collections.Counter()
    punct = collections.Counter()
    reg_chars = collections.Counter()
    excluded, included = [], []
    all_sents = []  # (register, file, sentence)

    for f in files:
        name = os.path.basename(f)
        text, is_tr = load_and_clean(f)
        if is_tr:
            excluded.append(name); continue
        included.append(name)
        register = "personal" if PERSONAL_PAT.search(name) else "tech"
        per_reg_grams = grams_by_reg[register]
        han_count = len(re.findall(f"[{HAN}]", text))
        reg_chars[register] += han_count
        for ch in text:
            if ch in "，。、：；！？…～~（）()【】\"\"''《》!?.;:-—":
                punct[ch] += 1
        for s in sentences(text):
            all_sents.append((register, name, s))
            # starter: leading han run up to 4 chars
            m = re.match(f"[{HAN}]{{1,4}}", s)
            if m:
                for L in (1, 2, 3):
                    if len(m.group(0)) >= L:
                        starters[m.group(0)[:L]] += 0  # placeholder
                starters[m.group(0)[:2]] += 1
            # ender: last 3 chars incl punct
            enders[s[-3:]] += 1
            # n-grams over han-only runs
            for run in re.findall(f"[{HAN}]+", s):
                for n in (2, 3, 4):
                    for i in range(len(run) - n + 1):
                        grams[n][run[i:i+n]] += 1
                        per_reg_grams[n][run[i:i+n]] += 1

    with open(os.path.join(OUT, "discover_report.txt"), "w", encoding="utf-8") as w:
        w.write(f"included={len(included)} excluded_translations={excluded}\n")
        w.write(f"han chars by register: {dict(reg_chars)}\n\n")
        w.write("== PUNCT per 10k han ==\n")
        total = sum(reg_chars.values())
        for p, c in punct.most_common(40):
            w.write(f"{p!r}\t{c}\t{c*10000//max(total,1)}\n")
        w.write("\n== SENTENCE STARTERS (first 2 chars) top 120 ==\n")
        for g, c in starters.most_common(120):
            w.write(f"{g}\t{c}\n")
        w.write("\n== SENTENCE ENDERS top 80 ==\n")
        for g, c in enders.most_common(80):
            w.write(f"{g}\t{c}\n")
        for n in (2, 3, 4):
            w.write(f"\n== {n}-GRAMS top 400 (min 6) ==\n")
            for g, c in grams[n].most_common(400):
                if c < 6: break
                w.write(f"{g}\t{c}\n")
        for n in (2, 3, 4):
            w.write(f"\n== PERSONAL-ONLY {n}-GRAMS top 150 (min 2) ==\n")
            for g, c in grams_by_reg['personal'][n].most_common(150):
                if c < 2: break
                w.write(f"{g}\t{c}\n")
    json.dump([(r, f, s) for r, f, s in all_sents], open(os.path.join(OUT, "sents.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"done. included={len(included)}, excluded={len(excluded)}: {excluded}")
    print(f"sentences={len(all_sents)}, han={dict(reg_chars)}")

main()
