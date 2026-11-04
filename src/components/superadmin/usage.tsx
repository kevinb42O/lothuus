"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  BarChart3,
  MousePointer2,
  Eye,
  RefreshCw,
} from "lucide-react";
import {
  usageActions,
  usageCategory,
  type UsageAction,
} from "@/lib/admin-usage";
import { PRODUCTS, type HostingProduct } from "@/lib/hosting/catalogue";
import { dateTime } from "@/lib/backend/types";
import type { UsageReport } from "@/lib/superadmin/types";
import { request, useData } from "./client";
const sectionLabels: Record<string, string> = {
  overview: "Overzicht",
  items: "Producten",
  reservations: "Bestellingen",
  customers: "Klanten",
  emails: "E-mail",
  settings: "Instellingen",
  hearts: "Hartjes",
  hosting: "Hosting & capaciteit",
  visitors: "Bezoekers",
  updates: "Updates",
};
function actionLabel(action: string) {
  return usageActions[action as UsageAction] || "Beheeractie";
}
export function UsageInsights() {
  const [days, setDays] = useState(30),
    [category, setCategory] = useState("all"),
    [rows, setRows] = useState<UsageReport["events"]>([]),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const { data, error, loading, reload } = useData<UsageReport>(
      `data?view=usage&days=${days}&category=${category}`,
    ),
    generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setRows(data?.events || []);
    setMore(data?.events.length === 50);
    setNotice("");
    setBusy(false);
  }, [data, days, category]);
  async function loadMore() {
    if (!rows.length) return;
    const id = generation.current;
    setBusy(true);
    try {
      const next = await request<UsageReport>(
        `data?view=usage&days=${days}&category=${category}&before=${rows.at(-1)!.id}`,
      );
      if (id === generation.current) {
        setRows((current) => [
          ...current,
          ...next.events.filter((e) => !current.some((old) => old.id === e.id)),
        ]);
        setMore(next.events.length === 50);
      }
    } catch (e) {
      if (id === generation.current) setNotice((e as Error).message);
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  const totals = data?.totals,
    max = Math.max(1, ...(data?.top.map((t) => t.hits) || [])),
    filtered = rows.filter(
      (e) => category === "all" || usageCategory(e.action) === category,
    );
  return (
    <section>
      <div className="sa-section-heading">
        <div>
          <h2>Wat wordt werkelijk gebruikt?</h2>
          <p className="sa-muted">
            De belangrijkste klikacties en zichtbare onderdelen van de
            eigenaarswerkruimte.
          </p>
        </div>
        <div
          className="sa-filter-tabs"
          role="group"
          aria-label="Gebruiksperiode"
        >
          {[7, 30, 90].map((period) => (
            <button
              key={period}
              aria-pressed={days === period}
              onClick={() => setDays(period)}
            >
              {period} dagen
            </button>
          ))}
        </div>
      </div>
      <button
        className="sa-secondary sa-more"
        disabled={loading}
        onClick={reload}
      >
        <RefreshCw size={16} />
        Statistieken vernieuwen
      </button>
      {error && (
        <p className="sa-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Gebruiksstatistieken laden…</p>
      ) : (
        data && (
          <>
            <div className="sa-interest-summary">
              <article>
                <MousePointer2 size={20} />
                <span>Geregistreerde acties</span>
                <strong>{totals!.actions}</strong>
                <small>Openingen en bekeken onderdelen tellen apart</small>
              </article>
              <article>
                <Eye size={20} />
                <span>Verbruik bekeken</span>
                <strong>{totals!.usageViews}</strong>
                <small>{totals!.usageRefreshes} keer vernieuwd</small>
              </article>
              <article>
                <BarChart3 size={20} />
                <span>Pakketten bekeken</span>
                <strong>{totals!.plansViews}</strong>
                <small>{totals!.planClicks} pakketklikken</small>
              </article>
              <article>
                <ArrowUpRight size={20} />
                <span>Betaalvenster geopend</span>
                <strong>{totals!.paymentOpens}</strong>
                <small>{totals!.orderClicks} klikken op bestellen</small>
              </article>
            </div>
            <p className="sa-info">
              ‘Bekeken’ betekent dat minstens 25% van het onderdeel twee
              seconden zichtbaar was in een actief tabblad. Dit bewijst geen
              leesduur, begrip of betaalintentie. Een pakketklik of
              betaalmelding is geen bevestigde betaling.
            </p>
            <div className="sa-overview-columns">
              <section className="sa-section">
                <h2>Pakketten & verbruik, stap voor stap</h2>
                <ol className="sa-interest-steps">
                  {[
                    ["Hosting & capaciteit geopend", totals!.hostingOpens],
                    ["Verbruiksblok bekeken", totals!.usageViews],
                    ["Pakketoverzicht bekeken", totals!.plansViews],
                    ["Op Pro of Business geklikt", totals!.planClicks],
                    ["Betaalvenster geopend", totals!.paymentOpens],
                    ["Op bestelling vastleggen geklikt", totals!.orderClicks],
                    ["Op betaling melden geklikt", totals!.paymentClaims],
                  ].map(([label, count]) => (
                    <li key={String(label)}>
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </li>
                  ))}
                </ol>
                <p className="sa-muted">
                  Dit zijn aantallen gebeurtenissen, geen unieke personen of
                  gekoppelde conversies.
                </p>
              </section>
              <section className="sa-section">
                <h2>Meest gebruikte acties</h2>
                {!data.top.length ? (
                  <p className="sa-muted">
                    Nog geen klikacties geregistreerd in deze periode.
                  </p>
                ) : (
                  <div className="sa-ranking">
                    {data.top.slice(0, 12).map((entry, index) => (
                      <div key={entry.action}>
                        <span className="sa-rank">{index + 1}</span>
                        <div>
                          <span>{actionLabel(entry.action)}</span>
                          <div className="sa-rank-track">
                            <span
                              style={{ width: `${(entry.hits / max) * 100}%` }}
                            />
                          </div>
                        </div>
                        <strong>{entry.hits}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
            <section className="sa-section">
              <h2>Interesse per pakket</h2>
              {!data.products.length ? (
                <div className="sa-empty">
                  <p>
                    Hier verschijnen Pro, Business en de gekozen betaalperiode
                    zodra een pakketactie wordt geregistreerd.
                  </p>
                </div>
              ) : (
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Pakket</th>
                        <th>Pakketklikken</th>
                        <th>Betaalvenster</th>
                        <th>Bestelklik</th>
                        <th>Klik op betaling melden</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.products.map((product) => (
                        <tr key={product.product}>
                          <td>
                            {PRODUCTS[product.product as HostingProduct]
                              ?.label || product.product}
                          </td>
                          <td>{product.clicks || 0}</td>
                          <td>{product.opens || 0}</td>
                          <td>{product.orders || 0}</td>
                          <td>{product.claims || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="sa-section">
              <div className="sa-section-heading">
                <div>
                  <h2>Wanneer werd waarop geklikt?</h2>
                  <p className="sa-muted">
                    Laatst geregistreerd:{" "}
                    {data.lastInteraction
                      ? dateTime(data.lastInteraction)
                      : "nog geen acties"}
                    . Registratie vanaf{" "}
                    {data.recordingSince
                      ? dateTime(data.recordingSince)
                      : "de eerste nieuwe actie"}
                    .
                  </p>
                </div>
                <label>
                  <span className="sa-sr-only">Gebruiksacties filteren</span>
                  <select
                    aria-label="Gebruiksacties filteren"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">Alle acties</option>
                    <option value="packages">Pakketten & betalen</option>
                    <option value="usage">Verbruik</option>
                    <option value="workspace">Overige werkruimte</option>
                  </select>
                </label>
              </div>
              {notice && (
                <p className="sa-error" role="status">
                  {notice}
                </p>
              )}
              {!filtered.length ? (
                <div className="sa-empty">
                  <p>
                    Geen geregistreerde gebeurtenissen voor dit filter in deze
                    periode.
                  </p>
                </div>
              ) : (
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Geregistreerd om</th>
                        <th>Actie</th>
                        <th>Onderdeel</th>
                        <th>Pakket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((event) => (
                        <tr key={event.id}>
                          <td>{dateTime(event.at)}</td>
                          <td>
                            <strong>{actionLabel(event.action)}</strong>
                          </td>
                          <td>
                            {sectionLabels[event.section] || event.section}
                          </td>
                          <td>
                            {event.product
                              ? PRODUCTS[event.product as HostingProduct]
                                  ?.label || event.product
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {more && (
                <button
                  className="sa-secondary sa-more"
                  disabled={busy}
                  onClick={() => void loadMore()}
                >
                  <ArrowDown size={16} />
                  {busy ? "Laden…" : "Oudere gebeurtenissen laden"}
                </button>
              )}
            </section>
            <p className="sa-muted sa-section">
              De tijdlijn bewaart gebeurtenissen 90 dagen en de dagtotalen één
              jaar. Registratie kan ontbreken bij netwerkproblemen, een gesloten
              tabblad of geblokkeerde verzoeken. Er worden geen formulierwaarden
              of wachtwoorden als klikgegevens opgeslagen.
            </p>
          </>
        )
      )}
    </section>
  );
}
