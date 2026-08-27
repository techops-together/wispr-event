import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { randomUUID } from "crypto";
import {
  saveQuestion,
  updateQuestion,
  bumpCounter,
  questionCount,
  maxQuestions,
  type Question,
} from "@/lib/store";
import { scoreQuestion } from "@/lib/rank";

export const runtime = "nodejs";

const BURST_LIMIT = 2; // submissions per 30s per IP
const HOURLY_LIMIT = 15; // submissions per hour per IP

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

export async function POST(req: NextRequest) {
  let body: { name?: string; org?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name ?? "").trim().slice(0, 60);
  const org = (body.org ?? "").trim().slice(0, 80);
  const question = (body.question ?? "").trim().slice(0, 500);

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Please add your name so Shubham can call on you." },
      { status: 400 }
    );
  }
  if (question.length < 10) {
    return NextResponse.json(
      { error: "That question looks a little short — give it another go." },
      { status: 400 }
    );
  }

  const ip = clientIp(req);
  const burst = await bumpCounter(`wispr:rl:b:${ip}`, 30);
  const hourly = await bumpCounter(`wispr:rl:h:${ip}`, 3600);
  if (burst > BURST_LIMIT || hourly > HOURLY_LIMIT) {
    return NextResponse.json(
      { error: "Easy there — give it a moment before sending another." },
      { status: 429 }
    );
  }

  if ((await questionCount()) >= maxQuestions) {
    return NextResponse.json(
      { error: "The question queue is full for tonight." },
      { status: 429 }
    );
  }

  const q: Question = {
    id: randomUUID().slice(0, 8),
    name,
    org,
    question,
    ts: Date.now(),
    score: null,
    topic: "",
    reason: "",
    flagged: false,
    hidden: false,
    pinned: false,
  };
  await saveQuestion(q);

  // Score with Claude after responding, so the attendee gets instant feedback.
  after(async () => {
    const result = await scoreQuestion(name, org, question);
    await updateQuestion(q.id, {
      score: result.score,
      topic: result.topic,
      reason: result.reason,
      flagged: result.flagged,
      hidden: result.flagged, // auto-hide flagged content; host can unhide
    });
  });

  return NextResponse.json({ ok: true, id: q.id });
}
