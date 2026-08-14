"use client";

import { motion } from "framer-motion";
import type {
  HTMLAttributes,
  InputHTMLAttributes,
  MouseEventHandler,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "warn" | "danger" | "bot" | "human" | "success";
  className?: string;
}) {
  const tones = {
    default:
      "bg-[var(--color-paper-2)] text-[var(--color-ink-soft)] border-[var(--color-line)]",
    accent:
      "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[color-mix(in_oklab,var(--color-accent)_25%,white)]",
    warn: "bg-[#fff6e5] text-[var(--color-warn)] border-[#f0d9a0]",
    danger: "bg-[#fdebec] text-[var(--color-danger)] border-[#f3c4c8]",
    bot: "bg-[var(--color-bot-soft)] text-[var(--color-bot)] border-[#c9d8f8]",
    human: "bg-[var(--color-human-soft)] text-[var(--color-human)] border-[#ddd0f5]",
    success:
      "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[color-mix(in_oklab,var(--color-accent)_25%,white)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  disabled,
  type = "button",
  title,
  onClick,
}: {
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  children?: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  const variants = {
    primary:
      "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-[0_10px_28px_-12px_rgba(15,118,110,0.55)]",
    secondary:
      "bg-white text-[var(--color-ink)] border border-[var(--color-line-strong)] hover:bg-[var(--color-paper-2)] shadow-sm",
    ghost:
      "bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]",
    danger:
      "bg-[var(--color-sunset-soft)] text-[var(--color-sunset)] border border-[#f5c4bc] hover:bg-[#fadfd9]",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs rounded-lg",
    md: "h-10 px-4 text-sm rounded-xl",
    lg: "h-12 px-6 text-sm rounded-2xl",
    icon: "h-10 w-10 rounded-xl",
  };
  return (
    <motion.button
      type={type}
      disabled={disabled}
      title={title}
      onClick={onClick}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-[var(--color-line)] bg-white px-3.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-faint)] outline-none transition focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-glow)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-faint)] outline-none transition focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-glow)]",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-line)] bg-white shadow-[0_1px_0_rgba(20,24,22,0.03)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function StatusDot({
  status,
}: {
  status:
    | "online"
    | "away"
    | "offline"
    | "connected"
    | "disconnected"
    | "qr"
    | "pending";
}) {
  const color =
    status === "online" || status === "connected"
      ? "bg-[var(--color-accent)]"
      : status === "away" || status === "qr" || status === "pending"
        ? "bg-[var(--color-warn)]"
        : "bg-[var(--color-danger)]";
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        color,
        (status === "online" || status === "connected") && "animate-breath",
      )}
    />
  );
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  variant = "danger",
  loading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-2xl space-y-4"
      >
        <div className="space-y-1.5">
          <h3 className="font-extrabold text-base text-slate-900">{title}</h3>
          {description ? (
            <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Memproses..." : confirmText}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

