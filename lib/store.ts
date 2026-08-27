import { Redis } from "@upstash/redis";

export type Question = {
  id: string;
  name: string;
  org: string;
  question: string;
  ts: number;
  // LLM ranking — null until scored
  score: number | null;
  topic: string;
  reason: string;
  flagged: boolean;
  hidden: boolean;
  pinned: boolean;
};

export type Curation = {
  ts: number;
  top: { id: string; note: string }[];
};

const HASH_KEY = "wispr:questions";
const CURATION_KEY = "wispr:curation";
const MAX_QUESTIONS = 1000;

// Upstash on Vercel injects either UPSTASH_* or KV_* names depending on how
// the integration was added — accept both.
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export const usingRedis = redis !== null;

// In-memory fallback for local dev (survives hot reloads via globalThis).
// On Vercel without Redis this degrades per-instance — fine for testing only.
type Mem = {
  questions: Map<string, Question>;
  curation: Curation | null;
  counters: Map<string, { n: number; exp: number }>;
};
const mem: Mem = ((globalThis as any).__wisprMem ??= {
  questions: new Map(),
  curation: null,
  counters: new Map(),
});

export async function saveQuestion(q: Question): Promise<void> {
  if (redis) {
    await redis.hset(HASH_KEY, { [q.id]: JSON.stringify(q) });
  } else {
    mem.questions.set(q.id, q);
  }
}

export async function getQuestion(id: string): Promise<Question | null> {
  if (redis) {
    const raw = await redis.hget(HASH_KEY, id);
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : (raw as Question)) : null;
  }
  return mem.questions.get(id) ?? null;
}

export async function updateQuestion(
  id: string,
  patch: Partial<Question>
): Promise<void> {
  const existing = await getQuestion(id);
  if (!existing) return;
  await saveQuestion({ ...existing, ...patch });
}

export async function getAllQuestions(): Promise<Question[]> {
  if (redis) {
    const all = await redis.hgetall<Record<string, string | Question>>(HASH_KEY);
    if (!all) return [];
    return Object.values(all).map((v) =>
      typeof v === "string" ? (JSON.parse(v) as Question) : v
    );
  }
  return [...mem.questions.values()];
}

export async function questionCount(): Promise<number> {
  if (redis) return (await redis.hlen(HASH_KEY)) ?? 0;
  return mem.questions.size;
}

// Wipes every stored question and the last curation. Used by the host's
// "Reset for event" button — keep this destructive on purpose, no soft-delete.
export async function clearAll(): Promise<void> {
  if (redis) {
    await redis.del(HASH_KEY, CURATION_KEY);
  } else {
    mem.questions.clear();
    mem.curation = null;
  }
}

export const maxQuestions = MAX_QUESTIONS;

export async function saveCuration(c: Curation): Promise<void> {
  if (redis) {
    await redis.set(CURATION_KEY, JSON.stringify(c));
  } else {
    mem.curation = c;
  }
}

export async function getCuration(): Promise<Curation | null> {
  if (redis) {
    const raw = await redis.get(CURATION_KEY);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : (raw as Curation);
  }
  return mem.curation;
}

// Fixed-window counter used for IP rate limiting. Returns the count after
// incrementing; the key expires after windowSec.
export async function bumpCounter(
  key: string,
  windowSec: number
): Promise<number> {
  if (redis) {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, windowSec);
    return n;
  }
  const now = Date.now();
  const entry = mem.counters.get(key);
  if (!entry || entry.exp < now) {
    mem.counters.set(key, { n: 1, exp: now + windowSec * 1000 });
    return 1;
  }
  entry.n += 1;
  return entry.n;
}
