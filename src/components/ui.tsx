import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Continue({
  onClick,
  disabled = false,
  label = "Keep going",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Button onClick={onClick} disabled={disabled}>
      {label}
      <ArrowRight size={17} />
    </Button>
  );
}
export function Notice({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div className={`notice ${success ? "success" : ""}`} role="status">
      {success ? <Check size={18} /> : <Sparkles size={18} />}
      <span>{children}</span>
    </div>
  );
}
export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}
