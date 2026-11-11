export const COLLECT_TYPES = [
  { id: "piles", label: "Piles et ampoules" },
  { id: "electro", label: "Appareils électriques" },
  { id: "textile", label: "Textile" },
  { id: "medicaments", label: "Médicaments", note: "En France, les pharmacies reprennent les médicaments non utilisés." },
  { id: "verre", label: "Verre" },
  { id: "decheterie", label: "Déchèterie" },
];

// Devine le type de point de collecte à partir d'un objet détecté.
export function guessCollectType(o) {
  const t = `${o.nom} ${o.matiere}`.toLowerCase();
  if (/m[ée]dicament/.test(t)) return "medicaments";
  if (/\b(piles?|batteries?|ampoules?|n[ée]ons?)\b/.test(t)) return "piles";
  if (o.matiere === "textile") return "textile";
  if (o.matiere === "electronique") return "electro";
  if (o.bac === "decheterie") return "decheterie";
  return "piles";
}

export function formatDistance(m) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}
