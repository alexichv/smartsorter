import { useEffect, useRef, useState } from "react";
import { fileToDataUrl, videoToDataUrl } from "../lib/image";

export default function Scanner({ onCapture }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState("");

  useEffect(() => {
    let stream;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      } catch {
        setCamError(
          "Caméra indisponible. Autorise l'accès dans ton navigateur (HTTPS requis sur mobile), ou importe une photo."
        );
      }
    }
    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const snap = () => onCapture(videoToDataUrl(videoRef.current));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (file) onCapture(await fileToDataUrl(file));
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-ink">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!ready && (
          <p className="absolute inset-0 grid place-items-center p-8 text-center text-white/80" role="status">
            {camError || "Démarrage de la caméra…"}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={snap}
          disabled={!ready}
          className="rounded-full bg-pine px-6 py-3 font-semibold text-white transition hover:bg-pine-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Scanner un déchet
        </button>
        <button
          onClick={() => fileRef.current.click()}
          className="rounded-full px-4 py-3 font-medium underline decoration-2 underline-offset-4 hover:text-pine"
        >
          Importer une photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
    </div>
  );
}
