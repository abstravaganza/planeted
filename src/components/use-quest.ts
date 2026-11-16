"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyQuest,
  oldKeys,
  QUEST_KEY,
  recoverQuest,
  type QuestState,
} from "@/lib/quest-state";
export function useQuest() {
  const [state, setState] = useState<QuestState>(() => emptyQuest());
  const current = useRef(state);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const stored =
          localStorage.getItem(QUEST_KEY) ??
          localStorage.getItem("writing-quest:missions:v4");
        const next = stored
          ? recoverQuest(JSON.parse(stored))
          : emptyQuest(
              Object.fromEntries(
                oldKeys.map((k) => [k, localStorage.getItem(k)]),
              ),
            );
        current.current = next;
        setState(next);
        setReady(true);
        localStorage.setItem(QUEST_KEY, JSON.stringify(next));
      } catch {
        setError(
          "Saved work could not be loaded safely. Existing saves were not replaced. Export a backup before continuing.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const commit = useCallback((change: (s: QuestState) => QuestState) => {
    const next = change(current.current);
    current.current = next;
    setState(next);
    try {
      localStorage.setItem(QUEST_KEY, JSON.stringify(next));
    } catch {
      setError(
        "Storage unavailable. Work remains in this tab. Export a backup before leaving.",
      );
    }
    return next;
  }, []);
  return { state, commit, ready, error };
}
