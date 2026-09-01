# -*- coding: utf-8 -*-
import json, collections
course = json.load(open("course_sents.json", encoding="utf-8"))
base = json.load(open("sents.json", encoding="utf-8"))
words = ["归根结底","诚然","话虽如此","在我看来","私以为","我个人认为","窃以为","不得不承认","综上所述","总而言之","总的来说","值得一提","不可否认","毋庸置疑","众所周知","首当其冲","不言而喻","显而易见","恰恰相反","与此同时","真香","躺平","摸鱼","打工人","社畜","韭菜","白嫖","yyds","绝绝子","破防","拿捏","天花板","顶流","上头","内卷","内耗","抛砖引玉","共勉","不吝赐教","望周知","敬请谅解","亲们","家人们","宝子","铁子","集美","哦~","呢~","呀~","啦~","呗","咯","哟","深耕","抓手","闭环","颗粒度","组合拳","护城河","方法论升级","认知升级","长期主义","质的飞跃","逆袭","赛道","布局","卡位","击穿","破圈","出圈","起飞","狂飙","炸裂","王炸","硬核","满满干货","干货满满","纯干货","收藏起来","码住","少走弯路","一文读懂","保姆级","手把手","小白也能","零基础","让我们一起","让我们共同","携手","可谓","堪称","无疑是","无疑","毫无疑问","不禁","令人","使得","得以","进而","亦","乃是","便是","此乃"]
for w in words:
    c = sum(1 for r,f,s in course if w in s)
    b = sum(1 for r,f,s in base if w in s)
    if c or b:
        print(f"{w}\tcourse={c}\tbase={b}")
        for r,f,s in ([x for x in course if w in x[2]][:1] + [x for x in base if w in x[2]][:1]):
            i=s.find(w); print(f"    [{r}] ...{s[max(0,i-30):i+len(w)+40]}...")
print("---ZERO in all corpora:---")
print(" ".join(w for w in words if not any(w in s for _,_,s in course) and not any(w in s for _,_,s in base)))
