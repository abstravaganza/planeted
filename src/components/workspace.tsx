"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Check, ChevronRight, Lock, Zap, ArrowLeft } from "lucide-react";
import {
  getSteps,
  getTopic,
  topicIds,
  writingStage,
  feedbackStage,
  writingPrompt,
  type TopicId,
} from "@/lib/topics";
import {
  canNavigate,
  navigateTopic,
  finishStage,
  updateProgress,
  beginFeedback,
  receiveFeedback,
  failFeedback,
  topicXp,
  savePractice,
  nextAttempt,
  WORKSPACE_KEY,
  LEGACY_PACKS_KEY,
  STORAGE_KEY,
  type TopicState,
} from "@/lib/workspace";
import type { Progress } from "@/lib/progress";
import { feedbackSchema } from "@/lib/contracts";
import { learningRequest } from "@/lib/client";
import { useWorkspace } from "./use-workspace";
import { SportsActivity } from "./quest";
import { TopicActivity } from "./topic-activity";
import { WritingEditor } from "./writing-editor";
import { FeedbackPanel } from "./feedback-panel";
import { Button, Notice } from "./ui";
import { Help } from "./help";
function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Workspace() {
  const { workspace, commit, ready, error } = useWorkspace();
  const [mode, setMode] = useState<"demo" | "ai">("demo");
  const [capabilities, setCapabilities] = useState({
    aiAvailable: false,
    transcriptionAvailable: false,
  });
  const title = useRef<HTMLHeadingElement>(null);
  const id = workspace.selectedTopic;
  const topic = id ? workspace.topics[id] : null;
  const p = topic?.progress;
  const steps = id ? getSteps(id) : [];
  const independent = Boolean(
    id && p?.stage === writingStage(id) && p.original === null,
  );
  useEffect(() => {
    let active = true;
    fetch("/api/learning")
      .then((r) => r.json())
      .then((value) => {
        if (active)
          setCapabilities(
            z
              .object({
                aiAvailable: z.boolean(),
                transcriptionAvailable: z.boolean(),
              })
              .parse(value),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    title.current?.focus();
  }, [id, p?.stage]);
  function mutate(topicId: TopicId, change: (topic: TopicState) => TopicState) {
    return commit((state) => ({
      ...state,
      topics: { ...state.topics, [topicId]: change(state.topics[topicId]) },
    }));
  }
  function update(patch: Partial<Progress>) {
    if (id) mutate(id, (topic) => updateProgress(topic, patch));
  }
  function go(stage: number) {
    if (id) mutate(id, (topic) => navigateTopic(id, topic, stage));
  }
  async function feedback(topicId: TopicId) {
    const requestId = crypto.randomUUID();
    const snapshot = mutate(topicId, (topic) =>
      topic.status === "loading"
        ? topic
        : beginFeedback(topicId, topic, requestId),
    );
    const saved = snapshot.topics[topicId];
    if (saved.requestId !== requestId || saved.progress.original === null)
      return;
    try {
      const result = await learningRequest(
        "feedback",
        saved.progress.original,
        mode,
        topicId,
        feedbackSchema,
      );
      mutate(topicId, (current) =>
        receiveFeedback(
          topicId,
          current,
          requestId,
          result,
          result.sample ?? "",
        ),
      );
    } catch {
      mutate(topicId, (current) => failFeedback(current, requestId));
    }
  }
  function download() {
    if (!id || !topic) return;
    downloadText(
      `writing-quest-${id}.txt`,
      `${getTopic(id).title}\n\n${writingPrompt(id)}\n\nORIGINAL\n${p?.original ?? p?.draft ?? ""}\n\nREVISION\n${p?.revision ?? ""}\n` +
        topic.archives
          .map(
            (a, i) =>
              `\nPREVIOUS ${i + 1} ORIGINAL\n${a.original}\n\nREVISION\n${a.revision}\n`,
          )
          .join(""),
    );
  }
  function backup() {
    const data = Object.fromEntries(
      [WORKSPACE_KEY, STORAGE_KEY, LEGACY_PACKS_KEY].map((key) => {
        try {
          return [key, localStorage.getItem(key)];
        } catch {
          return [key, null];
        }
      }),
    );
    downloadText("writing-quest-backup.json", JSON.stringify(data, null, 2));
  }
  const xp = topicIds.reduce(
    (n, key) => n + topicXp(key, workspace.topics[key]),
    0,
  );
  const heading =
    id && p
      ? p.stage === writingStage(id)
        ? "Independent writing"
        : p.stage === feedbackStage(id)
          ? "Feedback & practice"
          : steps[p.stage] === "Build"
            ? "Colored Sentence Builder"
            : steps[p.stage] === "Mission"
              ? getTopic(id).title
              : steps[p.stage] === "Expand"
                ? "Level up your sentence"
                : steps[p.stage]
      : "Choose a challenge";
  return (
    <div className="app-shell focused-workspace">
      <a className="skip-link" href="#main">
        Skip to activity
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          aria-label="Writing Quest topics"
          disabled={!ready}
          onClick={() => commit((state) => ({ ...state, selectedTopic: null }))}
        >
          <span className="brand-mark">ж</span>
          <span>
            writing<span className="brand-bottom">quest.</span>
          </span>
        </button>
        <div className="language-chip">
          <span className="language-icon">Я</span>Russian
        </div>
        <button
          className="side-home"
          disabled={!ready}
          onClick={() => commit((state) => ({ ...state, selectedTopic: null }))}
        >
          <ArrowLeft size={15} />
          Topics
        </button>
        {id && topic && p ? (
          <>
            <div className="sidebar-topic" lang="ru">
              {getTopic(id).title}
            </div>
            <nav aria-label="Topic stages" className="journey-nav">
              {steps.map((step, index) => (
                <button
                  key={step}
                  className={`journey-item ${p.stage === index ? "active" : ""} ${p.completed.includes(index) ? "done" : ""}`}
                  aria-label={step}
                  aria-current={p.stage === index ? "step" : undefined}
                  disabled={
                    !ready ||
                    !canNavigate(id, topic, index) ||
                    (independent && index !== p.stage)
                  }
                  onClick={() => go(index)}
                >
                  <span className="step-node">
                    {p.completed.includes(index) ? (
                      <Check size={13} />
                    ) : !canNavigate(id, topic, index) ? (
                      <Lock size={11} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span>{step}</span>
                </button>
              ))}
            </nav>
            <div className="sidebar-progress">
              <span>
                {p.completed.filter((n) => n < steps.length).length}/
                {steps.length}
              </span>
              <progress
                aria-label="Topic progress"
                value={p.completed.filter((n) => n < steps.length).length}
                max={steps.length}
              />
            </div>
          </>
        ) : (
          <div className="sidebar-topic">Your challenges</div>
        )}
        <div className="sidebar-help">
          <Help label="About Writing Quest">
            Original practice for heritage learners. Work saves in this browser.
            Demo feedback describes an example; AI Mode evaluates your submitted
            original. No official ACTFL/AAPPL ratings. Download your writing to
            keep a portable copy.
          </Help>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{id ? getTopic(id).english : "Russian Writing Quest"}</span>
            {id && (
              <>
                <ChevronRight size={13} />
                <span>
                  {p!.stage + 1}/{steps.length}
                </span>
              </>
            )}
          </div>
          <div className="topbar-right">
            {id && p?.original !== null && p?.original !== undefined && (
              <Button
                className="topbar-feedback"
                variant="ghost"
                onClick={() => go(feedbackStage(id))}
              >
                View feedback
              </Button>
            )}
            <label>
              <span className="sr-only">Learning mode</span>
              <select
                aria-label="Learning mode"
                value={mode}
                disabled={independent}
                onChange={(e) => setMode(e.target.value as "demo" | "ai")}
              >
                <option value="demo">Demo mode</option>
                <option value="ai" disabled={!capabilities.aiAvailable}>
                  AI mode{!capabilities.aiAvailable ? " · unavailable" : ""}
                </option>
              </select>
            </label>
            <span className="xp-pill">
              <Zap size={15} />
              {xp} XP
            </span>
          </div>
        </header>
        <main
          id="main"
          className={`main-content ${independent ? "independent" : ""}`}
        >
          <div className="page-heading">
            <h1 ref={title} tabIndex={-1}>
              {heading}
            </h1>
          </div>
          {error && (
            <Notice>
              {error}
              <Button variant="secondary" onClick={backup}>
                Download backup
              </Button>
            </Notice>
          )}
          {!ready && !error && <Notice>Loading saved work…</Notice>}
          {ready && !id && (
            <div className="topic-grid catalog-grid">
              {topicIds.map((key) => {
                const state = workspace.topics[key];
                return (
                  <button
                    key={key}
                    className={`topic-card topic-${key}`}
                    onClick={() =>
                      commit((current) => ({ ...current, selectedTopic: key }))
                    }
                  >
                    <strong lang="ru">{getTopic(key).title}</strong>
                    <span>{getTopic(key).english}</span>
                    <small>
                      {
                        state.progress.completed.filter(
                          (n) => n < getSteps(key).length,
                        ).length
                      }
                      /{getSteps(key).length}
                      <ChevronRight size={14} />
                    </small>
                  </button>
                );
              })}
            </div>
          )}
          {ready && id && topic && p && (
            <div className="activity-column workspace-activity">
              {p.stage === writingStage(id) ? (
                <WritingEditor
                  key={id}
                  prompt={writingPrompt(id)}
                  progress={p}
                  onDraft={(draft) => update({ draft })}
                  onSubmit={() => void feedback(id)}
                  onFeedback={() => go(feedbackStage(id))}
                  onDownload={download}
                />
              ) : p.stage === feedbackStage(id) ? (
                <FeedbackPanel
                  key={id}
                  topicId={id}
                  topic={topic}
                  mode={mode}
                  onRetry={() => void feedback(id)}
                  onRevision={(revision, reward) =>
                    update({
                      revision,
                      ...(reward ? { revisionRewarded: true } : {}),
                    })
                  }
                  onPractice={(patternId, state) =>
                    mutate(id, (current) =>
                      savePractice(current, patternId, state),
                    )
                  }
                  onSelectPattern={(patternId) =>
                    mutate(id, (current) => ({
                      ...current,
                      activePattern: patternId,
                    }))
                  }
                  onDownload={download}
                  onNewAttempt={() => mutate(id, nextAttempt)}
                />
              ) : id === "sports" ? (
                <SportsActivity
                  key={`${id}-${p.stage}`}
                  progress={p}
                  onChange={update}
                  finish={() =>
                    mutate(id, (current) => finishStage(id, current, p.stage))
                  }
                  mode={mode}
                  transcriptionEnabled={
                    mode === "ai" && capabilities.transcriptionAvailable
                  }
                />
              ) : (
                <TopicActivity
                  key={`${id}-${p.stage}`}
                  topicId={id}
                  progress={p}
                  onChange={update}
                  finish={() =>
                    mutate(id, (current) => finishStage(id, current, p.stage))
                  }
                  transcriptionEnabled={
                    mode === "ai" && capabilities.transcriptionAvailable
                  }
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
