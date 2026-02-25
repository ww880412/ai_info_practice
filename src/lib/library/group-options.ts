export interface GroupTreeNode {
  id: string;
  name: string;
  children: GroupTreeNode[];
}

export interface GroupOption {
  id: string;
  label: string;
}

export function flattenGroupOptions(nodes: GroupTreeNode[], lineage: string[] = []): GroupOption[] {
  const result: GroupOption[] = [];

  for (const node of nodes) {
    const nextLineage = [...lineage, node.name];
    result.push({
      id: node.id,
      label: nextLineage.join(" / "),
    });
    result.push(...flattenGroupOptions(node.children, nextLineage));
  }

  return result;
}
