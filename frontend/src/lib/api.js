const BASE = import.meta.env.VITE_API_URL ?? "";

async function request(path, options = {}) {
  let res;
  try {
    // Jamais de chargement infini : on abandonne au bout de 80 s.
    res = await fetch(`${BASE}${path}`, { ...options, signal: AbortSignal.timeout(80000) });
  } catch (e) {
    if (e.name === "TimeoutError") throw new Error("La recherche prend trop de temps. Réessaie.");
    throw new Error("Serveur injoignable. Vérifie que le backend tourne.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Requête impossible. Réessaie.");
  }
  return res.json();
}

const post = (path, body) =>
  request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const analyze = (image) => post("/api/analyze", { image });
export const searchText = (query) => post("/api/search", { query });
export const getPoints = (type, lat, lon) =>
  request(`/api/collecte?type=${encodeURIComponent(type)}&lat=${lat}&lon=${lon}`);