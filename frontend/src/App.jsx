import { useState } from "react";
import BinIcon from "./components/BinIcon";
import CollectionPoints from "./components/CollectionPoints";
import Impact from "./components/Impact";
import ResultCard from "./components/ResultCard";
import Scanner from "./components/Scanner";
import TextSearch from "./components/TextSearch";
import { analyze, searchText } from "./lib/api";
import { clearHistory, loadHistory, saveScan } from "./lib/stats";

export default function App() {
  const [view, setView] = useState("scan"); // scan | collecte | impact
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [preview, setPreview] = useState(null); // photo capturée (null si recherche texte)
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(loadHistory);
  const [collect, setCollect] = useState({ type: "piles", auto: false });

  async function run(request) {
    setStatus("loading");
    setError("");
    setResult(null);
    try {
      const data = await request();
      setResult(data);
      setStatus("done");
      if (data.objets.length) setHistory(saveScan(data));
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }

  function handleCapture(dataUrl) {
    setPreview(dataUrl);
    setQuery("");
    run(() => analyze(dataUrl));
  }

  function handleSearch(q) {
    setPreview(null);
    setQuery(q);
    run(() => searchText(q));
  }

  function handleFindPoint(type) {
    setCollect({ type, auto: true });
    setView("collecte");
  }

  function reset() {
    setPreview(null);
    setQuery("");
    setResult(null);
    setError("");
    setStatus("idle");
  }

  const tab = (id, label) => (
    <button
      onClick={() => {
        if (id === "collecte") setCollect((c) => ({ ...c, auto: false }));
        setView(id);
      }}
      aria-current={view === id ? "page" : undefined}
      className={`py-1 font-medium underline-offset-8 ${
        view === id ? "underline decoration-2 decoration-pine" : "text-ink/60 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="font-display text-2xl font-extrabold">SmartSorter</h1>
        <nav className="flex gap-4 sm:gap-5">
          {tab("scan", "Scanner")}
          {tab("collecte", "Collecte")}
          {tab("impact", "Mon impact")}
        </nav>
      </header>

      {view === "impact" && <Impact history={history} onClear={() => setHistory(clearHistory())} />}

      {view === "collecte" && <CollectionPoints initialType={collect.type} auto={collect.auto} />}

      {view === "scan" && (
        <main className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <section aria-label="Caméra et recherche">
            {status === "idle" ? (
              <div className="space-y-8">
                <Scanner onCapture={handleCapture} />
                <TextSearch onSearch={handleSearch} />
              </div>
            ) : (
              <div className="space-y-4">
                {preview ? (
                  <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-ink">
                    <img
                      src={preview}
                      alt="Objet scanné"
                      className={`h-full w-full object-cover transition-opacity ${
                        status === "loading" ? "opacity-60" : ""
                      }`}
                    />
                  </div>
                ) : (
                  <p className="rounded-3xl bg-white p-6 font-display text-2xl font-extrabold">{query}</p>
                )}
                {status !== "loading" && (
                  <button
                    onClick={reset}
                    className="rounded-full bg-pine px-6 py-3 font-semibold text-white transition hover:bg-pine-dark"
                  >
                    Trier un autre déchet
                  </button>
                )}
              </div>
            )}
          </section>

          <section aria-live="polite" aria-label="Résultat" className="lg:pt-2">
            {status === "idle" && (
              <div className="max-w-sm">
                <h2 className="font-display text-3xl font-extrabold leading-tight">
                  Montre un déchet, trouve son bac.
                </h2>
                <p className="mt-3 text-ink/70">
                  Place l'objet devant la caméra sur un fond uni, ou décris-le avec quelques mots.
                </p>
              </div>
            )}
            {status === "loading" && (
              <div className="flex items-center gap-4">
                <BinIcon loop />
                <p className="font-medium">Analyse en cours…</p>
              </div>
            )}
            {status === "error" && (
              <div role="alert">
                <p className="font-semibold">{error}</p>
                <p className="mt-1 text-ink/70">Appuie sur « Trier un autre déchet » pour réessayer.</p>
              </div>
            )}
            {status === "done" && result && <ResultCard result={result} onFindPoint={handleFindPoint} />}
          </section>
        </main>
      )}
    </div>
  );
}
