import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastType = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type FeedbackContextValue = {
  toast: {
    show: (message: string, type?: ToastType) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback deve ser usado dentro de <FeedbackProvider />");
  return ctx;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
  }>({
    open: false,
    title: "Confirmar",
    message: "",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
  });

  const confirmResolverRef = useRef<((v: boolean) => void) | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item: ToastItem = { id, type, message };
      setToasts((prev) => [...prev, item]);

      // auto-fecha em 4s
      window.setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  const confirm = useCallback((opts: ConfirmOptions) => {
    setConfirmState({
      open: true,
      title: opts.title ?? "Confirmar",
      message: opts.message,
      confirmText: opts.confirmText ?? "Confirmar",
      cancelText: opts.cancelText ?? "Cancelar",
    });

    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((s) => ({ ...s, open: false }));
    confirmResolverRef.current?.(result);
    confirmResolverRef.current = null;
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      toast: {
        show: showToast,
        success: (m) => showToast(m, "success"),
        error: (m) => showToast(m, "error"),
        info: (m) => showToast(m, "info"),
        warning: (m) => showToast(m, "warning"),
      },
      confirm,
    }),
    [showToast, confirm]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* TOASTS */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "rounded-xl px-4 py-3 shadow-lg border text-sm",
              "bg-white text-gray-900",
              t.type === "success" ? "border-green-300" : "",
              t.type === "error" ? "border-red-300" : "",
              t.type === "info" ? "border-blue-300" : "",
              t.type === "warning" ? "border-yellow-300" : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium">{t.message}</div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-gray-400 hover:text-gray-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CONFIRM MODAL */}
      {confirmState.open && (
        <div className="fixed inset-0 z-[9998] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900">{confirmState.title}</h3>
            <p className="text-sm text-gray-600 mt-2">{confirmState.message}</p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => closeConfirm(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {confirmState.cancelText}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black"
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
