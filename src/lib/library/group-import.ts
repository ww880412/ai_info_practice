export function getGroupImportState(targetGroupId: string | null, selectedCount: number) {
  if (selectedCount <= 0) {
    return {
      canImport: false,
      reason: "Select entries first",
    };
  }

  if (!targetGroupId) {
    return {
      canImport: false,
      reason: "Choose target group",
    };
  }

  return {
    canImport: true,
    reason: "",
  };
}
