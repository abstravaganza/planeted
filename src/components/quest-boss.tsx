"use client";
import { useEffect } from "react";
import { Clock } from "lucide-react";
import type { MissionConfig } from "@/lib/missions";
import type { MissionState } from "@/lib/quest-state";
import { ZinaActor } from "./zina-actor";
import { Button } from "./ui";
export function QuestBoss({
  mission,
  state,
  quiet,
  sound,
  update,
  onSubmit,
  onFeedback,
}: {
  mission: MissionConfig;
  state: MissionState;
  quiet: boolean;
  sound: boolean;
  update: (fn: (s: MissionState) => MissionState) => void;
  onSubmit: () => void;
  onFeedback: () => void;
}) {
  useEffect(() => {
    if (!state.timerRunning || state.original !== null) return;
    const interval = setInterval(
      () => update((s) => ({ ...s, timerSeconds: s.timerSeconds + 1 })),
      1000,
    );
    return () => clearInterval(interval);
  }, [state.timerRunning, state.original, update]);
  function cue() {
    if (!sound) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
      oscillator.frequency.value = 523;
      oscillator.start();
      oscillator.stop(context.currentTime + 0.3);
      oscillator.onended = () => void context.close();
    } catch {
      /* Sound is optional; submission never depends on it. */
    }
  }
  return (
    <section className="q-panel q-boss-panel">
      <div className="q-boss-intro">
        <div>
          <span className="q-eyebrow">THE FINAL CHALLENGE</span>
          <h2 lang="ru">Баба Зина ждёт.</h2>
          <p>{mission.bossPrompt}</p>
        </div>
        <ZinaActor
          mode={quiet ? "quiet" : state.engine.bossMode}
          sound={sound}
        />
      </div>
      <label className="q-boss-mode">
        Practice atmosphere{" "}
        <select
          aria-label="Boss atmosphere"
          value={state.engine.bossMode}
          onChange={(e) =>
            update((s) => ({
              ...s,
              engine: {
                ...s.engine,
                bossMode: e.target.value as "chaos" | "quiet" | "exam",
              },
            }))
          }
        >
          <option value="quiet">Quiet Mode</option>
          <option value="chaos">Chaos Mode</option>
          <option value="exam">Exam Simulation Mode</option>
        </select>
      </label>
      <div className="q-editor-heading">
        <label htmlFor="boss-writing">Your independent response</label>
        <div className="q-timer">
          <Clock size={19} />
          <span aria-label="Practice time">
            {Math.floor(state.timerSeconds / 60)}:
            {String(state.timerSeconds % 60).padStart(2, "0")}
          </span>
          <Button
            variant="ghost"
            disabled={state.original !== null}
            onClick={() =>
              update((s) => ({ ...s, timerRunning: !s.timerRunning }))
            }
          >
            {state.timerRunning
              ? "Pause timer"
              : state.timerSeconds
                ? "Resume timer"
                : "Start timer"}
          </Button>
        </div>
      </div>
      <textarea
        id="boss-writing"
        className="q-boss-editor"
        lang="ru"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        maxLength={8000}
        value={state.original ?? state.draft}
        readOnly={state.original !== null}
        onChange={(e) => update((s) => ({ ...s, draft: e.target.value }))}
        placeholder="Начни здесь…"
        rows={10}
      />
      <div className="q-actions">
        <span className="fine">
          {state.original !== null
            ? "Original saved exactly as submitted"
            : "Autosaved in this browser · no time limit"}
        </span>
        <Button
          disabled={state.original === null && !state.draft.trim()}
          onClick={() => {
            if (state.original !== null) onFeedback();
            else {
              cue();
              onSubmit();
            }
          }}
        >
          {state.original !== null ? "View feedback" : "Save & get feedback"}
        </Button>
      </div>
    </section>
  );
}
