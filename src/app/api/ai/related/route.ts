import { NextRequest, NextResponse } from "next/server";
import { findRelatedEntries } from "@/lib/ai/associationDiscovery";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get("entryId");

  if (!entryId) {
    return NextResponse.json({ error: "entryId required" }, { status: 400 });
  }

  const relatedEntries = await findRelatedEntries(entryId);

  return NextResponse.json({ relatedEntries });
}
