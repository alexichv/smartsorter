import { useEffect, useRef, useState } from "react";
import { getPoints } from "../lib/api";
import { COLLECT_TYPES, formatDistance } from "../lib/collecte";

export default function CollectionPoints({ initialType = "piles", auto = false }) {
  const [type, setType] = useState(initialType);
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | locating | loading | done | error
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const reqId = useRef(0);
  const started = useRef(false);

  async function load(kind, c) {
    const id = ++reqId.current;
    setStatus("loading");
    setError("");
    try {
      const res = await getPoints(kind, c.lat, c.lon);
      if (id !== reqId.current) return; // une recherche plus récente a pris la place
      setData(res);
      setStatus("done");
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e.message);
      setStatus("error");
    }
  }

  function locate(kind = type) {
    if (!navigator.geolocation) {
      setError("La localisation n'est pas disponible sur cet appareil.");
      setStatus("error");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(c);
        load(kind, c);
      },
      () => {
        setError("Position refusée. Autorise la localisation dans ton navigateur, puis réessaie.");
        setStatus("error");
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  useEffect(() => {
    if (auto && !started.current) {
      started.current = true;
      locate(initialType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(id) {
    setType(id);
    if (coords) load(id, coords);
  }

  const current = COLLECT_TYPES.find((t) => t.id === type);

  return (
    <div className="max-w-xl">
      <h2 className="font-display text-3xl font-extrabold leading-tight">Où déposer ce qui ne va pas au bac ?</h2>
      <p className="mt-2 text-ink/70">Choisis un type de déchet pour voir les points les plus proches.</p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Type de déchet">
        {COLLECT_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => pick(t.id)}
            aria-pressed={type === t.id}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              type === t.id ? "border-pine bg-pine text-white" : "border-mist hover:border-pine hover:text-pine"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!coords && status !== "locating" && (
        <button
          onClick={() => locate()}
          className="mt-6 rounded-full bg-pine px-6 py-3 font-semibold text-white transition hover:bg-pine-dark"
        >
          Chercher autour de moi
        </button>
      )}

      <div aria-live="polite" className="mt-6">
        {status === "locating" && <p className="font-medium">Localisation en cours…</p>}
        {status === "loading" && <p className="font-medium">Recherche des points proches…</p>}
        {status === "error" && (
          <div role="alert">
            <p className="font-semibold">{error}</p>
            {coords && (
              <button onClick={() => load(type, coords)} className="mt-2 underline underline-offset-4 hover:text-pine">
                Réessayer
              </button>
            )}
          </div>
        )}

        {status === "done" && data && (
          <>
            {current?.note && <p className="mb-3">{current.note}</p>}
            {data.rayon_m > 3000 && data.points.length > 0 && (
              <p className="mb-3 text-sm text-ink/70">Rien à moins de 3 km : résultats jusqu'à 10 km.</p>
            )}
            {data.points.length === 0 ? (
              <p>
                Aucun point trouvé dans un rayon de 10 km. Les données OpenStreetMap sont parfois incomplètes :
                essaie un autre type, ou renseigne-toi auprès de ta mairie.
              </p>
            ) : (
              <ul className="divide-y divide-mist border-y border-mist">
                {data.points.map((p, i) => (
                  <li key={i} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{p.nom}</h3>
                      {p.adresse && <p className="text-sm text-ink/70">{p.adresse}</p>}
                      {p.horaires && <p className="text-sm text-ink/70">Horaires : {p.horaires}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium tabular-nums">{formatDistance(p.distance_m)}</p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline underline-offset-4 hover:text-pine"
                      >
                        Itinéraire
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-ink/60">
        Données © contributeurs OpenStreetMap. Ta position sert uniquement à cette recherche et n'est pas enregistrée.
      </p>
    </div>
  );
}
