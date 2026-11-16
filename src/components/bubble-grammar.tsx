"use client";
import { TapGrammar } from "./tap-grammar";
import type { MissionState } from "@/lib/quest-state";
import type { MissionId } from "@/lib/missions";
export function BubbleGrammar({
  state,
  sound,
  update,
  onComplete,
}: {
  state: MissionState;
  missionId: MissionId;
  mode: "demo" | "ai";
  sound: boolean;
  update: (fn: (m: MissionState) => MissionState) => void;
  onComplete: () => void;
}) {
  return (
    <TapGrammar
      state={state}
      sound={sound}
      update={update}
      onComplete={onComplete}
    />
  );
}
