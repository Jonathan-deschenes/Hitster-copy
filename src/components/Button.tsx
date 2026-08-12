import type { ButtonHTMLAttributes, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-2xl border border-transparent px-7 py-4 text-[0.95rem] font-semibold whitespace-nowrap transition duration-200 ease-out active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent-blue disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

const primary =
  "bg-linear-to-br from-purple-light via-purple to-accent-blue text-white shadow-[0_10px_28px_-8px_rgba(126,20,255,0.7)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-6px_rgba(126,20,255,0.85)]";

const secondary =
  "border-lavender/14 bg-lavender/[0.04] hover:-translate-y-0.5 hover:border-purple-soft hover:bg-purple/[0.14]";

export function PrimaryButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${base} ${primary} ${className}`} {...props} />;
}

export function SecondaryButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${base} ${secondary} ${className}`} {...props} />;
}

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Serves as both the accessible name and the tooltip. */
  label: string;
  icon: ReactNode;
}

/** Square, icon-only secondary button — the footer's control cluster. */
export function IconButton({
  label,
  icon,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      className={`${base} ${secondary} p-2! ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
