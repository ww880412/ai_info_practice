export interface TagCountInput {
  tag: string;
  count: number;
}

export interface AggregatedTag {
  tag: string;
  count: number;
  aliases: TagCountInput[];
  filterTags: string[];
}

export interface AggregateTagsOptions {
  limit?: number;
  minCount?: number;
  semantic?: boolean;
}

interface SemanticRule {
  key: string;
  label: string;
  patterns: RegExp[];
}

interface GroupBucket {
  label?: string;
  total: number;
  aliases: Map<string, number>;
}

const SEMANTIC_RULES: SemanticRule[] = [
  {
    key: "agent",
    label: "Agent",
    patterns: [/\bagent\b/i, /agentic/i, /subagent/i, /智能体/, /代理/],
  },
  {
    key: "workflow-automation",
    label: "Workflow / Automation",
    patterns: [/\bworkflow\b/i, /\bautomation\b/i, /工作流/, /自动化/],
  },
  {
    key: "prompt-engineering",
    label: "Prompt Engineering",
    patterns: [/\bprompt\b/i, /提示词/, /提示工程/],
  },
  {
    key: "reinforcement-learning",
    label: "Reinforcement Learning",
    patterns: [/reinforcement learning/i, /强化学习/],
  },
  {
    key: "rag",
    label: "RAG",
    patterns: [/\brag\b/i, /检索增强/],
  },
];

function toPositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const parsed = Math.floor(Number(value));
  if (parsed <= 0) return fallback;
  return parsed;
}

function normalizeTagKey(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSemanticRule(tag: string, normalized: string): SemanticRule | null {
  for (const rule of SEMANTIC_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(tag) || pattern.test(normalized))) {
      return rule;
    }
  }
  return null;
}

function sortAliasEntries(a: TagCountInput, b: TagCountInput): number {
  if (b.count !== a.count) return b.count - a.count;
  return a.tag.localeCompare(b.tag, "zh-Hans");
}

export function aggregateTags(
  input: TagCountInput[],
  options: AggregateTagsOptions = {}
): AggregatedTag[] {
  const minCount = toPositiveInteger(options.minCount, 1);
  const limit = toPositiveInteger(options.limit, 20);
  const semantic = options.semantic ?? true;

  const groups = new Map<string, GroupBucket>();

  for (const item of input) {
    const rawTag = typeof item.tag === "string" ? item.tag.trim() : "";
    const count = Math.floor(item.count);
    if (!rawTag || !Number.isFinite(count) || count <= 0) continue;

    const normalized = normalizeTagKey(rawTag);
    if (!normalized) continue;

    const semanticRule = semantic ? resolveSemanticRule(rawTag, normalized) : null;
    const groupKey = semanticRule?.key ?? normalized;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        label: semanticRule?.label,
        total: 0,
        aliases: new Map<string, number>(),
      });
    }

    const bucket = groups.get(groupKey);
    if (!bucket) continue;

    bucket.total += count;
    bucket.aliases.set(rawTag, (bucket.aliases.get(rawTag) || 0) + count);
    if (!bucket.label && semanticRule?.label) {
      bucket.label = semanticRule.label;
    }
  }

  const aggregated = Array.from(groups.values())
    .map<AggregatedTag>((bucket) => {
      const aliases = Array.from(bucket.aliases.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort(sortAliasEntries);
      const displayTag = bucket.label || aliases[0]?.tag || "Unknown";
      return {
        tag: displayTag,
        count: bucket.total,
        aliases,
        filterTags: aliases.map((alias) => alias.tag),
      };
    })
    .filter((item) => item.count >= minCount)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag, "zh-Hans");
    })
    .slice(0, limit);

  return aggregated;
}

