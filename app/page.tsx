"use client";

import { useEffect, useRef, useState } from "react";

// In-page mic fallback (Web Speech API). Wispr is the star of the show, but
// desktop Chrome sometimes fails to expose the accessibility bridge Wispr
// inserts text through — this gives laptop users a path that always works.
// Set to false to hide the fallback and keep the page Wispr-only.
const ENABLE_MIC_FALLBACK = true;

export default function AskPage() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [micState, setMicState] = useState<"unsupported" | "idle" | "listening">(
    "unsupported"
  );
  const formRef = useRef<HTMLFormElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // The fields are uncontrolled on purpose: Wispr Flow (and other dictation
  // tools) insert text through the OS accessibility layer without firing the
  // keyboard events React's controlled inputs depend on. We only mirror the
  // char count, and poll for it so externally-inserted text is counted too.
  useEffect(() => {
    const t = setInterval(() => {
      setCharCount(questionRef.current?.value.length ?? 0);
    }, 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ENABLE_MIC_FALLBACK) return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (SR) setMicState("idle");
  }, []);

  function toggleMic() {
    if (micState === "listening") {
      recognitionRef.current?.stop();
      return;
    }
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-IN";
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      const field = questionRef.current;
      if (text.trim() && field) {
        const cur = field.value.replace(/\s+$/, "");
        field.value = ((cur ? cur + " " : "") + text.trim()).slice(0, 500);
        setCharCount(field.value.length);
      }
    };
    rec.onend = () => setMicState("idle");
    rec.onerror = () => setMicState("idle");
    recognitionRef.current = rec;
    rec.start();
    setMicState("listening");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSending(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      org: String(fd.get("org") ?? ""),
      question: String(fd.get("question") ?? ""),
    };
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — try again.");
        return;
      }
      if (questionRef.current) questionRef.current.value = "";
      setCharCount(0);
      setSent(true);
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <nav className="tf-nav">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/together-navbar-logo.svg" alt="Together" />
        <span className="tf-nav-tag">Together × Wispr Flow — Live Q&amp;A</span>
      </nav>

      <main className="tf-container" style={{ paddingTop: 40, paddingBottom: 64 }}>
        <div style={{ display: sent ? "block" : "none" }}>
          <div className="tf-success">
            <p className="tf-index">(01)</p>
            <h1 className="tf-success-title">
              Question received<span className="tf-hero-em">.</span>
            </h1>
            <p className="tf-sub">
              Shubham might call your name — keep an ear out.
            </p>
            <p className="tf-small" style={{ marginBottom: 28 }}>
              Got another one? The mic is still open.
            </p>
            <button
              className="tf-btn tf-btn-secondary"
              onClick={() => setSent(false)}
            >
              Ask another question
            </button>
          </div>
        </div>

        <div style={{ display: sent ? "none" : "block" }}>
          <p className="tf-eyebrow">Ask Tanay Kothari, live</p>
          <h1 className="tf-hero-title">
            The next billion <span className="tf-hero-em">won&apos;t type</span>.
          </h1>
          <p className="tf-sub">
            Neither should you. Open your Wispr Flow keyboard, dictate your
            question, and send it — the best ones get asked on stage tonight.
          </p>
          <p className="tf-small">
            No Wispr Flow yet? Grab it at{" "}
            <a href="https://wisprflow.ai" target="_blank" rel="noreferrer">
              wisprflow.ai
            </a>{" "}
            — the free plan is all you need.
          </p>

          <hr className="tf-rule" />

          <form ref={formRef} onSubmit={submit}>
            <div className="tf-field">
              <label className="tf-label" htmlFor="name">
                <span className="tf-index">(01)</span> Your name
              </label>
              <input
                id="name"
                name="name"
                className="tf-input"
                placeholder="So Shubham can call on you"
                maxLength={60}
                autoComplete="name"
                required
              />
            </div>

            <div className="tf-field">
              <label className="tf-label" htmlFor="org">
                <span className="tf-index">(02)</span> Company or role{" "}
                <span style={{ textTransform: "none", letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <input
                id="org"
                name="org"
                className="tf-input"
                placeholder="Founder, Acme AI"
                maxLength={80}
                autoComplete="organization"
              />
            </div>

            <div className="tf-field">
              <label className="tf-label" htmlFor="question">
                <span className="tf-index">(03)</span> Your question — speak it
              </label>
              <textarea
                id="question"
                name="question"
                ref={questionRef}
                className="tf-textarea"
                placeholder="Tap here, hit the Wispr Flow key, and just talk."
                maxLength={500}
                required
              />
              <div className="tf-charcount">{charCount}/500</div>
              <p className="tf-small" style={{ marginTop: 6 }}>
                On a laptop and Wispr text not appearing? Fully quit and reopen
                your browser (Cmd+Q), or use your phone
                {micState !== "unsupported" ? ", or tap the mic below." : "."}
              </p>
              {micState !== "unsupported" && (
                <button
                  type="button"
                  className="tf-btn tf-btn-ghost"
                  style={{ marginTop: 8 }}
                  onClick={toggleMic}
                >
                  {micState === "listening"
                    ? "Listening — tap to stop"
                    : "Backup mic — dictate in the browser"}
                </button>
              )}
            </div>

            <button
              className="tf-btn tf-btn-primary tf-btn-block"
              type="submit"
              disabled={sending}
            >
              {sending ? "Sending..." : "Send it to the stage"}
            </button>

            {error && <p className="tf-error">{error}</p>}
          </form>

          <hr className="tf-rule" />

          <p className="tf-small">
            Tanay Kothari, Cofounder &amp; CEO of Wispr Flow, in conversation
            with Shubham Gupta, Cofounder of Together Fund. Gurgaon — tonight.
          </p>
        </div>
      </main>
    </>
  );
}
