import { NextRequest, NextResponse } from "next/server";
import { getQuestion, updateQuestion } from "@/lib/store";
import { hostAuthorized } from "@/lib/hostAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!hostAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, action } = (await req.json()) as {
    id?: string;
    action?: string;
  };
  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }
  const q = await getQuestion(id);
  if (!q) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  switch (action) {
    case "hide":
      await updateQuestion(id, { hidden: true, pinned: false });
      break;
    case "unhide":
      await updateQuestion(id, { hidden: false });
      break;
    case "pin":
      await updateQuestion(id, { pinned: true, hidden: false });
      break;
    case "unpin":
      await updateQuestion(id, { pinned: false });
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
