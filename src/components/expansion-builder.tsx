"use client";
import { Check } from "lucide-react";
import type { Challenge } from "@/lib/challenges";
import { buildExpansion, expansionState } from "@/lib/languages/ru-expansion";
import { Continue } from "./ui";
import { Help } from "./help";
export function ExpansionBuilder({
  challenge,
  values,
  onChange,
  onContinue,
}: {
  challenge: Challenge;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  onContinue: () => void;
}) {
  const { reviews, reviewed, canContinue } = expansionState(challenge, values);
  const preview = buildExpansion(challenge, values);
  return (
    <section className="activity-card">
      <div className="section-title">
        <span>Add three details</span>
        <Help label="Expansion help">
          Write a complete phrase or choose one from the list. A check means the
          phrase is reviewed for this exercise. Other phrases stay as drafts and
          may be correct; they need review before joining the preview. Clear an
          unused field to continue with three details.
        </Help>
      </div>
      <div className="base-sentence" lang="ru">
        {challenge.base}.
      </div>
      <div className="expansion-grid">
        {challenge.expansions.map((field, i) => {
          const review = reviews[field.id];
          const inputId = `${challenge.id}-detail-${field.id}`;
          return (
            <div
              key={field.id}
              className={`expansion-card expansion-${i} ${review.status === "repair" ? "needs-repair" : ""}`}
            >
              <label className="expansion-label" htmlFor={inputId}>
                <span lang="ru">{field.label}</span>
                <small>{field.english}</small>
                {review.status === "reviewed" && (
                  <Check size={16} aria-label="Reviewed phrase" />
                )}
              </label>
              <input
                id={inputId}
                lang="ru"
                value={values[field.id] ?? ""}
                onChange={(e) =>
                  onChange({ ...values, [field.id]: e.target.value })
                }
                maxLength={500}
                placeholder="Твоя деталь…"
                aria-invalid={review.status === "repair"}
                aria-describedby={`${inputId}-review`}
              />
              <p
                id={`${inputId}-review`}
                className={`detail-review ${review.status}`}
                aria-live="polite"
              >
                {review.status === "repair" || review.status === "unreviewed"
                  ? review.message
                  : ""}
              </p>
              <label className="sr-only" htmlFor={`${inputId}-choices`}>
                Reviewed phrases · {field.english}
              </label>
              <select
                id={`${inputId}-choices`}
                lang="ru"
                value={
                  field.options.includes(values[field.id] ?? "")
                    ? values[field.id]
                    : ""
                }
                onChange={(e) => {
                  if (e.target.value)
                    onChange({ ...values, [field.id]: e.target.value });
                }}
              >
                <option value="">Выбери фразу…</option>
                {field.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      <div className="sentence-preview">
        <span className="section-kicker">YOUR GROWING IDEA</span>
        {preview ? (
          <p lang="ru">{preview}</p>
        ) : (
          <p className="draft-preview-message">
            Your entries are saved as drafts. Repair or choose a reviewed phrase
            for the highlighted details before combining them into a sentence.
          </p>
        )}
      </div>
      <div className="activity-footer">
        <span className="fine">{reviewed}/4 reviewed</span>
        <Continue disabled={!canContinue} onClick={onContinue} />
      </div>
    </section>
  );
}
