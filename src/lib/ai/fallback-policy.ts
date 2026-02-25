export function isLegacyClassifierFallbackEnabled(
  value: string | undefined
): boolean {
  if (!value) return true;
  return value.toLowerCase() !== "false";
}
