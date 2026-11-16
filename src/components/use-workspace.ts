"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyWorkspace,
  migrateWorkspace,
  recoverWorkspace,
  WORKSPACE_KEY,
  LEGACY_PACKS_KEY,
  STORAGE_KEY,
  type Workspace,
} from "@/lib/workspace";
export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const current = useRef(workspace);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const stored = localStorage.getItem(WORKSPACE_KEY);
        const legacySports = localStorage.getItem(STORAGE_KEY),
          legacyPacks = localStorage.getItem(LEGACY_PACKS_KEY);
        const restored = stored
          ? recoverWorkspace(JSON.parse(stored))
          : migrateWorkspace(
              legacySports ? JSON.parse(legacySports) : null,
              legacyPacks ? JSON.parse(legacyPacks) : null,
            );
        current.current = restored;
        setWorkspace(restored);
        setReady(true);
        try {
          localStorage.setItem(WORKSPACE_KEY, JSON.stringify(restored));
        } catch {
          setError(
            "Browser storage is full or unavailable. Download your writing before leaving; original legacy saves remain intact.",
          );
        }
      } catch {
        setError(
          "Saved data could not be loaded safely. No saved writing has been replaced. Download a backup before continuing.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const commit = useCallback((change: (state: Workspace) => Workspace) => {
    const next = change(current.current);
    current.current = next;
    setWorkspace(next);
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(next));
    } catch {
      setError(
        "Browser storage is unavailable. Your writing is kept in this session; download a copy before leaving.",
      );
    }
    return next;
  }, []);
  return { workspace, commit, ready, error };
}
