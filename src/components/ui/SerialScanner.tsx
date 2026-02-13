import React, { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  open: boolean;
  onClose: () => void;
  onScanned: (value: string) => void;
  title?: string;
};

export default function SerialScanner({ open, onClose, onScanned, title }: Props) {
  const regionId = useMemo(() => `qr-region-${Math.random().toString(16).slice(2)}`, []);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function start() {
      setStarting(true);
      setError("");

      try {
        const qr = new Html5Qrcode(regionId);
        qrRef.current = qr;

        // tenta câmera traseira (celular)
        await qr.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 280, height: 180 }, // bom pra barcode/qr
            aspectRatio: 1.777,
          },
          (decodedText) => {
            const cleaned = decodedText.trim();
            if (!cleaned) return;

            // para a câmera e retorna o valor
            qr
              .stop()
              .then(() => qr.clear())
              .catch(() => { })
              .finally(() => {
                if (cancelled) return;
                onScanned(cleaned);
                onClose();
              });
          },
          () => {
            // ignore "no code found"
          }
        );
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Não foi possível acessar a câmera.");
      } finally {
        setStarting(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      const qr = qrRef.current;
      qrRef.current = null;

      if (qr) {
        qr
          .stop()
          .then(() => qr.clear())
          .catch(() => { });
      }
    };
  }, [open, regionId, onClose, onScanned]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title ?? "Ler serial"}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Aponte a câmera para o código de barras/QR do serial.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="mt-4">
          <div
            id={regionId}
            className="w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
            style={{ minHeight: 260 }}
          />
        </div>

        {starting && <p className="text-sm text-gray-500 mt-3">Iniciando câmera…</p>}
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
