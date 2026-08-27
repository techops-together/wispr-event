"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Question = {
  id: string;
  name: string;
  org: string;
  question: string;
  ts: number;
  score: number | null;
  topic: string;
  reason: string;
  flagged: boolean;
  hidden: boolean;
  pinned: boolean;
};

type Curation = { ts: number; top: { id: string; note: string }[] };

function HostDashboard() {
  const params = useSearchParams();
  const key = params.get("key") ?? "";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [curation, setCuration] = useState<Curation | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [curating, setCurating] = useState(false);
  const [status, setStatus] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [resetting, setResetting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/host/questions?key=${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      setUnauthorized(false);
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setCuration(data.curation ?? null);
    } catch {
      // transient — next poll will recover
    }
  }, [key]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  async function act(id: string, action: string) {
    await fetch(`/api/host/action?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    load();
  }

  async function curate() {
    setCurating(true);
    setStatus("Claude is reading every question...");
    try {
      const res = await fetch(`/api/host/curate?key=${encodeURIComponent(key)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error ?? "Curation failed.");
      } else {
        setCuration(data.curation);
        setStatus("");
      }
    } catch {
      setStatus("Curation failed — the ranked list below still works.");
    } finally {
      setCurating(false);
    }
  }

  const byId = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  );
  const visible = questions.filter((q) => showHidden || !q.hidden);
  const people = new Set(
    questions.filter((q) => !q.hidden).map((q) => q.name.toLowerCase())
  ).size;
  const scored = questions.filter((q) => q.score !== null).length;

  // Curation is generated once and cached, but a question can be hidden
  // (or vanish, on a reset) afterward — never show a stale entry that no
  // longer belongs on stage.
  const curatedVisible = (curation?.top ?? []).filter((t) => {
    const q = byId.get(t.id);
    return q && !q.hidden;
  });

  async function resetForEvent() {
    if (
      !window.confirm(
        "This permanently deletes every question and the current curation. Only do this right before doors open. Continue?"
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      await fetch(`/api/host/reset?key=${encodeURIComponent(key)}`, {
        method: "POST",
      });
      await load();
    } finally {
      setResetting(false);
    }
  }

  if (unauthorized) {
    return (
      <main className="tf-container" style={{ paddingTop: 60 }}>
        <p className="tf-eyebrow">Host view</p>
        <h1 className="tf-hero-title">Wrong key.</h1>
        <p className="tf-sub">
          Open this page with the host key: <code>/host?key=...</code>
        </p>
      </main>
    );
  }

  return (
    <>
      <nav className="tf-nav">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/together-navbar-logo.svg" alt="Together" />
        <span className="tf-nav-tag">Host view — live</span>
      </nav>

      <main className="tf-container-wide" style={{ paddingTop: 28, paddingBottom: 64 }}>
        <div className="tf-statrow">
          <div>
            <div className="tf-stat-v">{questions.length}</div>
            <div className="tf-stat-l">questions in</div>
          </div>
          <div>
            <div className="tf-stat-v">{people}</div>
            <div className="tf-stat-l">people asking</div>
          </div>
          <div>
            <div className="tf-stat-v">{scored}</div>
            <div className="tf-stat-l">scored by Claude</div>
          </div>
        </div>

        <div className="tf-hostbar">
          <button
            className="tf-btn tf-btn-primary"
            onClick={curate}
            disabled={curating || questions.length === 0}
          >
            {curating ? "Curating..." : "Curate top 10"}
          </button>
          <button
            className="tf-btn tf-btn-ghost"
            onClick={() => setShowHidden((v) => !v)}
          >
            {showHidden ? "Conceal hidden" : `Show hidden (${questions.filter((q) => q.hidden).length})`}
          </button>
          <button
            className="tf-btn tf-btn-ghost"
            onClick={resetForEvent}
            disabled={resetting}
            title="Deletes every question — use once, right before doors open"
          >
            {resetting ? "Resetting..." : "Reset for event"}
          </button>
          <span className="tf-refresh-note">auto-refreshing every 4s</span>
        </div>
        {status && <p className="tf-small">{status}</p>}

        {curation && curatedVisible.length > 0 && (
          <section className="tf-curated">
            <h2>
              Tonight&apos;s top {curatedVisible.length} — curated{" "}
              {new Date(curation.ts).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </h2>
            {curatedVisible.map((t, i) => {
              const q = byId.get(t.id)!;
              return (
                <div className="tf-curated-item" key={t.id}>
                  <span className="tf-index">
                    ({String(i + 1).padStart(2, "0")})
                  </span>
                  <div>
                    <p className="tf-curated-q">{q.question}</p>
                    <p className="tf-curated-meta">
                      {q.name}
                      {q.org ? ` — ${q.org}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <div className="tf-host-grid">
          {visible.length === 0 && (
            <p className="tf-small">
              Nothing yet — questions appear here the moment they are sent.
            </p>
          )}
          {visible.map((q) => (
            <div
              key={q.id}
              className={
                "tf-qcard" +
                (q.pinned ? " is-pinned" : "") +
                (q.hidden ? " is-hidden" : "")
              }
            >
              <div className="tf-qcard-head">
                <span className="tf-qcard-name">{q.name}</span>
                {q.org && <span className="tf-qcard-org">{q.org}</span>}
                {q.topic && q.score !== null && (
                  <span className="tf-topic">{q.topic}</span>
                )}
                <span className="tf-score">
                  {q.score === null ? "scoring..." : `${q.score}/100`}
                </span>
              </div>
              <p className="tf-qcard-text">{q.question}</p>
              <div className="tf-qcard-actions">
                <button
                  className="tf-btn tf-btn-ghost"
                  onClick={() => act(q.id, q.pinned ? "unpin" : "pin")}
                >
                  {q.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  className="tf-btn tf-btn-ghost"
                  onClick={() => act(q.id, q.hidden ? "unhide" : "hide")}
                >
                  {q.hidden ? "Unhide" : "Hide"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

export default function HostPage() {
  return (
    <Suspense>
      <HostDashboard />
    </Suspense>
  );
}
