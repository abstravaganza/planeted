"use client";
import { reviewLabels, type AnswerReview } from "@/lib/answer-review";
import { changedParts } from "@/lib/corrections";
import { Button } from "./ui";
export function AnswerFeedback({
  review,
  retry,
}: {
  review: AnswerReview;
  retry?: () => void;
}) {
  const label = reviewLabels[review.status];
  const diff = changedParts(review.original, review.suggestion);
  return (
    <div
      className={`q-answer-feedback q-answer-${review.status}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <strong>
        <span aria-hidden="true">{label.icon} </span>
        {label.title}
        {!review.taskMet && review.status === "correct"
          ? " · add the requested detail"
          : ""}
      </strong>
      <small>
        {review.source === "ai"
          ? "AI review"
          : review.source === "curated"
            ? "Reviewed example match · offline"
            : "Not evaluated"}
      </small>
      <p>{review.explanation}</p>
      {!review.suggestion && (
        <p className="q-exact" lang="ru">
          {review.original}
        </p>
      )}
      {review.suggestion && (
        <div className="q-answer-compare">
          <div>
            <small>YOUR WORDING</small>
            <p lang="ru">
              {diff.before[0]}
              <mark>{diff.before[1]}</mark>
              {diff.before[2]}
            </p>
          </div>
          <div>
            <small>
              {review.status === "naturalness"
                ? "OPTIONAL VERSION"
                : "TRY THIS CHANGE"}
            </small>
            <p lang="ru">
              {diff.after[0]}
              <mark>{diff.after[1]}</mark>
              {diff.after[2]}
            </p>
          </div>
        </div>
      )}
      {review.changes.map((c, i) => (
        <p key={i}>
          <span lang="ru">
            <del>{c.before}</del> → <mark>{c.after}</mark>
          </span>{" "}
          · {c.explanation}
        </p>
      ))}
      {review.question && (
        <p>
          <strong>{review.question}</strong>
        </p>
      )}
      {review.status === "correction" && (
        <p className="fine">Edit your answer above, then check again.</p>
      )}
      {review.status === "unavailable" && retry && (
        <Button variant="secondary" onClick={retry}>
          Retry review
        </Button>
      )}
    </div>
  );
}
