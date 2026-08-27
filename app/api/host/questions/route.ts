import { NextRequest, NextResponse } from "next/server";
import { getAllQuestions, getCuration } from "@/lib/store";
import { hostAuthorized } from "@/lib/hostAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!hostAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [questions, curation] = await Promise.all([
    getAllQuestions(),
    getCuration(),
  ]);

  questions.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const sa = a.score ?? -1;
    const sb = b.score ?? -1;
    if (sa !== sb) return sb - sa;
    return b.ts - a.ts;
  });

  return NextResponse.json({ questions, curation });
}
