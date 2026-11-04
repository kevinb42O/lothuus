"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Search, ArrowDown } from "lucide-react";
import type { Activity } from "@/lib/superadmin/types";
import { useData, request, exportData } from "./client";
import { ActivityList } from "./superadmin";
export function ActivityExplorer({
  initialSince = "",
}: {
  initialSince?: string;
}) {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [kind, setKind] = useState("all"),
    [who, setWho] = useState("all"),
    [since, setSince] = useState(initialSince),
    [until, setUntil] = useState(""),
    [rows, setRows] = useState<Activity[]>([]),
    [total, setTotal] = useState(0),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(q), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const params = new URLSearchParams({
    view: "activity",
    q: search,
    kind,
    who,
  });
  if (since) params.set("since", new Date(`${since}T00:00:00`).toISOString());
  if (until) {
    const end = new Date(`${until}T00:00:00`);
    end.setDate(end.getDate() + 1);
    params.set("until", end.toISOString());
  }
  const query = params.toString(),
    { data, error, loading } = useData<{ activity: Activity[]; total: number }>(
      `data?${query}`,
    );
  useEffect(() => {
    ++generation.current;
    setRows(data?.activity || []);
    setTotal(data?.total || 0);
    setMore(data?.activity.length === 50);
    setBusy(false);
  }, [data, query]);
  async function loadMore() {
    const id = generation.current;
    setBusy(true);
    setNotice("");
    try {
      const next = await request<{ activity: Activity[]; total: number }>(
        `data?${query}&before=${rows.at(-1)!.id}`,
      );
      if (id === generation.current) {
        setRows((current) => [
          ...current,
          ...next.activity.filter(
            (e) => !current.some((old) => old.id === e.id),
          ),
        ]);
        setMore(next.activity.length === 50);
        setTotal(next.total);
      }
    } catch (e) {
      if (id === generation.current) setNotice((e as Error).message);
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  return (
    <section>
      <div className="sa-work-toolbar">
        <label className="sa-search">
          <Search size={18} />
          <input
            aria-label="Zoek in activiteiten"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={120}
            placeholder="Product, handeling of reden"
          />
        </label>
        <label>
          <span className="sa-sr-only">Handelingen</span>
          <select
            aria-label="Handelingen"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {[
              ["all", "Alle handelingen"],
              ["product", "Producten"],
              ["capacity", "Capaciteit"],
              ["access", "Aanmeldingen"],
              ["payment", "Pakketbetalingen"],
              ["operator", "Beheeracties"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sa-sr-only">Actor</span>
          <select
            aria-label="Actor"
            value={who}
            onChange={(e) => setWho(e.target.value)}
          >
            {[
              ["all", "Iedereen"],
              ["owner", "Eigenaar"],
              ["operator", "Kevin"],
              ["system", "Systeem"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="sa-work-toolbar sa-period">
        <label>
          Van
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </label>
        <label>
          Tot en met
          <input
            type="date"
            value={until}
            min={since || undefined}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <button
          className="sa-secondary"
          disabled={loading || busy}
          onClick={async () => {
            setBusy(true);
            setNotice("");
            try {
              const exported = await exportData("activity", query);
              setNotice(
                `${exported.count} van ${exported.total} gevonden activiteiten geëxporteerd.${exported.count < exported.total ? " Verfijn de periode om de overige resultaten te exporteren." : ""}`,
              );
            } catch (e) {
              setNotice((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={16} />
          CSV exporteren
        </button>
        <button
          className="sa-text"
          onClick={() => {
            setQ("");
            setKind("all");
            setWho("all");
            setSince("");
            setUntil("");
          }}
        >
          Filters wissen
        </button>
      </div>
      {notice && (
        <p className="sa-info" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="sa-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Activiteiten zoeken…</p>
      ) : (
        <>
          <p className="sa-muted">
            {total} resultaten · {rows.length} geladen. De registratie begint
            bij de ingebruikname; oudere handelingen zijn niet gereconstrueerd.
          </p>
          <ActivityList activity={rows} />
          {more && (
            <button
              className="sa-secondary sa-more"
              disabled={busy}
              onClick={() => void loadMore()}
            >
              <ArrowDown size={16} />
              {busy ? "Laden…" : "Oudere resultaten laden"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
