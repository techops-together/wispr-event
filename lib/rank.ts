import Anthropic from "@anthropic-ai/sdk";
import type { Question } from "./store";

const MODEL = process.env.RANKER_MODEL || "claude-opus-5";

const client = new Anthropic();

const EVENT_CONTEXT = `You are curating a live audience Q&A for a fireside chat hosted by Together Fund
(an operator-led, AI-native VC in the US–India corridor) with Tanay Kothari, Cofounder & CEO of
Wispr Flow, moderated by Shubham Gupta (Cofounder, Together Fund). Event theme: "The Next Billion
Won't Type". Audience: ~100 AI founders, operators, and tech leaders in Gurgaon, India.

Wispr Flow context: voice dictation app used by millions, revenue grew 150%+ for four straight
quarters, just raised a $280M Series B at a $2B valuation, launched Canto (their first proprietary
speech model). Discussion themes: voice as the next interface, dictation as the wedge to
multi-product, agentic workflows, the road to $2B, and why India is central to their growth.

Audience members dictated their questions using Wispr Flow, so expect transcription artifacts —
judge the substance, not the punctuation.`;

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      description:
        "0-100. How good is this question for the live fireside? Reward specificity, relevance to the event themes, novelty, and questions that would spark great conversation on stage. Punish vague, generic, self-promotional, or off-topic submissions.",
    },
    topic: {
      type: "string",
      description:
        "Two-or-three-word topic label, e.g. 'voice interface', 'India strategy', 'Canto model', 'fundraising', 'agentic workflows', 'off topic'.",
    },
    reason: {
      type: "string",
      description: "One short sentence on why this score.",
    },
    flagged: {
      type: "boolean",
      description:
        "true only if the content is abusive, obscene, spam, or clearly inappropriate to show on a screen at a professional event.",
    },
  },
  required: ["score", "topic", "reason", "flagged"],
  additionalProperties: false,
} as const;

export type ScoreResult = {
  score: number;
  topic: string;
  reason: string;
  flagged: boolean;
};

const NEUTRAL: ScoreResult = {
  score: 50,
  topic: "unscored",
  reason: "Automatic scoring unavailable; needs a human look.",
  flagged: false,
};

export async function scoreQuestion(
  name: string,
  org: string,
  question: string
): Promise<ScoreResult> {
  if (!process.env.ANTHROPIC_API_KEY) return NEUTRAL;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCORE_SCHEMA },
      },
      system: EVENT_CONTEXT,
      messages: [
        {
          role: "user",
          content: `Score this audience question.\n\nFrom: ${name}${org ? ` (${org})` : ""}\nQuestion: ${question}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return NEUTRAL;
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return NEUTRAL;
    const parsed = JSON.parse(text) as ScoreResult;
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      topic: String(parsed.topic).slice(0, 40),
      reason: String(parsed.reason).slice(0, 200),
      flagged: Boolean(parsed.flagged),
    };
  } catch {
    return NEUTRAL;
  }
}

