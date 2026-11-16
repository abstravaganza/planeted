"use client";
import { useEffect, useState } from "react";
import { ZinaArt } from "./mission-art";
import { playCue } from "@/lib/sound";
export const zinaStates = [
  "idle",
  "eyebrow",
  "glasses",
  "sigh",
  "sleep",
  "wake",
  "yarn",
  "pen",
  "applause",
  "celebrate",
] as const;
const lines: Record<(typeof zinaStates)[number], string> = {
  idle: "Я пока носок довяжу. Ты не торопись.",
  eyebrow: "Ну что, Пушкин? Покажи, на что способен!",
  glasses: "Так… Где мои очки? А, на мне.",
  sigh: "Запятые сами себя не поставят!",
  sleep: "Я не сплю. Я проверяю внутренним зрением.",
  wake: "Что?! Уже целый абзац?",
  yarn: "Клубок сбежал. А мысль держим.",
  pen: "Красная ручка готова. Я тоже.",
  applause: "Ну… сойдёт. Даже неплохо.",
  celebrate: "Работа сдана! Сегодня вяжу победный носок.",
};
export function ZinaActor({
  mode,
  sound,
  completed = false,
}: {
  mode: "chaos" | "quiet" | "exam";
  sound: boolean;
  completed?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const reaction = completed
    ? "celebrate"
    : mode === "chaos"
      ? zinaStates[index]
      : "idle";
  useEffect(() => {
    if (mode !== "chaos" || completed) return;
    const interval = setInterval(() => setIndex((i) => (i + 1) % 9), 8000);
    return () => clearInterval(interval);
  }, [mode, completed]);
  useEffect(() => {
    if (mode === "chaos" && sound && reaction !== "idle")
      playCue(true, reaction === "celebrate" ? "success" : "pop");
  }, [reaction, mode, sound]);
  return (
    <div
      className={`q-zina-actor mode-${mode} state-${reaction}`}
      data-zina-state={reaction}
    >
      <div className="q-zina-wrap">
        <ZinaArt />
        <div className="q-yarn-roll" aria-hidden="true">
          ✺
        </div>
        {mode !== "exam" && (
          <div className="q-speech" lang="ru">
            {lines[reaction]}
          </div>
        )}
        <span className="q-zina-sleep" aria-hidden="true">
          Z z z
        </span>
        <span className="q-zina-stars" aria-hidden="true">
          ✦ ✧ ✦
        </span>
      </div>
      {mode === "chaos" && !completed && (
        <button
          className="q-actor-control"
          onClick={() => setIndex((i) => (i + 1) % 9)}
        >
          Next reaction
        </button>
      )}
    </div>
  );
}
