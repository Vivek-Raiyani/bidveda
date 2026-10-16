"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastVariant = "default" | "success" | "destructive";

export interface ToastItem {
  id: string;
  title?: string;
  description: string;
  variant?: ToastVariant;
}

interface ToastContextType {
  toast: (options: {
    title?: string;
    description: string;
    variant?: ToastVariant;
    duration?: number;
  }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      title,
      description,
      variant = "default",
      duration = 4000,
    }: {
      title?: string;
      description: string;
      variant?: ToastVariant;
      duration?: number;
    }) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, title, description, variant }]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* Toast container floating at bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const isDestructive = t.variant === "destructive";
          const isSuccess = t.variant === "success";

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl backdrop-blur-md border transition-all animate-in fade-in slide-in-from-bottom-2 ${
                isDestructive
                  ? "bg-rose-950/90 border-rose-800 text-rose-100"
                  : isSuccess
                  ? "bg-emerald-950/90 border-emerald-800 text-emerald-100"
                  : "bg-zinc-900/90 border-zinc-800 text-zinc-100"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isDestructive ? (
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Info className="w-5 h-5 text-indigo-400" />
                )}
              </div>
              <div className="flex-1 text-sm">
                {t.title && (
                  <div className="font-semibold text-white mb-0.5">
                    {t.title}
                  </div>
                )}
                <div className="text-xs opacity-90 leading-relaxed">
                  {t.description}
                </div>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-zinc-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
