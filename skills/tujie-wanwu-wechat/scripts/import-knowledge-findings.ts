import fs from "node:fs";
import path from "node:path";

type Certainty = "高确定性" | "中确定性" | "有限确定性";

interface EvidenceItem {
  source_type: string;
  source_label: string;
  source_url: string;
  source_title: string;
  captured_at: string | null;
  evidence_for: string[];
  certainty: Certainty;
  independent: boolean;
  excerpt: string;
  notes: string;
}

interface EvidenceTask {
  title: string;
  category: string;
  knowledge_angle?: string | null;
  evidence_targets?: string[];
  allowed_source_types?: string[];
  evidence_items?: EvidenceItem[];
}

interface EvidencePayload {
  tasks?: EvidenceTask[];
}

interface FindingItem {
  title: string;
  source_type: string;
  source_label: string;
  source_url: string;
  source_title: string;
  excerpt: string;
  notes?: string;
  captured_at?: string;
  certainty?: Certainty;
  evidence_for?: string[];
  independent?: boolean;
}

interface FindingPayload {
  findings?: FindingItem[];
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun import-knowledge-findings.ts --evidence knowledge-evidence.json --findings knowledge-findings.json

批量将核心知识检索结果导入为证据项。`);
  process.exit(1);
}

function readEvidence(filePath: string): EvidencePayload {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as EvidencePayload;
}

function readFindings(filePath: string): FindingItem[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as FindingItem[] | FindingPayload;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.findings)) return parsed.findings;
  throw new Error("Findings JSON must be an array or an object with a findings array");
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function inferEvidenceFor(task: EvidenceTask, finding: FindingItem): string[] {
  if (Array.isArray(finding.evidence_for) && finding.evidence_for.length > 0) {
    return dedupe(finding.evidence_for);
  }

  const text = `${finding.source_title} ${finding.excerpt} ${finding.notes || ""} ${task.knowledge_angle || ""}`;
  const rules: Array<{ target: string; patterns: RegExp[] }> = [
    { target: "外部可观察结构", patterns: [/外部|结构|特征|外形|壳|足|头|尾|鳃|部位|器官/] },
    { target: "可食区域与不可食风险", patterns: [/可食|能吃|不可食|别吃|风险|毒|苦胆|沙线|内脏|食用/] },
    { target: "处理逻辑与误区纠正", patterns: [/处理|清洗|误区|判断|避坑|提醒|怎么做|步骤/] },
    { target: "识别特征与外部结构", patterns: [/识别|辨认|外部|结构|特征/] },
    { target: "习性与栖息环境", patterns: [/习性|栖息|环境|生活在|分布/] },
    { target: "观赏或观察建议", patterns: [/观赏|观察|哪里看|在哪看/] },
    { target: "现象定义与背景", patterns: [/定义|背景|现象|是什么/] },
    { target: "关键原理或机制", patterns: [/原理|机制|为什么|导致|形成/] },
    { target: "误区与可验证实验", patterns: [/误区|实验|验证|常见错误/] },
    { target: "部件结构", patterns: [/部件|结构|组件/] },
    { target: "工作原理", patterns: [/工作原理|运作|机制/] },
    { target: "危险点与误区", patterns: [/危险|误区|风险|注意/] },
    { target: "背景与时间线", patterns: [/背景|时间线|发生于|阶段/] },
    { target: "关键节点", patterns: [/节点|转折|关键一步/] },
    { target: "影响与启示", patterns: [/影响|启示|后果/] },
    { target: "基础概念", patterns: [/概念|定义|是什么/] },
    { target: "核心机制", patterns: [/机制|工作方式|原理/] },
    { target: "边界与常见误解", patterns: [/边界|误解|局限|不能/] },
    { target: "热点背景", patterns: [/背景|事件由来/] },
    { target: "延展知识点", patterns: [/延展|相关知识|补充说明/] },
    { target: "误区澄清", patterns: [/误区|澄清|以为/] },
    { target: "当前剧情关键线索", patterns: [/线索|当前剧情|伏笔/] },
    { target: "人物关系", patterns: [/关系|人物/] },
    { target: "后续推理依据", patterns: [/推理|后续|可能/] },
  ];

  const matches = (task.evidence_targets || []).filter((target) => {
    const rule = rules.find((item) => item.target === target);
    if (!rule) return text.includes(target);
    return rule.patterns.some((pattern) => pattern.test(text));
  });

  return matches.length > 0 ? matches : (task.evidence_targets || []).slice(0, 1);
}

function inferCertainty(task: EvidenceTask, finding: FindingItem): Certainty {
  if (finding.certainty) return finding.certainty;
  const text = `${finding.source_type} ${finding.source_title} ${finding.excerpt} ${finding.notes || ""}`;
  if (/可能|大多|通常|倾向于|推测|或许|一般来说|区域判断/.test(text)) {
    return "有限确定性";
  }
  if (/论文|综述|学术期刊|百科全书|教材|课程资料|教辅/.test(text) && inferEvidenceFor(task, finding).length >= 2) {
    return "高确定性";
  }
  return "中确定性";
}

function main(): void {
  const evidenceArg = getArg("--evidence");
  const findingsArg = getArg("--findings");
  if (!evidenceArg || !findingsArg) printUsage();

  const evidencePath = path.resolve(evidenceArg);
  const payload = readEvidence(evidencePath);
  const findings = readFindings(path.resolve(findingsArg));
  let imported = 0;
  const skipped: string[] = [];

  for (const finding of findings) {
    const task = (payload.tasks || []).find((item) => item.title === finding.title);
    if (!task) {
      skipped.push(`未匹配任务: ${finding.title}`);
      continue;
    }

    const allowed = new Set(task.allowed_source_types || []);
    if (allowed.size > 0 && !allowed.has(finding.source_type)) {
      skipped.push(`来源类型不允许: ${finding.title} -> ${finding.source_type}`);
      continue;
    }

    const evidenceItem: EvidenceItem = {
      source_type: finding.source_type,
      source_label: finding.source_label,
      source_url: finding.source_url,
      source_title: finding.source_title,
      captured_at: finding.captured_at || new Date().toISOString(),
      evidence_for: inferEvidenceFor(task, finding),
      certainty: inferCertainty(task, finding),
      independent: finding.independent !== false,
      excerpt: finding.excerpt,
      notes: finding.notes || "",
    };

    const current = task.evidence_items || [];
    const dedupeKey = `${evidenceItem.source_type}::${evidenceItem.source_url}::${evidenceItem.source_title}`;
    const next = current.filter((item) => `${item.source_type}::${item.source_url}::${item.source_title}` !== dedupeKey);
    next.push(evidenceItem);
    task.evidence_items = next;
    imported += 1;
  }

  fs.writeFileSync(evidencePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    ok: true,
    imported,
    skipped,
  }, null, 2));
}

main();
