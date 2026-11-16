"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lightbulb,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import type { Challenge } from "@/lib/challenges";
import { Button, Continue, Notice } from "./ui";
import { Help } from "./help";
const roles = {
  subject: "Who",
  verb: "Action",
  activity: "Activity",
  place: "Where",
  company: "With whom",
  time: "When",
  preposition: "Preposition",
};
export function SentenceBuilder({
  challenge,
  tiles,
  onChange,
  onCheck,
  onContinue,
  checked,
  status,
  busy = false,
}: {
  challenge: Challenge;
  tiles: string[];
  onChange: (ids: string[]) => void;
  onCheck: () => void;
  onContinue: () => void;
  checked: boolean;
  status: string;
  busy?: boolean;
}) {
  const [hint, setHint] = useState(false);
  function move(from: number, to: number) {
    const next = [...tiles];
    const [tile] = next.splice(from, 1);
    next.splice(to, 0, tile);
    onChange(next);
  }
  function drop(id: string, index?: number) {
    if (!challenge.tiles.some((t) => t.id === id)) return;
    const from = tiles.indexOf(id);
    if (from >= 0) {
      if (index !== undefined) move(from, index);
    } else {
      const next = [...tiles];
      next.splice(index ?? next.length, 0, id);
      onChange(next);
    }
  }
  return (
    <section className="activity-card sentence-builder-card">
      <div className="section-title">
        <p className="builder-target">{challenge.meaning}</p>
        <Help label="Sentence Builder help">
          <p>
            Tap or drag tiles into a sentence. Tab to a tile and press Enter to
            add or remove it; arrow buttons reorder tiles. Prepositions are
            separate tiles and stay with the words they govern. Natural Russian
            word order is flexible; Demo Mode recognizes curated alternatives.
          </p>
          <div className="tile-legend">
            {Object.entries(roles).map(([role, label]) => (
              <span key={role}>
                <i className={role} />
                {label}
              </span>
            ))}
          </div>
        </Help>
      </div>
      <div
        className="sentence-zone"
        aria-label="Your assembled sentence"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          drop(e.dataTransfer.getData("text/plain"));
        }}
      >
        {!tiles.length && (
          <span className="drop-placeholder">Your sentence starts here ↓</span>
        )}
        {tiles.map((id, i) => {
          const tile = challenge.tiles.find((t) => t.id === id);
          return (
            tile && (
              <div key={id} className="placed-tile">
                <button
                  className={`word-tile ${tile.role}`}
                  lang="ru"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(e.dataTransfer.getData("text/plain"), i);
                  }}
                  onClick={() => onChange(tiles.filter((t) => t !== id))}
                  aria-label={`Remove ${tile.text}`}
                  disabled={busy}
                >
                  {tile.text}
                  <X size={11} />
                </button>
                <div className="tile-move">
                  <button
                    className="icon-button"
                    aria-label={`Move ${tile.text} left`}
                    disabled={i === 0 || busy}
                    onClick={() => move(i, i - 1)}
                  >
                    <ArrowLeft size={13} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Move ${tile.text} right`}
                    disabled={i === tiles.length - 1 || busy}
                    onClick={() => move(i, i + 1)}
                  >
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )
          );
        })}
      </div>
      <div className="tile-bank" aria-label="Available word tiles">
        {challenge.tileOrder.map((id) => {
          const tile = challenge.tiles.find((t) => t.id === id)!;
          return (
            <button
              key={id}
              className={`word-tile ${tile.role}`}
              lang="ru"
              disabled={tiles.includes(id) || busy}
              draggable={!tiles.includes(id)}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", id)}
              onClick={() => onChange([...tiles, id])}
              aria-label={`${tile.text}${tile.role === "preposition" ? ` · preposition for ${challenge.tiles.find((t) => t.id === challenge.links.find((pair) => pair[0] === id)?.[1])?.text}` : ""}`}
            >
              {tile.text}
              <Plus size={12} />
            </button>
          );
        })}
      </div>
      <div className="action-row">
        <Button variant="ghost" disabled={busy} onClick={() => onChange([])}>
          <RotateCcw size={15} />
          Reset
        </Button>
        <Button variant="ghost" onClick={() => setHint(!hint)}>
          <Lightbulb size={16} />
          {hint ? "Hide hint" : "A little hint"}
        </Button>
      </div>
      {hint && (
        <Notice>
          One reviewed order:{" "}
          <span lang="ru">
            {challenge.acceptableOrders[0]
              .map((id) => challenge.tiles.find((t) => t.id === id)?.text)
              .join(" ")}
            .
          </span>{" "}
          Try building it yourself, then explore starting with when or with
          whom.
        </Notice>
      )}
      {status && <Notice success={checked}>{status}</Notice>}
      <div className="activity-footer">
        {checked ? (
          <Continue disabled={busy} onClick={onContinue} />
        ) : (
          <Button disabled={busy} onClick={onCheck}>
            <Check size={16} />
            {busy ? "Checking…" : "Check sentence"}
          </Button>
        )}
      </div>
    </section>
  );
}
