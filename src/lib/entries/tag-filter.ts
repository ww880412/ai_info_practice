import type { Prisma } from "@prisma/client";

type TagField = "aiTags" | "userTags";

interface CombinedTagFilterInput {
  aiAll: string[];
  aiAny: string[];
  userAll: string[];
  userAny: string[];
}

export function normalizeTagList(raw: string | null): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

export function buildTagCategoryCondition(
  field: TagField,
  allTags: string[],
  anyTags: string[]
): Prisma.EntryWhereInput | null {
  if (allTags.length === 0 && anyTags.length === 0) return null;

  const clause: Prisma.StringNullableListFilter = {};
  if (allTags.length > 0) clause.hasEvery = allTags;
  if (anyTags.length > 0) clause.hasSome = anyTags;

  return { [field]: clause } as Prisma.EntryWhereInput;
}

export function buildCombinedTagFilterCondition(
  input: CombinedTagFilterInput
): Prisma.EntryWhereInput | null {
  const aiCondition = buildTagCategoryCondition("aiTags", input.aiAll, input.aiAny);
  const userCondition = buildTagCategoryCondition("userTags", input.userAll, input.userAny);

  if (aiCondition && userCondition) {
    return { OR: [aiCondition, userCondition] };
  }
  return aiCondition || userCondition;
}

