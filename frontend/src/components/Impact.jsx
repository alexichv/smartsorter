import { formatCo2, totals } from "../lib/stats";

export default function Impact({ history, onClear }) {
  const t = totals(history);

  if (!history.length) {
    return (
      <p className="max-w-md text-lg">
        Aucun scan pour l'instant. Scanne un premier déchet pour suivre ton impact.
      </p>
    );
  }

  return (
    <div className="max-w-xl">
      <h2 className="font-display text-3xl font-extrabold leading-tight">
        {t.weekScans} {t.weekScans > 1 ? "objets triés" : "objet trié"} cette semaine, environ{" "}
        {formatCo2(t.weekCo2_g)} de CO₂ évités.
      </h2>
      <p className="mt-2 text-ink/70">
        Depuis le début : {t.scans} scans, {formatCo2(t.co2_g)} de CO₂ évités (estimation indicative).
      </p>

      <ul className="mt-8 divide-y divide-mist border-y border-mist">
        {history.slice(0, 20).map((h) => (
          <li key={h.id} className="flex items-baseline justify-between gap-4 py-3">
            <span>
              {h.noms.join(", ")}
              <span className="ml-2 text-sm text-ink/60">{h.bacs.join(", ")}</span>
            </span>
            <time className="shrink-0 text-sm text-ink/60" dateTime={new Date(h.date).toISOString()}>
              {new Date(h.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </time>
          </li>
        ))}
      </ul>

      <button onClick={onClear} className="mt-6 text-sm underline underline-offset-4 hover:text-pine">
        Effacer l'historique
      </button>
    </div>
  );
}
