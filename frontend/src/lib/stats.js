const KEY = "smartsorter:history";
const DAY = 864e5;

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

export function saveScan(result) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: Date.now(),
    noms: result.objets.map((o) => o.nom),
    bacs: result.objets.map((o) => o.bac_label),
    co2_g: result.co2_total_g,
  };
  const next = [entry, ...loadHistory()].slice(0, 200);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage plein ou bloqué : on garde l'historique en mémoire */
  }
  return next;
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return [];
}

const sum = (list) => list.reduce((acc, h) => acc + h.co2_g, 0);

export function totals(history) {
  const week = history.filter((h) => h.date >= Date.now() - 7 * DAY);
  return {
    scans: history.length,
    co2_g: sum(history),
    weekScans: week.length,
    weekCo2_g: sum(week),
  };
}

export function formatCo2(g) {
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;
  }
  return `${Math.round(g)} g`;
}
