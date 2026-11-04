"use client";
import {
  ArrowUpRight,
  Check,
  AlertCircle,
  Clock3,
  Package,
  Activity,
  Flag,
} from "lucide-react";
import { dateTime, money } from "@/lib/backend/types";
import { PLANS, formatBytes } from "@/lib/hosting/catalogue";
import type { OperatorReport } from "@/lib/superadmin/types";
export type DashboardTab =
  | "overview"
  | "usage"
  | "activity"
  | "collection"
  | "work"
  | "policy"
  | "payments"
  | "operations"
  | "access";
export function OverviewHub({
  report,
  navigate,
}: {
  report: OperatorReport;
  navigate: (tab: DashboardTab, filter?: string) => void;
}) {
  const { pulse, policy, hosting } = report,
    backup = hosting?.operations?.backup;
  const pending =
    hosting?.orders.filter((o) =>
      ["pending_payment", "payment_review"].includes(o.status),
    ) || [];
  const checks: {
    title: string;
    body: string;
    tab: DashboardTab;
    filter?: string;
    tone: string;
  }[] = [];
  if (policy.enforced && policy.count >= policy.limit)
    checks.push({
      title: "Nieuwe toevoegingen zijn geblokkeerd",
      body: `${policy.count} objecten bij een limiet van ${policy.limit}. Je kunt de pakketrechten of een tijdelijke uitzondering beheren.`,
      tab: "policy",
      tone: "warning",
    });
  if (
    !backup?.lastSuccess ||
    backup.status === "error" ||
    Date.now() - Date.parse(backup.lastSuccess) > 36 * 3600000
  )
    checks.push({
      title: "Controleer de reservekopie",
      body: backup?.lastSuccess
        ? `Laatst bevestigd op ${dateTime(backup.lastSuccess)}.`
        : "Er is geen recent bevestigde reservekopie beschikbaar.",
      tab: "operations",
      tone: "danger",
    });
  if (pending.length)
    checks.push({
      title: `${pending.length} pakketbestelling${pending.length > 1 ? "en" : ""} opvolgen`,
      body: "Controleer bankontvangst en afgesproken infrastructuur vóór activering.",
      tab: "payments",
      tone: "warning",
    });
  if (pulse?.work.overdue)
    checks.push({
      title: `${pulse.work.overdue} interne taak${pulse.work.overdue > 1 ? "en" : ""} over de termijn`,
      body: "Bekijk jouw open afspraken en prioriteiten.",
      tab: "work",
      tone: "warning",
    });
  const max = Math.max(1, ...(pulse?.daily.map((d) => d.products) || [])),
    total = pulse?.daily.reduce((n, d) => n + d.products, 0) || 0;
  return (
    <>
      <div className="sa-overview-intro">
        <div>
          <h2>Welkom terug, Kevin.</h2>
          <p>
            {pulse?.lastOwnerActivity
              ? `Laatste opgeslagen eigenaarshandeling: ${dateTime(pulse.lastOwnerActivity)}.`
              : "Nieuwe opgeslagen eigenaarshandelingen verschijnen hier zodra ze plaatsvinden."}
          </p>
        </div>
        <span className="sa-live-status">
          <span />
          {report.fetchedAt
            ? `Bijgewerkt ${new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date(report.fetchedAt))}`
            : "Laatste opgeslagen toestand"}
        </span>
      </div>
      <section className="sa-command-band">
        <div>
          <span>Collectie</span>
          <strong>
            {policy.count.toLocaleString("nl-BE")}
            <small> / {policy.limit.toLocaleString("nl-BE")}</small>
          </strong>
          <p>
            {policy.enforced
              ? policy.count >= policy.limit
                ? "Nieuwe toevoegingen geblokkeerd"
                : "Ruimte voor nieuwe objecten"
              : "Objectlimiet uitgeschakeld"}
          </p>
          <button className="sa-text" onClick={() => navigate("policy")}>
            Rechten beheren
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div>
          <span>Online</span>
          <strong>
            {pulse?.collection.published ?? "—"}
            <small> producten</small>
          </strong>
          <p>
            {pulse
              ? `${pulse.collection.draft} concepten · ${pulse.collection.archived} in archief`
              : "Collectieoverzicht niet beschikbaar"}
          </p>
          <button
            className="sa-text"
            onClick={() => navigate("collection", "published")}
          >
            Collectie controleren
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div>
          <span>Reservekopie</span>
          <strong>
            {backup?.status === "ready"
              ? "Bevestigd"
              : backup?.status === "error"
                ? "Controle nodig"
                : "Niet bevestigd"}
          </strong>
          <p>
            {backup?.lastSuccess
              ? dateTime(backup.lastSuccess)
              : "Geen bevestigd tijdstip beschikbaar"}
          </p>
          <button className="sa-text" onClick={() => navigate("operations")}>
            Back-ups & onderhoud
            <ArrowUpRight size={15} />
          </button>
        </div>
      </section>
      <div className="sa-overview-columns">
        <section className="sa-section">
          <div className="sa-section-heading">
            <h2>Jouw aandacht nodig</h2>
            <span className="sa-badge">{checks.length}</span>
          </div>
          {!checks.length ? (
            <div className="sa-all-clear">
              <Check size={24} />
              <div>
                <strong>Geen directe aandachtspunten</strong>
                <p>De beschikbare controles vragen nu geen actie.</p>
              </div>
            </div>
          ) : (
            <div className="sa-attention">
              {checks.map((check) => (
                <button
                  key={check.title}
                  className={`sa-attention-item sa-attention-${check.tone}`}
                  onClick={() => navigate(check.tab, check.filter)}
                >
                  <AlertCircle size={20} />
                  <span>
                    <strong>{check.title}</strong>
                    <small>{check.body}</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="sa-section">
          <div className="sa-section-heading">
            <h2>Fiches op orde</h2>
            <button
              className="sa-text"
              onClick={() => navigate("collection", "incomplete")}
            >
              Controleren
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="sa-quality-list">
            {[
              {
                label: "Onvolledige productfiches",
                value: pulse?.collection.incomplete,
                filter: "incomplete",
              },
              {
                label: "Nog zonder prijs",
                value: pulse?.collection.price,
                filter: "price",
              },
              {
                label: "Foto’s controleren",
                value: pulse?.collection.photos,
                filter: "photos",
              },
            ].map((row) => (
              <button
                key={row.filter}
                onClick={() => navigate("collection", row.filter)}
              >
                <span>{row.label}</span>
                <strong>{row.value ?? "—"}</strong>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="sa-section sa-activity-chart">
        <div className="sa-section-heading">
          <div>
            <h2>Het werk aan de collectie</h2>
            <p>{total} opgeslagen producthandelingen in de laatste 30 dagen</p>
          </div>
          <button className="sa-text" onClick={() => navigate("activity")}>
            Logboek doorzoeken
            <ArrowUpRight size={15} />
          </button>
        </div>
        {pulse ? (
          <>
            <div
              className="sa-chart"
              role="img"
              aria-label={`${total} producthandelingen gedurende dertig dagen. Kies een dag om het logboek te openen.`}
            >
              {pulse.daily.map((day) => (
                <button
                  key={day.day}
                  onClick={() => navigate("activity", day.day)}
                  aria-label={`${day.day}: ${day.products} producthandelingen`}
                  title={`${day.day} · ${day.products} producthandelingen`}
                >
                  <span
                    style={{
                      height: `${Math.max(2, (day.products / max) * 100)}%`,
                    }}
                    data-active={day.products > 0}
                  />
                </button>
              ))}
            </div>
            <div className="sa-chart-axis">
              <span>{pulse.daily[0]?.day}</span>
              <span>Vandaag</span>
            </div>
            <p className="sa-muted sa-chart-note">
              Opgeslagen handelingen, geen actieve schermtijd. Registratie vanaf{" "}
              {pulse.trackingSince
                ? dateTime(pulse.trackingSince)
                : "de eerste geregistreerde handeling"}
              .
            </p>
          </>
        ) : (
          <p className="sa-muted">
            Het activiteitenoverzicht is tijdelijk niet beschikbaar.
          </p>
        )}
      </section>
      <section className="sa-section">
        <h2>Verkoop & werkvoorraad</h2>
        <div className="sa-quality-list sa-sales-overview">
          <button onClick={() => navigate("collection", "reserved")}>
            <span>Gereserveerde producten</span>
            <strong>{pulse?.collection.reserved ?? "—"}</strong>
            <ArrowUpRight size={15} />
          </button>
          <button onClick={() => navigate("collection", "sold")}>
            <span>Verkochte producten</span>
            <strong>{pulse?.collection.sold ?? "—"}</strong>
            <ArrowUpRight size={15} />
          </button>
          <button onClick={() => navigate("work")}>
            <span>Jouw open taken</span>
            <strong>{pulse?.work.open ?? "—"}</strong>
            <ArrowUpRight size={15} />
          </button>
          <div>
            <span>Netto geregistreerde ontvangsten</span>
            <strong>
              {pulse ? money(pulse.sales.netReceived) : "Niet beschikbaar"}
            </strong>
            <small>
              Op basis van geregistreerde betalingen en terugbetalingen, geen
              bankkoppeling.
            </small>
          </div>
        </div>
      </section>
      <section className="sa-section">
        <h2>Technische toestand</h2>
        {report.technicalError && (
          <p className="sa-error" role="status">
            {report.technicalError}
          </p>
        )}
        <dl className="sa-technical">
          {[
            ["Mediaopslag", hosting?.metrics.media],
            ["Database", hosting?.metrics.database],
            ["Mediadownloads deze maand", hosting?.metrics.direct],
          ].map(([label, metric]) => {
            const m = typeof metric === "object" ? metric : undefined;
            return (
              <div key={String(label)}>
                <dt>{String(label)}</dt>
                <dd>
                  {m?.status === "ready" && m.value !== null
                    ? formatBytes(m.value)
                    : "Niet beschikbaar"}
                  {m?.measuredAt && (
                    <small>Gemeten {dateTime(m.measuredAt)}</small>
                  )}
                </dd>
              </div>
            );
          })}
          <div>
            <dt>Actief pakket</dt>
            <dd>
              {hosting ? PLANS[hosting.plan].name : "Niet beschikbaar"}
              <small>
                {hosting?.validUntil
                  ? `Geldig tot ${dateTime(hosting.validUntil)}`
                  : "Geen actieve betaalde looptijd"}
              </small>
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
