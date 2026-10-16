import React from "react";
import { RFQStatus } from "@/types/rfq";
import { QuoteStatus } from "@/types/quote";

interface BadgeProps {
  children?: React.ReactNode;
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "success"
    | "warning"
    | "danger"
    | "info";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  const variantStyles = {
    default: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    secondary: "bg-zinc-800 text-zinc-300 border-zinc-700",
    outline: "bg-transparent text-zinc-400 border-zinc-700",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function RFQStatusBadge({ status }: { status: RFQStatus | string }) {
  const config: Record<
    string,
    { label: string; variant: BadgeProps["variant"]; dotColor: string }
  > = {
    draft: {
      label: "Draft",
      variant: "secondary",
      dotColor: "bg-zinc-400",
    },
    published: {
      label: "Published",
      variant: "info",
      dotColor: "bg-sky-400 animate-pulse",
    },
    closed: {
      label: "Closed",
      variant: "warning",
      dotColor: "bg-amber-400",
    },
    awarded: {
      label: "Awarded",
      variant: "success",
      dotColor: "bg-emerald-400",
    },
    cancelled: {
      label: "Cancelled",
      variant: "danger",
      dotColor: "bg-rose-400",
    },
  };

  const item = config[status.toLowerCase()] || {
    label: status,
    variant: "secondary",
    dotColor: "bg-zinc-400",
  };

  return (
    <Badge variant={item.variant}>
      <span className={`h-1.5 w-1.5 rounded-full ${item.dotColor}`} />
      {item.label}
    </Badge>
  );
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus | string }) {
  const config: Record<
    string,
    { label: string; variant: BadgeProps["variant"]; dotColor: string }
  > = {
    submitted: {
      label: "Submitted",
      variant: "info",
      dotColor: "bg-sky-400",
    },
    revised: {
      label: "Revised",
      variant: "default",
      dotColor: "bg-indigo-400",
    },
    shortlisted: {
      label: "Shortlisted",
      variant: "warning",
      dotColor: "bg-amber-400 animate-pulse",
    },
    accepted: {
      label: "Accepted",
      variant: "success",
      dotColor: "bg-emerald-400",
    },
    rejected: {
      label: "Rejected",
      variant: "danger",
      dotColor: "bg-rose-400",
    },
    withdrawn: {
      label: "Withdrawn",
      variant: "secondary",
      dotColor: "bg-zinc-500",
    },
  };

  const item = config[status.toLowerCase()] || {
    label: status,
    variant: "secondary",
    dotColor: "bg-zinc-400",
  };

  return (
    <Badge variant={item.variant}>
      <span className={`h-1.5 w-1.5 rounded-full ${item.dotColor}`} />
      {item.label}
    </Badge>
  );
}
