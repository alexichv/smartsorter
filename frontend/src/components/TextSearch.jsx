import { useState } from "react";

const EXEMPLES = ["Pot de yaourt", "Carton de pizza", "Pile", "Mouchoir", "Bouchon de liège", "Capsule de café"];

export default function TextSearch({ onSearch }) {
  const [q, setQ] = useState("");
  const valid = q.trim().length >= 2;

  const submit = (e) => {
    e.preventDefault();
    if (valid) onSearch(q.trim());
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="q" className="block font-medium">
        Ou décris l'objet
      </label>
      <div className="flex gap-2">
        <input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          placeholder="ex : pot de yaourt"
          className="min-w-0 flex-1 rounded-full border border-mist bg-white px-5 py-3"
        />
        <button
          type="submit"
          disabled={!valid}
          className="rounded-full bg-pine px-5 py-3 font-semibold text-white transition hover:bg-pine-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Chercher
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXEMPLES.map((ex) => (
          <button
            type="button"
            key={ex}
            onClick={() => onSearch(ex)}
            className="rounded-full border border-mist px-3 py-1 text-sm hover:border-pine hover:text-pine"
          >
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}