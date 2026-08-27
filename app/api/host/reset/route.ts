import { NextRequest, NextResponse } from "next/server";
import { clearAll } from "@/lib/store";
import { hostAuthorized } from "@/lib/hostAuth";

export const runtime = "nodejs";

// Wipes all questions. Meant to be run once, right before doors open, to
// clear out any test submissions.
export async function POST(req: NextRequest) {
  if (!hostAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await clearAll();
  return NextResponse.json({ ok: true });
}
