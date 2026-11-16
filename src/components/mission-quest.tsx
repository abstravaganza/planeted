"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Check, ChevronRight, Lock, RotateCcw, Zap } from "lucide-react";
import {
  getMission,
  missions,
  stages,
  questFeedbackSchema,
  type MissionId,
} from "@/lib/missions";
import {
  approveTranscript,
  available,
  completeStage,
  failedFeedback,
  feedbackArrived,
  missionPatch,
  oldKeys,
  QUEST_KEY,
  replayMission,
  restartChallenge,
  submitOriginal,
  xp,
  type MissionState,
} from "@/lib/quest-state";
import { patterns } from "@/lib/corrections";
import { useQuest } from "./use-quest";
import { Workspace } from "./workspace";
import { MissionArt } from "./mission-art";
import { CorrectedBuilder } from "./corrected-builder";
import { DevelopStage } from "./develop-stage";
import { QuestBoss } from "./quest-boss";
import { BubbleGrammar } from "./bubble-grammar";
import { ZinaActor } from "./zina-actor";
import { ReviewStage } from "./review-stage";
import { SavedAudio } from "./saved-audio";
import { Recorder } from "./recorder";
import { Button, Notice } from "./ui";
import { Help } from "./help";
import { ServiceStatus } from "./service-status";
function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function MissionQuest() {
  const { state, commit, ready, error } = useQuest();
  const [legacy, setLegacy] = useState(false);
  const [resetNotice, setResetNotice] = useState("");
  const [mode, setMode] = useState<"demo" | "ai">("demo");
  const [cap, setCap] = useState({
    aiAvailable: false,
    transcriptionAvailable: false,
    audioRetentionHours: 0,
  });
  const modeChosen = useRef(false);
  const busy = false;
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const id = state.selected;
  const m = id ? state.missions[id] : null;
  const mission = id ? getMission(id) : null;
  const mutate = useCallback(
    (topic: MissionId, fn: (m: MissionState) => MissionState) =>
      commit((s) => missionPatch(s, topic, fn)),
    [commit],
  );
  const update = useCallback(
    (fn: (m: MissionState) => MissionState) => {
      if (id) mutate(id, fn);
    },
    [id, mutate],
  );
  const refreshCapabilities = useCallback(() => {
    fetch("/api/learning", { cache: "no-store" })
      .then((r) => r.json())
      .then((value) => {
        const next = z
          .object({
            aiAvailable: z.boolean(),
            transcriptionAvailable: z.boolean(),
            audioRetentionHours: z.number().default(0),
          })
          .parse(value);
        setCap(next);
        if (!modeChosen.current) {
          let preferred = "";
          try {
            preferred =
              localStorage.getItem("writing-quest:service-mode") ?? "";
          } catch {}
          setMode(
            preferred === "demo" ? "demo" : next.aiAvailable ? "ai" : "demo",
          );
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshCapabilities();
  }, [refreshCapabilities]);
  useEffect(() => {
    heading.current?.focus();
  }, [id, m?.stage]);
  function selectMission(selected: MissionId) {
    commit((s) => {
      const tapNeed = Object.values(s.missions).flatMap(
        (m) => m.engine.tap.needsReview,
      )[0];
      const target = s.missions[selected];
      const tapTarget =
        tapNeed && !Object.keys(target.engine.tap.sessions).length
          ? {
              ...target.engine.tap,
              selected: tapNeed,
              needsReview: [
                ...new Set([...target.engine.tap.needsReview, tapNeed]),
              ],
            }
          : target.engine.tap;
      const need = Object.values(s.missions).flatMap(
        (m) => m.engine.reviewNeeded,
      )[0];
      return {
        ...s,
        selected,
        missions: {
          ...s.missions,
          [selected]:
            need && !Object.keys(s.missions[selected].engine.grammar).length
              ? {
                  ...s.missions[selected],
                  activePattern: need as "with" | "after" | "because",
                  engine: {
                    ...s.missions[selected].engine,
                    targetedPattern: need as "with" | "after" | "because",
                    tap: tapTarget,
                  },
                }
              : { ...target, engine: { ...target.engine, tap: tapTarget } },
        },
      };
    });
  }
  async function feedback(target: MissionId) {
    const requestId = crypto.randomUUID();
    const next = mutate(target, (current) =>
      current.status === "loading"
        ? current
        : submitOriginal(current, requestId),
    );
    const current = next.missions[target];
    if (current.requestId !== requestId || current.original === null) return;
    try {
      const response = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          missionId: target,
          operation: "feedback",
          mode,
          text: current.original,
          practiceEvidence: {
            guidedMode: "tap",
            hintCount: current.engine.hintCount,
            recallCompleted: Object.values(current.engine.build).filter((b) =>
              b.completed.includes(3),
            ).length,
            skippedPatterns: current.engine.reviewNeeded,
          },
        }),
      });
      if (!response.ok) throw new Error();
      const result = z
        .object({
          source: z.enum(["demo", "ai"]),
          data: questFeedbackSchema,
          sample: z.string().optional(),
          notice: z.string().optional(),
        })
        .parse(await response.json());
      mutate(target, (c) =>
        c.requestId === requestId
          ? {
              ...feedbackArrived(
                c,
                requestId,
                result.data,
                result.source,
                result.sample ?? "",
              ),
              error: result.notice ?? "",
            }
          : c,
      );
    } catch {
      mutate(target, (c) => failedFeedback(c, requestId));
    }
  }
  function backup() {
    let raw: Record<string, string | null> = {};
    try {
      raw = Object.fromEntries(
        [...oldKeys, QUEST_KEY].map((k) => [k, localStorage.getItem(k)]),
      );
    } catch {}
    download(
      "writing-quest-backup.json",
      JSON.stringify({ saved: raw, session: state }, null, 2),
    );
  }
  if (legacy)
    return (
      <>
        <div className="q-legacy-bar">
          <Button onClick={() => setLegacy(false)}>← Six-mission quest</Button>
          <span>Previous practice · original saves and revisions</span>
        </div>
        <Workspace />
      </>
    );
  const total = Object.values(state.missions).reduce((n, m) => n + xp(m), 0);
  const oldPresent = Object.values(state.legacy).some(Boolean);
  return (
    <div
      className={`q-app ${!state.settings.motion ? "q-reduced" : ""} ${state.settings.quiet ? "q-quiet" : ""}`}
    >
      <a className="skip-link" href="#quest-main">
        Skip to activity
      </a>
      <aside className="q-sidebar">
        <button
          className="q-brand"
          onClick={() => commit((s) => ({ ...s, selected: null }))}
        >
          <span className="q-brand-mark">ж</span>
          <span>
            writing
            <br />
            <strong>quest.</strong>
          </span>
        </button>
        <div className="q-language">Я · RUSSIAN</div>
        <button
          className="q-home"
          onClick={() => commit((s) => ({ ...s, selected: null }))}
        >
          <ArrowLeft size={16} /> All missions
        </button>
        {mission && m ? (
          <>
            <p className="q-sidebar-topic" lang="ru">
              {mission.title}
            </p>
            <nav aria-label="Mission stages">
              {stages.map((name, i) => (
                <button
                  key={name}
                  className={`q-stage ${m.stage === i ? "current" : ""} ${m.completed.includes(i) ? "complete" : ""}`}
                  aria-current={m.stage === i ? "step" : undefined}
                  disabled={busy || !available(m, i)}
                  onClick={() => update((s) => ({ ...s, stage: i }))}
                >
                  <span>
                    {m.completed.includes(i) ? (
                      <Check size={16} />
                    ) : available(m, i) ? (
                      i + 1
                    ) : (
                      <Lock size={13} />
                    )}
                  </span>
                  <span>{name}</span>
                </button>
              ))}
            </nav>
            <div className="q-mission-progress">
              <strong>{m.completed.length}/6 complete</strong>
              <progress
                aria-label="Mission progress"
                max={6}
                value={m.completed.length}
              />
            </div>
            {m.original !== null && (
              <Button
                variant="secondary"
                onClick={() => update((s) => ({ ...s, stage: 6 }))}
              >
                View feedback
              </Button>
            )}
          </>
        ) : (
          <div className="q-sidebar-note">
            Your ideas.
            <br />
            Your Russian.
            <br />
            <span>Your next level.</span>
          </div>
        )}
        <div className="q-side-bottom">
          <div
            className="q-xp"
            role="status"
            aria-label={`Total ${total} XP`}
            key={total}
          >
            <Zap size={25} fill="currentColor" />
            <strong>{total}</strong>
            <span>XP</span>
          </div>
          <details className="q-settings">
            <summary>Comfort settings</summary>
            <label>
              <input
                type="checkbox"
                checked={!state.settings.motion}
                onChange={(e) =>
                  commit((s) => ({
                    ...s,
                    settings: { ...s.settings, motion: !e.target.checked },
                  }))
                }
              />{" "}
              Reduce motion
            </label>
            <label>
              <input
                type="checkbox"
                checked={state.settings.quiet}
                onChange={(e) =>
                  commit((s) => ({
                    ...s,
                    settings: { ...s.settings, quiet: e.target.checked },
                  }))
                }
              />{" "}
              Quiet character
            </label>
            <label>
              <input
                type="checkbox"
                checked={state.settings.sound}
                onChange={(e) =>
                  commit((s) => ({
                    ...s,
                    settings: { ...s.settings, sound: e.target.checked },
                  }))
                }
              />{" "}
              Submission sound
            </label>
            <div className="q-mobile-utilities">
              <button className="q-text-button" onClick={backup}>
                Export all saved work
              </button>
              {oldPresent && (
                <button
                  className="q-text-button"
                  onClick={() => setLegacy(true)}
                >
                  Open previous practice
                </button>
              )}
            </div>
          </details>
          {m && m.original !== null && (
            <button
              className="q-text-button q-mobile-feedback"
              onClick={() => update((s) => ({ ...s, stage: 6 }))}
            >
              View feedback
            </button>
          )}
          <button className="q-text-button q-desktop-utility" onClick={backup}>
            Export all saved work
          </button>
          {oldPresent && (
            <button
              className="q-text-button q-desktop-utility"
              onClick={() => setLegacy(true)}
            >
              Open previous practice
            </button>
          )}
          <Help label="About this prototype">
            Original preparation prompts; no official ACTFL/AAPPL scores. Work
            saves in this browser, not an account. Export it before clearing
            browser data. Demo examples are labeled. AI suggestions need your
            approval.
          </Help>
        </div>
      </aside>
      <div className="q-main-shell">
        <header className="q-topbar">
          <span>
            {mission ? mission.english : "RUSSIAN WRITING QUEST"}
            {m && (
              <>
                {" "}
                <ChevronRight size={14} />{" "}
                {m.stage === 6 ? "Results" : `${m.stage + 1} / 6`}
              </>
            )}
          </span>
          <label>
            <span className="sr-only">Learning mode</span>
            <select
              aria-label="Learning mode"
              value={mode}
              disabled={busy || m?.status === "loading"}
              onChange={(e) => {
                modeChosen.current = true;
                try {
                  localStorage.setItem(
                    "writing-quest:service-mode",
                    e.target.value,
                  );
                } catch {}
                setMode(e.target.value as "demo" | "ai");
              }}
            >
              <option value="demo">Demo mode</option>
              <option value="ai" disabled={!cap.aiAvailable}>
                AI mode{!cap.aiAvailable ? " · unavailable" : ""}
              </option>
            </select>
          </label>
          <ServiceStatus onRefresh={refreshCapabilities} />
        </header>
        <main
          id="quest-main"
          className={`q-main ${m?.stage === 5 ? "q-independent" : ""}`}
        >
          <div className="q-page-title">
            <span className="q-eyebrow">
              {mission ? mission.title : "CHOOSE YOUR NEXT ADVENTURE"}
            </span>
            <h1 ref={heading} tabIndex={-1}>
              {m
                ? m.stage === 6
                  ? "Mission results"
                  : stages[m.stage]
                : "What’s your story?"}
            </h1>
            {m && (
              <Button variant="ghost" onClick={() => update(restartChallenge)}>
                New recording · restart challenge
              </Button>
            )}
            {!m && <p>Six missions. One voice. Yours.</p>}
          </div>
          {error && (
            <Notice>
              {error} <Button onClick={backup}>Export backup</Button>
            </Notice>
          )}
          {!ready && !error && <Notice>Opening your saved quest…</Notice>}
          {ready && !mission && (
            <>
              <p className="sr-only" role="status">{resetNotice}</p>
              <div className="q-mission-grid">
                {missions.map((config) => {
                  const saved = state.missions[config.id];
                  return (
                    <article
                      key={config.id}
                      className={`q-mission-card theme-${config.theme}`}
                    >
                      <div className="q-card-art">
                        <MissionArt id={config.id} />
                        <span className="q-difficulty">
                          {config.difficulty}
                        </span>
                      </div>
                      <div className="q-card-content">
                        <h2 lang="ru">{config.title}</h2>
                        <span className="q-english">{config.english}</span>
                        <p>{config.objective}</p>
                        <div className="q-card-meta">
                          <span>{saved.completed.length}/6 stages</span>
                          <span>120 XP + bonuses</span>
                        </div>
                        <progress
                          aria-label={`${config.english} progress`}
                          max={6}
                          value={saved.completed.length}
                        />
                        <div className="q-card-actions">
                          <Button onClick={() => selectMission(config.id)}>
                            {saved.transcript || saved.stage
                              ? "Continue"
                              : "Play mission"}{" "}
                            <ChevronRight size={17} />
                          </Button>
                          <Button
                            variant="ghost"
                            className="q-card-reset"
                            aria-label={`Reset ${config.english}`}
                            title="Start again. Previous work stays saved."
                            onClick={() => {
                              mutate(config.id, restartChallenge);
                              setResetNotice(`${config.title} reset. Previous work stays saved.`);
                            }}
                          >
                            <RotateCcw size={15} aria-hidden="true" />
                            Reset
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {oldPresent && (
                <Notice>
                  Your previous practice is preserved. Open it from the sidebar
                  to continue or download originals and revisions.
                </Notice>
              )}
            </>
          )}
          {ready && mission && m && (
            <div
              className="q-activity"
              key={`${id}-${m.attemptNumber}-${m.stage}`}
            >
              {m.stage === 0 && (
                <section className="q-panel">
                  <div className="q-speak-hero">
                    <div>
                      <span className="q-eyebrow">
                        START WITH YOUR OWN IDEAS
                      </span>
                      <h2 lang="ru">{mission.title}</h2>
                      <p className="q-prompt">{mission.prompt}</p>
                    </div>
                    <div className="q-small-art">
                      <MissionArt id={mission.id} />
                    </div>
                  </div>
                  <Recorder
                    enabled={cap.transcriptionAvailable}
                    recordingId={`mission-${mission.id}-${m.attemptNumber}`}
                    retentionHours={cap.audioRetentionHours}
                    onRawTranscript={(text, recordingId) =>
                      update((s) => ({
                        ...s,
                        engine: {
                          ...s.engine,
                          rawTranscripts: [
                            ...s.engine.rawTranscripts,
                            { text, recordingId, createdAt: Date.now() },
                          ],
                        },
                      }))
                    }
                    onTranscript={(text) =>
                      update((s) => ({
                        ...s,
                        transcript: s.transcript.trim() ? s.transcript : text,
                        transcriptSource: s.transcript.trim()
                          ? s.transcriptSource
                          : "recorded",
                      }))
                    }
                  />
                  <div className="q-section-line">
                    <label htmlFor="quest-transcript">Your spoken ideas</label>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (m.transcript.trim()) {
                          setMessage(
                            "Your transcript is already here. Clear it yourself before loading the example.",
                          );
                          return;
                        }
                        update((s) => ({
                          ...s,
                          transcript: mission.sample.join(" "),
                          transcriptSource: "example",
                        }));
                      }}
                    >
                      Use demo transcript
                    </Button>
                  </div>
                  {m.transcriptSource === "example" && (
                    <p className="q-provenance">
                      Prepared example · not transcribed from your recording
                    </p>
                  )}
                  {m.engine.rawTranscripts.length > 0 && (
                    <details className="q-review">
                      <summary>
                        Raw provider transcript · preserved separately
                      </summary>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            transcript: s.engine.rawTranscripts.at(-1)!.text,
                            transcriptSource: "recorded",
                          }))
                        }
                      >
                        Use latest raw transcript in editor
                      </Button>
                      {m.engine.rawTranscripts.map((raw, i) => (
                        <div key={i}>
                          <p className="q-exact" lang="ru">
                            {raw.text}
                          </p>
                          <SavedAudio id={raw.recordingId} />
                        </div>
                      ))}
                    </details>
                  )}
                  {m.transcript && (
                    <p className="q-transcript-preview" lang="ru">
                      {m.transcript}
                    </p>
                  )}
                  <details className="q-review">
                    <summary>
                      Type instead or fix transcription (optional)
                    </summary>
                    <textarea
                      id="quest-transcript"
                      lang="ru"
                      maxLength={8000}
                      rows={6}
                      value={m.transcript}
                      onChange={(e) =>
                        update((s) => ({
                          ...s,
                          transcript: e.target.value,
                          transcriptSource: "typed",
                        }))
                      }
                    />
                  </details>
                  {m.generation && m.transcript !== m.generation.transcript && (
                    <Notice>
                      Earlier exercises remain saved. Approve this transcript,
                      then explicitly rebuild in Shape Ideas.
                    </Notice>
                  )}
                  {message && <Notice>{message}</Notice>}
                  <div className="q-actions">
                    <span className="fine">Saved in this browser</span>
                    <Button
                      disabled={!m.transcript.trim()}
                      onClick={() => {
                        setMessage("");
                        update(approveTranscript);
                      }}
                    >
                      Approve transcript →
                    </Button>
                  </div>
                </section>
              )}
              {m.stage === 1 && (
                <ReviewStage
                  transcriptionEnabled={cap.transcriptionAvailable}
                  retentionHours={cap.audioRetentionHours}
                  state={m}
                  missionId={mission.id}
                  mode={mode}
                  update={update}
                />
              )}
              {m.stage === 2 &&
                (m.generation ? (
                  <CorrectedBuilder
                    state={m}
                    missionId={mission.id}
                    mode={mode}
                    sound={state.settings.sound}
                    update={update}
                    onComplete={() => update((s) => completeStage(s, 2))}
                  />
                ) : (
                  <Notice>Approve your sentences in Shape Ideas first.</Notice>
                ))}
              {m.stage === 3 &&
                (m.generation ? (
                  <DevelopStage
                    missionId={mission.id}
                    state={m}
                    mode={mode}
                    update={update}
                    onComplete={() => update((s) => completeStage(s, 3))}
                  />
                ) : (
                  <Notice>Approve your sentences in Shape Ideas first.</Notice>
                ))}
              {m.stage === 4 && (
                <BubbleGrammar
                  missionId={mission.id}
                  state={m}
                  mode={mode}
                  sound={state.settings.sound}
                  update={update}
                  onComplete={() => update((s) => completeStage(s, 4))}
                />
              )}
              {m.stage === 5 && (
                <QuestBoss
                  mission={mission}
                  state={m}
                  update={update}
                  quiet={state.settings.quiet}
                  sound={state.settings.sound}
                  onSubmit={() => void feedback(mission.id)}
                  onFeedback={() => update((s) => ({ ...s, stage: 6 }))}
                />
              )}
              {m.stage === 6 && (
                <section className="q-panel">
                  <div className="q-results-character">
                    <ZinaActor
                      completed
                      mode={state.settings.quiet ? "quiet" : m.engine.bossMode}
                      sound={state.settings.sound}
                    />
                  </div>
                  <div className="q-results-banner">
                    <span aria-hidden="true">✦</span>
                    <div>
                      <h2>
                        {m.status === "ready"
                          ? "Quest complete. Your voice, stronger."
                          : "Your original is safe."}
                      </h2>
                      <p>
                        {xp(m)} XP earned ·{" "}
                        {m.generation?.sentences.length ?? 0} ideas shaped
                      </p>
                    </div>
                  </div>
                  {m.error && <Notice>{m.error}</Notice>}
                  {m.status === "loading" ? (
                    <Notice>
                      Reviewing your saved original… You may leave and return.
                    </Notice>
                  ) : m.status !== "ready" ? (
                    <Button onClick={() => void feedback(mission.id)}>
                      Retry feedback
                    </Button>
                  ) : null}
                  {m.feedback && (
                    <>
                      <p className="q-provenance">
                        {m.feedbackSource === "demo"
                          ? "ILLUSTRATIVE EXAMPLE · NOT AN EVALUATION OF YOUR WRITING"
                          : "AI REVIEW · YOUR SUBMITTED ORIGINAL"}
                      </p>
                      <p>{m.feedback.summary}</p>
                      {m.feedbackSource === "demo" && (
                        <details className="q-review" open>
                          <summary>The example this feedback describes</summary>
                          <p lang="ru">{m.feedbackSample}</p>
                          <p>
                            This prepared example does not establish independent
                            performance and may leave parts of the fresh prompt
                            unanswered.
                          </p>
                        </details>
                      )}
                      <div className="q-feedback-priorities">
                        <div>
                          <h3>
                            {m.feedbackSource === "demo"
                              ? "Example strength"
                              : "Your strength"}
                          </h3>
                          <p>{m.feedback.strengths[0]}</p>
                        </div>
                        <div>
                          <h3>Next moves</h3>
                          {m.feedback.nextSteps.map((step) => (
                            <p key={step}>{step}</p>
                          ))}
                        </div>
                      </div>
                      <details className="q-review">
                        <summary>Learning goals and evidence</summary>
                        {m.feedback.dimensions.map((d) => (
                          <div key={d.name}>
                            <h3>{d.name}</h3>
                            <p>{d.evidence}</p>
                            <p>{d.next}</p>
                          </div>
                        ))}
                      </details>
                      <details className="q-review">
                        <summary>Saved original · unchanged</summary>
                        <p className="q-exact" lang="ru">
                          {m.original}
                        </p>
                      </details>
                      <label className="q-edit-label">
                        Revision · separate from the original
                        <textarea
                          rows={7}
                          lang="ru"
                          maxLength={8000}
                          value={m.revision}
                          onChange={(e) =>
                            update((s) => ({ ...s, revision: e.target.value }))
                          }
                        />
                      </label>
                      <div className="q-actions">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            download(
                              `${mission.id}-writing.txt`,
                              `${mission.bossPrompt}\n\nORIGINAL\n${m.original}\n\nREVISION\n${m.revision}`,
                            )
                          }
                        >
                          Download writing
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => update(replayMission)}
                        >
                          Play again · archive this attempt
                        </Button>
                        <Button
                          onClick={() => update((s) => ({ ...s, stage: 4 }))}
                        >
                          Practice a pattern →
                        </Button>
                      </div>
                    </>
                  )}
                </section>
              )}
              {m.stage !== 5 && (
                <details className="q-review q-notebook">
                  <summary>
                    Your notebook · transcript, sentences, vocabulary & grammar
                  </summary>
                  <p className="q-exact" lang="ru">
                    {m.approvedTranscript || m.transcript}
                  </p>
                  {m.generation?.sentences.map((s) => (
                    <p lang="ru" key={s.id}>
                      {s.text}
                    </p>
                  ))}
                  <p>
                    Vocabulary from your ideas:{" "}
                    <span lang="ru">
                      {[
                        ...new Set(
                          m.generation?.sentences.flatMap((s) =>
                            s.text.split(/\s+/u),
                          ) ?? [],
                        ),
                      ]
                        .slice(0, 30)
                        .join(" · ")}
                    </span>
                  </p>
                  {patterns
                    .filter((p) => m.practice[p.id])
                    .map((p) => (
                      <p key={p.id}>
                        {p.explanation} <span lang="ru">{p.after}</span>
                      </p>
                    ))}
                  {[
                    ...new Map(
                      m.engineHistory
                        .flatMap((h) => h.engine.rawTranscripts)
                        .map((raw) => [raw.recordingId, raw]),
                    ).values(),
                  ].map((raw) => (
                    <details className="q-review" key={raw.recordingId}>
                      <summary>Earlier recorded transcript</summary>
                      <p lang="ru">{raw.text}</p>
                      <SavedAudio id={raw.recordingId} />
                    </details>
                  ))}
                  {m.attemptHistory.map((a, i) => (
                    <details className="q-review" key={`draft-${i}`}>
                      <summary>
                        Earlier challenge {i + 1} · transcript and draft
                      </summary>
                      <p lang="ru">{a.transcript}</p>
                      <p lang="ru">{a.draft}</p>
                      {a.original !== null && <p lang="ru">{a.original}</p>}
                      <p lang="ru">{a.revision}</p>
                    </details>
                  ))}
                  {m.writingHistory.map((attempt, i) => (
                    <details key={`writing-${i}`}>
                      <summary>Previous independent writing {i + 1}</summary>
                      <p className="q-exact" lang="ru">
                        {attempt.original}
                      </p>
                      <p className="q-exact" lang="ru">
                        {attempt.revision}
                      </p>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          download(
                            `${mission.id}-previous-${i + 1}.txt`,
                            `ORIGINAL\n${attempt.original}\n\nREVISION\n${attempt.revision}`,
                          )
                        }
                      >
                        Download previous writing
                      </Button>
                    </details>
                  ))}
                  {m.history.map((g, i) => (
                    <details key={i}>
                      <summary>Previous exercise set {i + 1}</summary>
                      <p lang="ru">{g.transcript}</p>
                      {g.sentences.map((s) => (
                        <p key={s.id} lang="ru">
                          {s.text}
                        </p>
                      ))}
                      <p lang="ru">{g.paragraph}</p>
                    </details>
                  ))}
                </details>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
