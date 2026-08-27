import { NextRequest, NextResponse } from "next/server";
import { getAllQuestions, saveCuration } from "@/lib/store";
import { curateTop } from "@/lib/rank";
import { hostAuthorized } from "@/lib/hostAuth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!hostAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const questions = (await getAllQuestions()).filter((q) => !q.hidden);
  if (questions.length === 0) {
    return NextResponse.json({ error: "No questions yet." }, { status: 400 });
  }
  try {
    const top = await curateTop(questions);
    const curation = { ts: Date.now(), top };
    await saveCuration(curation);
    return NextResponse.json({ ok: true, curation });
  } catch {
    return NextResponse.json(
      { error: "Curation failed — the live ranked list below still works." },
      { status: 500 }
    );
  }
}
