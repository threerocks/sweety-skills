# 挖掘数据不入库

语料句子文件与统计报告含正文内容（其中课程语料为付费内容），不进公开仓库。

- 本地数据位置：`~/.codex/writing-style/liulei/mining-2026-09-01/`
- 重新生成：依次运行本目录 `mine1_discover.py`（基座）、`mine3_course.py`（课程主语料）、`mine2_kwic.py` / `mine4_course_kwic.py`（精确计数与例句）、`verify_neg.py`（排除表核验）。语料位置见各脚本头部与 lexicon 来源表。
