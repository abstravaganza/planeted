import type { ReactNode } from "react";
export function Help({
  children,
  label = "Activity help",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <details className="help-disclosure">
      <summary aria-label={label} title={label}>
        ?
      </summary>
      <div className="help-content">{children}</div>
    </details>
  );
}
