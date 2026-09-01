# -*- coding: utf-8 -*-
import json, re
sents = json.load(open("sents.json", encoding="utf-8"))
words = ["即可","无需","而已","罢了","况且","据江湖","恨不得","一言难尽","就这样吧","算了","倒腾","鼓捣","折腾","极为","极致","不得不说","不得不","岂是","终究","终于","匆匆","短短的","此起彼伏","起起浮浮","普普通通","千千万万","别提多","飞起","大礼包","盲盒","尾巴","尾声","势微","走卒","扛不住","支撑","扼杀在摇篮","值得一提","得益于","大神","大佬","移步","很不错","超开心","知足","幸运","馈赠","奢侈品","刚需","抉择","观望","逃不过","头衔","入行","转行","下坡路","浪潮","巨头","憧憬","学艺不精","那块料","料儿","头儿","小小的","正好","恰好","刚好","干脆","索性","果断","立马","立刻","赶紧","趁着","顺利","有幸","可惜","遗憾","无奈","咬牙","琢磨","搞定","捣鼓","攒","盘算"]
out=open("batch2_report.txt","w",encoding="utf-8")
for w in sorted(words, key=lambda x:-sum(1 for r,f,s in sents if x in s)):
    hits=[(r,f,s) for r,f,s in sents if w in s]
    if not hits:
        continue
    t=sum(1 for r,_,_ in hits if r=="tech")
    out.write(f"{w}\t{len(hits)}\t(t{t}/p{len(hits)-t})\n")
    for r,f,s in hits[:1]:
        i=s.find(w); out.write(f"   [{r}] ...{s[max(0,i-35):i+len(w)+45]}...\n")
out.write("\n== JIUBU pattern ==\n")
pat=re.compile(r"就不.{0,8}了")
for r,f,s in sents:
    m=pat.search(s)
    if m: out.write(f" [{r}] ...{s[max(0,m.start()-30):m.end()+20]}...\n")
out.close()
print("ok")
