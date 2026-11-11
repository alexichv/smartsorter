import BinIcon from "./BinIcon";
import { guessCollectType } from "../lib/collecte";
import { formatCo2 } from "../lib/stats";

export default function ResultCard({ result, onFindPoint }) {
  if (!result.objets.length) {
    return (
      <p role="status">
        {result.message || "Aucun déchet identifié. Rapproche l'objet, avec un fond uni, et réessaie."}
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-mist border-y border-mist">
        {result.objets.map((o, i) => (
          <li key={i} className="flex gap-4 py-5">
            <BinIcon color={o.bac_couleur} />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-xl font-extrabold leading-tight">{o.nom}</h3>
              <p className="mt-1 font-semibold">{o.bac_label}</p>

              <div className="mt-3 flex items-center gap-3">
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist"
                  role="meter"
                  aria-valuenow={o.recyclabilite}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Recyclabilité"
                >
                  <div className="h-full rounded-full bg-pine" style={{ width: `${o.recyclabilite}%` }} />
                </div>
                <span className="text-sm font-medium tabular-nums">Recyclable à {o.recyclabilite} %</span>
              </div>

              {o.conseil && <p className="mt-3">{o.conseil}</p>}
              {o.alternative && <p className="mt-2 text-sm text-ink/70">À privilégier : {o.alternative}</p>}

              {onFindPoint && (o.bac === "point_collecte" || o.bac === "decheterie") && (
                <button
                  onClick={() => onFindPoint(guessCollectType(o))}
                  className="mt-3 font-semibold text-pine underline decoration-2 underline-offset-4 hover:text-pine-dark"
                >
                  Trouver un point de collecte
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {result.co2_total_g > 0 && (
        <p className="mt-4 text-sm text-ink/70">
          Environ {formatCo2(result.co2_total_g)} de CO₂ évités si tu suis ces gestes.
        </p>
      )}
    </div>
  );
}
