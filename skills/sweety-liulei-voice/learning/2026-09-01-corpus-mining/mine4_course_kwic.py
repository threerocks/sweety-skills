#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pass 4: precise counts + KWIC for course-register candidates, plus diagnostics vs hand-written base."""
import re, os, json, collections

OUT = os.path.dirname(os.path.abspath(__file__))
sents = json.load(open(os.path.join(OUT, "course_sents.json"), encoding="utf-8"))

GROUPS = {
    "教学承接": ["这节课","上节课","下节课","这一讲","上一讲","下一讲","前面几讲","回顾一下","欢迎你","期待","我们一起","让我们","接下来我们","接下来","今天我们","正式开启","铺垫","承上启下","收个尾","开始今天","进入正题"],
    "引导思考": ["请思考","思考一下","先思考","请结合","不妨","试想","想一想","你觉得","留言区","动手","亲自","跑一遍","试一试","练习","实操","上手"],
    "强调装置": ["注意","划重点","记住","关键在于","核心在于","重点是","本质上","换句话说","说白了","也就是说","简单来说","一句话概括","一句话总结","毫不夸张","值得注意","有趣的是","更重要的是","更进一步","事实上","实际上","某种意义上","不难看出","可以看到","你会发现","我们会发现","别急","别担心","放心"],
    "判断评价": ["优雅","强大","惊艳","丝滑","好用","靠谱","稳定","高效","威力","魔法","黑科技","杀手锏","短板","局限性","坑","陷阱","误区","踩雷","红线","双刃剑","性价比","开箱即用","轻量","重量级"],
    "口语讲话": ["啥事","搞定","干脆","无脑","灌给","塞给","吃掉","掰开揉碎","讲透","接轨","升维","降维","落地","赋能","提效","跑通","门槛","套路","玩法","玩转","折腾","随叫随到","影子","翻车","翻译成","大白话","说人话","接地气"],
    "比喻装置": ["就像","好比","类比","打个比方","相当于","导演","演员","岗位","专职","管家","助手","乐高","积木","流水线","瑞士军刀","引擎","驾驶","副驾","指挥","乐队","厨房","菜谱","食材"],
    "句式骨架": ["而不是","不是简单","让我们","我们来","来看看","看一下","意味着","这就是","这不是","这正是","换个角度","一方面","另一方面","无论是","还是","既","又","从而","于是","其实","毕竟","当然","只不过","反而","恰恰","正是"],
    "读者称呼": ["你可以","你需要","你会","你的","大家","同学","朋友","伙伴","开发者","读者"],
}

PAT = {
    "破折号——句": re.compile(r"——"),
    "问号句(设问)": re.compile(r"[?？]"),
    "有的…有的…排比": re.compile(r"有的.{2,20}有的"),
    "既…又…": re.compile(r"既.{1,14}又"),
    "从X到Y": re.compile(r"从.{1,12}到.{1,12}[，,。]"),
    "不是A而是B": re.compile(r"不是.{1,18}而是"),
    "括号补充": re.compile(r"[（(][^）)]{4,}[）)]"),
    "数字空格(2025 年式)": re.compile(r"\d [年月日万个讲%]|[年月] \d"),
    "三连短句(X。Y。Z。均<12字)": re.compile(r"^[^，。]{2,11}。[^，。]{2,11}。[^，。]{2,11}。$"),
}

def main():
    w = open(os.path.join(OUT, "course_kwic.txt"), "w", encoding="utf-8")
    w.write("== DIAGNOSTICS ==\n")
    for name, pat in PAT.items():
        cnt = collections.Counter()
        example = {}
        for r, f, s in sents:
            if pat.search(s):
                cnt[r] += 1
                example.setdefault(r, s)
        w.write(f"\n### {name}: {dict(cnt)}\n")
        for r, s in list(example.items())[:2]:
            w.write(f"  [{r}] {s[:100]}\n")

    for group, words in GROUPS.items():
        w.write(f"\n\n======== {group} ========\n")
        rows = []
        for word in words:
            hits = [(r, f, s) for r, f, s in sents if word in s]
            rows.append((len(hits), word, hits))
        rows.sort(reverse=True)
        for c, word, hits in rows:
            if c == 0:
                w.write(f"{word}\t0\n"); continue
            byreg = collections.Counter(r for r, _, _ in hits)
            w.write(f"{word}\t{c}\t{dict(byreg)}\n")
            for r, f, s in hits[:2]:
                i = s.find(word)
                w.write(f"    [{r}] …{s[max(0,i-38):i+len(word)+48]}…\n")
    w.close()
    print("course_kwic.txt written")

main()
