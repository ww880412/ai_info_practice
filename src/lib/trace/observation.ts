export function stringifyObservation(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    const serialized = JSON.stringify(value, null, 2);
    if (typeof serialized === "string") return serialized;
  } catch {
    // Fall through to String conversion.
  }

  return String(value);
}

export function parseObservation(value: string): unknown {
  const raw = value.trim();
  if (!raw) return "";

  const direct = tryParseJSON(raw);
  if (direct !== null) return direct;

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const fenced = tryParseJSON(fencedMatch[1].trim());
    if (fenced !== null) return fenced;
  }

  const objectMatch = raw.match(/\{[\s\S]*\}$/);
  if (objectMatch?.[0]) {
    const objectParsed = tryParseJSON(objectMatch[0]);
    if (objectParsed !== null) return objectParsed;
  }

  return value;
}

function tryParseJSON(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
