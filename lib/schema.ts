// ───────────────────────────────────────────────────────────────────────────
// 项目数据契约：历史人物关系图谱（AI 发展史）
// 所有考证产出必须落进此格式才能合并渲染。
//
// 不可编造的硬规则（唯一不可妥协）：每条关系必须带一句【逐字 verbatim 原句】+【该原句所在真实 URL】；
// grader 重新 fetch 该 URL、确认页面里确实存在这句话且这句话确实支持这层关系，方可 verified。
// 定位不到 → 待复核 或剔除；只靠模型记忆 → 绝不入图。
// 不搞 0-1 置信分数，状态只有三态（不连/脑补者根本不入此数据集）。
// ───────────────────────────────────────────────────────────────────────────

export type RelationType =
  | "师承" | "同门" | "同事" | "联创" | "投资" | "收购" | "决裂" | "其他";

// 数据集里只保留两态；drop（无源/脑补/核对不过）不写入数据集
export type RelStatus = "verified" | "待复核";

export interface SourceRef {
  url: string;            // 原句所在真实 URL
  verbatim_quote: string; // 逐字摘自该页的支持原句（不改写 / 不总结 / 不翻译）
}

export interface Person {
  id: string;             // 规范 = 英文全名（跨研究单元据此合并）
  name_cn: string;
  name_en: string;
  birth_year: number | null;
  death_year?: number | null;
  identity: string;       // 代表身份
  affiliations?: { org: string; role: string; start: number | null; end: number | null }[];
  influence: number;      // 0-1，视觉大小权重（祖师爷/枢纽大）
}

export interface Relationship {
  person_a: string;       // Person.id
  person_b: string;       // Person.id（师承等有向：a = 导师/前驱，b = 学生/后继）
  relation_type: RelationType;
  directed: boolean;
  time_start: number | null;
  time_end: number | null;
  context: string;        // 机构 / 地点
  fact: string;           // 一句话事实描述
  source: SourceRef;      // 已被 grader 重新 fetch 核对的来源（verbatim 原句 + URL）
  status: RelStatus;      // verified = 实线；待复核 = 虚线/暗显
}

export interface GraphDataset {
  topic: string;          // 如 "Geoffrey Hinton 学术谱系（AI 发展史样本）"
  persons: Person[];
  relationships: Relationship[];
  generated_at?: string;
}

// 关系类型 → 视觉编码（render 用；不同类型不同颜色/线型，立信息层次）
export const REL_STYLE: Record<RelationType, { color: string; label: string; dashed?: boolean; weight: number }> = {
  师承: { color: "#ffc24b", label: "师承",     weight: 2.0 },          // 金 · 最重，立辈分主轴
  同门: { color: "#9db4d8", label: "同门",     weight: 1.0 },
  同事: { color: "#5ee6ff", label: "同事",     weight: 1.1 },          // 青
  联创: { color: "#7cff9d", label: "联合创始", weight: 1.6 },          // 绿
  投资: { color: "#5a86ff", label: "投资",     weight: 1.1 },          // 蓝
  收购: { color: "#a78bff", label: "收购",     weight: 1.3 },          // 紫
  决裂: { color: "#ff6b5e", label: "决裂",     weight: 1.3, dashed: true }, // 红 · 断裂线
  其他: { color: "#8a99b8", label: "其他",     weight: 0.9 },
};
