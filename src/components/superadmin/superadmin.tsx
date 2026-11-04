"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Activity as ActivityIcon,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  Gauge,
  LogOut,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
  Package,
  ListTodo,
  Database,
  Search,
  MousePointer2,
  ArrowRight,
} from "lucide-react";
import { PLANS, PRODUCTS, formatBytes } from "@/lib/hosting/catalogue";
import { dateTime, money } from "@/lib/backend/types";
import {
  activityLabels,
  fieldLabels,
  type Activity,
  type OperatorReport,
  type OperatorSession,
} from "@/lib/superadmin/types";
import { request, RequestError, useUnsavedGuard } from "./client";
import { Dialog } from "../dialog";
import { UsageInsights } from "./usage";
import { PackageActivation } from "./packages";
import { Collection } from "./collection";
import { ActivityExplorer } from "./activity";
import { WorkDesk } from "./work";
import { Operations, Access } from "./operations";
import { OverviewHub, type DashboardTab } from "./overview";
import "./superadmin.css";

export function Superadmin() {
  const [session, setSession] = useState<OperatorSession | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const check = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSession(await request<OperatorSession>("session"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void check();
  }, [check]);
  if (loading)
    return (
      <div className="sa-root sa-loading" role="status">
        Je beheeromgeving laden…
      </div>
    );
  if (!session)
    return (
      <div className="sa-root sa-login">
        <h1>Superadmin</h1>
        <p role="alert">{error}</p>
        <button onClick={() => void check()}>Opnieuw proberen</button>
      </div>
    );
  return (
    <div className="sa-root">
      {!session.authenticated ? (
        <Login onSession={setSession} />
      ) : (
        <Dashboard
          onExpired={() => {
            setSession(null);
            void check();
          }}
          onLogout={async () => {
            await request("session", undefined, "DELETE");
            setSession({ authenticated: false });
          }}
        />
      )}
    </div>
  );
}
function Login({
  onSession,
}: {
  onSession: (session: OperatorSession) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      input = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const session = await request<OperatorSession>("session", {
        action: "login",
        email: input.get("email"),
        password: input.get("password"),
      });
      form.reset();
      onSession(session);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="sa-login">
      <a className="sa-brand" href="/">
        LOTHUUS
      </a>
      <div className="sa-login-heading">
        <ShieldCheck size={28} aria-hidden="true" />
        <h1>Jouw beheeromgeving.</h1>
        <p>
          Activiteit, rechten en de technische toestand van LOTHUUS, op één
          plek.
        </p>
      </div>
      <form onSubmit={submit}>
        <label>
          E-mailadres
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={180}
          />
        </label>
        <label htmlFor="sa-password">Wachtwoord</label>
        <div className="sa-password">
          <input
            id="sa-password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={200}
          />
          <button
            type="button"
            aria-label={visible ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
        {error && (
          <p className="sa-error" role="alert">
            {error}
          </p>
        )}
        <button className="sa-primary" disabled={busy}>
          {busy ? "Inloggen…" : "Veilig inloggen"}
          <ArrowUpRight size={17} />
        </button>
      </form>
      <p className="sa-muted">
        Alleen toegankelijk met jouw persoonlijke beheeraccount.
      </p>
      <a className="sa-back" href="/">
        <ArrowLeft size={15} />
        Naar de website
      </a>
    </main>
  );
}
export function Dashboard({
  onExpired,
  onLogout,
  initialReport,
}: {
  onExpired: () => void;
  onLogout: () => Promise<void>;
  initialReport?: OperatorReport;
}) {
  const [tab, setTab] = useState<DashboardTab>("overview"),
    [report, setReport] = useState<OperatorReport | null>(
      initialReport || null,
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(false),
    [sectionKey, setSectionKey] = useState(0),
    [targetFilter, setTargetFilter] = useState("all"),
    [activitySince, setActivitySince] = useState("");
  const [jump, setJump] = useState(""),
    [jumpOpen, setJumpOpen] = useState(false);
  const expired = useRef(onExpired);
  expired.current = onExpired;
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const data = await request<OperatorReport>("report");
      if (id === generation.current) setReport(data);
    } catch (e) {
      if (id === generation.current) {
        if (e instanceof RequestError && [401, 403].includes(e.status)) return;
        else setError((e as Error).message);
      }
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    return () => {
      ++generation.current;
    };
  }, [reload]);
  useEffect(() => {
    const handler = () => expired.current();
    window.addEventListener("operator-session-expired", handler);
    return () =>
      window.removeEventListener("operator-session-expired", handler);
  }, []);
  const navigate = useCallback((next: DashboardTab, filter?: string) => {
    if (
      !window.dispatchEvent(
        new window.Event("operator-before-navigate", { cancelable: true }),
      )
    )
      return;
    setTab(next);
    setTargetFilter(filter || "all");
    setActivitySince(
      next === "activity" && filter && /^\d{4}-\d{2}-\d{2}$/.test(filter)
        ? filter
        : "",
    );
    setSectionKey((n) => n + 1);
    setJumpOpen(false);
    setNotice("");
    window.scrollTo({ top: 0 });
  }, []);
  async function save(body: unknown) {
    setNotice("");
    await request("manage", body);
    setNotice("Wijziging opgeslagen en geregistreerd.");
    await reload();
  }
  const tabs = [
    {
      key: "overview",
      label: "Overzicht",
      icon: Gauge,
      description: "Wat vraagt jouw aandacht?",
    },
    {
      key: "usage",
      label: "Klikken & interesse",
      icon: MousePointer2,
      description: "Wat gebruikt de eigenaar, en welke pakketten bekijkt ze?",
    },
    {
      key: "collection",
      label: "Collectie & versies",
      icon: Package,
      description: "Controleer fiches en herstel gekozen velden.",
    },
    {
      key: "activity",
      label: "Activiteiten",
      icon: ActivityIcon,
      description: "Zoek in opgeslagen wijzigingen en beheerhandelingen.",
    },
    {
      key: "work",
      label: "Jouw werkblad",
      icon: ListTodo,
      description: "Interne taken, afspraken en opvolging.",
    },
    {
      key: "policy",
      label: "Pakket & rechten",
      icon: SlidersHorizontal,
      description: "Beheer capaciteit en tijdelijke uitzonderingen.",
    },
    {
      key: "payments",
      label: "Betalingen",
      icon: Wallet,
      description: "Controleer ontvangen pakketbetalingen.",
    },
    {
      key: "operations",
      label: "Back-ups & techniek",
      icon: Database,
      description: "Reservekopieën, metingen en uitvoeringen.",
    },
    {
      key: "access",
      label: "Toegang",
      icon: ShieldCheck,
      description: "Jouw account en afzonderlijke beheersessies.",
    },
  ] as const;
  const current = tabs.find((t) => t.key === tab)!;
  return (
    <div className="sa-shell">
      <aside className="sa-sidebar">
        <a href="/superadmin" className="sa-brand">
          LOTHUUS<span>Persoonlijk beheer</span>
        </a>
        <button className="sa-quick-search" onClick={() => setJumpOpen(true)}>
          <Search size={16} />
          Ga naar…
        </button>
        <nav aria-label="Superadminnavigatie">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => navigate(key)}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
              {key === "work" && !!report?.pulse?.work.open && (
                <small>{report.pulse.work.open}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sa-sidebar-bottom">
          <p>
            Kevin
            <br />
            <span>kevin@webaanzee.be</span>
          </p>
          <a href="/" target="_blank" rel="noreferrer">
            Website bekijken
            <ArrowUpRight size={15} />
          </a>
          <button
            onClick={async () => {
              try {
                if (
                  !window.dispatchEvent(
                    new window.Event("operator-before-navigate", {
                      cancelable: true,
                    }),
                  )
                )
                  return;
                await onLogout();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Uitloggen
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      <main className="sa-main">
        <header className="sa-heading">
          <div>
            <h1>{current.label}</h1>
            <p>{current.description}</p>
          </div>
          <button
            className="sa-secondary"
            disabled={loading}
            onClick={() => {
              if (
                !window.dispatchEvent(
                  new window.Event("operator-before-navigate", {
                    cancelable: true,
                  }),
                )
              )
                return;
              void reload();
              setSectionKey((n) => n + 1);
            }}
          >
            <RefreshCw size={16} />
            {loading ? "Vernieuwen…" : "Vernieuwen"}
          </button>
        </header>
        {error && (
          <p className="sa-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="sa-success" role="status">
            <Check size={16} />
            {notice}
          </p>
        )}
        {!report ? (
          <p role="status">
            {loading ? "Gegevens laden…" : "Er zijn nog geen gegevens geladen."}
          </p>
        ) : (
          <>
            {tab === "overview" && (
              <>
                <OverviewHub report={report} navigate={navigate} />
                <section className="sa-section">
                  <div className="sa-section-heading">
                    <h2>Zojuist opgeslagen</h2>
                    <button
                      className="sa-text"
                      onClick={() => navigate("activity")}
                    >
                      Volledig logboek
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <ActivityList activity={report.activity.slice(0, 8)} />
                </section>
              </>
            )}
            {tab === "usage" && <UsageInsights key={sectionKey} />}
            {tab === "collection" && (
              <Collection
                key={sectionKey}
                initialFilter={targetFilter}
                onChanged={() => void reload()}
              />
            )}
            {tab === "activity" && (
              <ActivityExplorer key={sectionKey} initialSince={activitySince} />
            )}
            {tab === "work" && (
              <WorkDesk key={sectionKey} onChanged={() => void reload()} />
            )}
            {tab === "policy" && (
              <Policy
                key={report.settings.version}
                report={report}
                onSave={save}
              />
            )}
            {tab === "payments" && (
              <>
                <PackageActivation
                  report={report}
                  onChanged={() => void reload()}
                />
                <section className="sa-section">
                  <h2>Betalingen bij bestaande bestellingen</h2>
                  <Payments report={report} onSave={save} />
                </section>
              </>
            )}
            {tab === "operations" && (
              <Operations
                key={sectionKey}
                report={report}
                onChanged={() => void reload()}
              />
            )}
            {tab === "access" && <Access key={sectionKey} report={report} />}
          </>
        )}
      </main>
      {jumpOpen && (
        <Dialog
          title="Snel navigeren"
          className="sa-jump"
          onClose={() => setJumpOpen(false)}
        >
          <div className="sa-section-heading">
            <h2>Snel naar jouw taak</h2>
            <button className="sa-text" onClick={() => setJumpOpen(false)}>
              Sluiten
            </button>
          </div>
          <input
            autoFocus
            aria-label="Zoek beheeronderdeel"
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setJumpOpen(false);
            }}
            placeholder="Collectie, back-up, rechten…"
          />
          {tabs
            .filter((t) =>
              `${t.label} ${t.description}`
                .toLowerCase()
                .includes(jump.toLowerCase()),
            )
            .map((t) => (
              <button
                key={t.key}
                className="sa-jump-result"
                onClick={() => navigate(t.key)}
              >
                <span>
                  <strong>{t.label}</strong>
                  <small>{t.description}</small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
        </Dialog>
      )}
    </div>
  );
}
export function Overview({ report }: { report: OperatorReport }) {
  const { policy, hosting } = report,
    backup = hosting?.operations?.backup;
  return (
    <>
      <section className="sa-summary" aria-label="Huidige toestand">
        <div>
          <span>Collectie</span>
          <strong>
            {policy.count}
            <small> / {policy.limit} objecten</small>
          </strong>
          <p>
            {policy.enforced
              ? policy.count >= policy.limit
                ? "Nieuwe toevoegingen geblokkeerd"
                : "Nieuwe toevoegingen toegestaan"
              : "Limiet uitgeschakeld"}
          </p>
        </div>
        <div>
          <span>Pakket</span>
          <strong>
            {hosting ? PLANS[hosting.plan].name : "Niet beschikbaar"}
          </strong>
          <p>
            {hosting?.validUntil
              ? `Geldig tot ${dateTime(hosting.validUntil)}`
              : "Geen actieve betaalde looptijd"}
          </p>
        </div>
        <div>
          <span>Reservekopie</span>
          <strong>
            {backup?.status === "ready"
              ? "Veilig bewaard"
              : backup?.status === "error"
                ? "Controle nodig"
                : "Niet bevestigd"}
          </strong>
          <p>
            {backup?.lastSuccess
              ? dateTime(backup.lastSuccess)
              : "Geen bevestigd tijdstip beschikbaar"}
          </p>
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
            <dt>Providerverbruik</dt>
            <dd>
              {hosting?.operations?.supabase.status === "ready" &&
              hosting.operations.supabase.value !== null
                ? formatBytes(hosting.operations.supabase.value)
                : "Niet beschikbaar"}
              <small>
                Laatste opgeslagen metingen; vernieuwen start geen nieuwe scan.
              </small>
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
export function ActivityList({ activity }: { activity: Activity[] }) {
  if (!activity.length)
    return (
      <div className="sa-empty">
        <h3>Nog geen activiteiten</h3>
        <p>
          Nieuwe opgeslagen handelingen verschijnen hier vanaf de ingebruikname.
        </p>
      </div>
    );
  return (
    <div className="sa-table-wrap">
      <table className="sa-table">
        <thead>
          <tr>
            <th>Tijdstip</th>
            <th>Wie</th>
            <th>Handeling</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((event) => (
            <tr key={event.id}>
              <td>
                <time dateTime={event.at}>{dateTime(event.at)}</time>
              </td>
              <td>{event.actor}</td>
              <td>
                <strong>
                  {activityLabels[event.kind] || "Systeemhandeling"}
                </strong>
                {event.details.number && <small>{event.details.number}</small>}
              </td>
              <td>
                <span>{event.title || "Product zonder titel"}</span>
                {event.details.fields?.length ? (
                  <small>
                    {event.details.fields
                      .map((field) => fieldLabels[field] || field)
                      .join(", ")}
                  </small>
                ) : null}
                {event.details.reason && (
                  <small>Reden: {event.details.reason}</small>
                )}
                {event.kind === "policy_changed" && (
                  <details>
                    <summary>Wijziging bekijken</summary>
                    <pre>
                      {JSON.stringify(
                        {
                          ervoor: event.details.before,
                          erna: event.details.after,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function Policy({
  report,
  onSave,
}: {
  report: OperatorReport;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [enforced, setEnforced] = useState(report.settings.enforce_limit),
    [limit, setLimit] = useState(
      report.settings.object_limit?.toString() || "",
    ),
    [until, setUntil] = useState(localDate(report.settings.expires_at)),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useUnsavedGuard(
    enforced !== report.settings.enforce_limit ||
      limit !== (report.settings.object_limit?.toString() || "") ||
      until !== localDate(report.settings.expires_at) ||
      reason.length > 0,
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (
      until &&
      (!Number.isFinite(Date.parse(until)) || Date.parse(until) <= Date.now())
    ) {
      setError("Kies een einddatum in de toekomst.");
      return;
    }
    if (
      !window.confirm(
        enforced
          ? "Deze objectrechten opslaan? De bestaande collectie blijft behouden."
          : "De objectlimiet uitschakelen? Nieuwe toevoegingen zijn dan toegestaan, ook boven de pakketlimiet.",
      )
    )
      return;
    setBusy(true);
    try {
      await onSave({
        action: "policy",
        version: report.settings.version,
        enforced,
        limit: limit.trim() ? Number(limit) : null,
        expiresAt: until ? new Date(until).toISOString() : null,
        reason,
      });
      setReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sa-policy">
      <div className="sa-policy-current">
        <h2>Actuele objectrechten</h2>
        <p>
          <strong>
            {report.policy.count} / {report.policy.limit} objecten
          </strong>{" "}
          · {report.policy.enforced ? "Limiet actief" : "Limiet uitgeschakeld"}
        </p>
        <p>
          Bestaande producten blijven bewerkbaar. Deze instellingen wijzigen
          geen prijzen, betalingen of providerabonnementen.
        </p>
        {report.settings.expires_at && (
          <p>
            {Date.parse(report.settings.expires_at) <= Date.now()
              ? "De vorige uitzondering is verlopen. De gewone pakketlimiet geldt weer."
              : `De uitzondering loopt tot ${dateTime(report.settings.expires_at)}.`}
          </p>
        )}
      </div>
      <form onSubmit={submit}>
        <label className="sa-check">
          <input
            type="checkbox"
            checked={enforced}
            onChange={(e) => setEnforced(e.target.checked)}
          />
          Objectlimiet handhaven
        </label>
        <p className="sa-muted">
          {enforced
            ? "Nieuwe objecten worden tegengehouden zodra de effectieve limiet bereikt is."
            : "Nieuwe objecten zijn toegestaan, ook als de collectie groter is dan het pakket."}
        </p>
        <label>
          Afwijkende objectlimiet
          <input
            type="number"
            min="1"
            max="100000"
            step="1"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Leeg laten voor de gewone pakketlimiet"
          />
        </label>
        <label>
          Uitzondering geldig tot
          <input
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <p className="sa-muted">
          Na dit tijdstip gelden automatisch de gewone pakketlimiet en
          handhaving. Leeg betekent: tot je de instelling opnieuw wijzigt.
        </p>
        <label>
          Reden van de wijziging
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={3}
            maxLength={500}
            required
            rows={3}
            placeholder="Bijvoorbeeld: tijdelijk ruimte geven tot de betaalafspraak is afgerond."
          />
        </label>
        {error && (
          <p className="sa-error" role="alert">
            {error}
          </p>
        )}
        <button className="sa-primary" disabled={busy}>
          {busy ? "Opslaan…" : "Objectrechten opslaan"}
        </button>
      </form>
    </section>
  );
}
function Payments({
  report,
  onSave,
}: {
  report: OperatorReport;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  if (!report.hosting)
    return (
      <p role="status">
        De bestellingen konden niet worden geladen. Vernieuw de gegevens.
      </p>
    );
  const orders = report.hosting.orders,
    filtered = orders.filter(
      (order) =>
        (filter === "all" ||
          (filter === "open" &&
            ["pending_payment", "payment_review"].includes(order.status)) ||
          order.status === filter) &&
        `${PRODUCTS[order.product].label} ${order.id}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  return (
    <section>
      <div className="sa-payment-summary">
        <div>
          <span>Openstaande bestellingen</span>
          <strong>
            {
              orders.filter((o) =>
                ["pending_payment", "payment_review"].includes(o.status),
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Geregistreerde actieve pakketten</span>
          <strong>{orders.filter((o) => o.status === "active").length}</strong>
        </div>
        <div>
          <span>Bedrag openstaand</span>
          <strong>
            {money(
              orders
                .filter((o) =>
                  ["pending_payment", "payment_review"].includes(o.status),
                )
                .reduce((sum, o) => sum + o.cents, 0),
            )}
          </strong>
        </div>
      </div>
      <p className="sa-muted">
        Controleer eerst de ontvangst op je bankrekening. Een betalingsmelding
        van de eigenaar bevestigt de ontvangst niet. Activeer een pakket nadat
        de afgesproken hostingcapaciteit geleverd is. Dit overzicht bevat de 30
        recentste pakketbestellingen.
      </p>
      <div className="sa-work-toolbar">
        <label className="sa-search">
          <Search size={18} />
          <input
            aria-label="Zoek pakketbestelling"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pakket of bestelnummer"
          />
        </label>
        <label>
          <span className="sa-sr-only">Bestelstatus</span>
          <select
            aria-label="Bestelstatus"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Alle statussen</option>
            <option value="open">Openstaand</option>
            <option value="payment_review">Betaling gemeld</option>
            <option value="active">Actief</option>
            <option value="cancelled">Geannuleerd</option>
          </select>
        </label>
      </div>
      {!filtered.length ? (
        <div className="sa-empty">
          <h2>
            {orders.length
              ? "Geen bestellingen voor dit filter"
              : "Geen pakketbestellingen"}
          </h2>
          <p>
            Nieuwe bestellingen verschijnen zodra de eigenaar een pakket
            aanvraagt.
          </p>
        </div>
      ) : (
        filtered.map((order) => (
          <Payment key={order.id} order={order} onSave={onSave} />
        ))
      )}
    </section>
  );
}
function Payment({
  order,
  onSave,
}: {
  order: NonNullable<OperatorReport["hosting"]>["orders"][number];
  onSave: (body: unknown) => Promise<void>;
}) {
  const [receipt, setReceipt] = useState(""),
    [provisioned, setProvisioned] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = ["pending_payment", "payment_review"].includes(order.status),
    product = PRODUCTS[order.product];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !window.confirm(
        `${product.label} activeren na ontvangst van ${money(order.cents)}?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await onSave({
        action: "activate",
        orderId: order.id,
        receipt,
        provisioned,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="sa-payment">
      <div className="sa-section-heading">
        <div>
          <h2>{product.label}</h2>
          <p>
            {money(order.cents)} · {dateTime(order.createdAt)}
          </p>
          <small className="sa-muted">Bestelling {order.id}</small>
        </div>
        <span>
          {{
            pending_payment: "Wacht op betaling",
            payment_review: "Betaling gemeld",
            active: "Actief",
            cancelled: "Geannuleerd",
            provisioning: "Wordt voorbereid",
          }[order.status] || order.status}
        </span>
      </div>
      {pending && (
        <details>
          <summary>Betaling controleren en activeren</summary>
          <form onSubmit={submit}>
            <label>
              Bankreferentie
              <input
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                minLength={3}
                maxLength={180}
                required
              />
            </label>
            <label className="sa-check">
              <input
                type="checkbox"
                checked={provisioned}
                required={Boolean(product.plan)}
                onChange={(e) => setProvisioned(e.target.checked)}
              />
              {product.plan
                ? "De afgesproken infrastructuur is beschikbaar en de betaling is ontvangen."
                : "Ik heb de betaling gecontroleerd."}
            </label>
            {error && (
              <p className="sa-error" role="alert">
                {error}
              </p>
            )}
            <button className="sa-primary" disabled={busy || !provisioned}>
              {busy ? "Activeren…" : "Ontvangst bevestigen en activeren"}
            </button>
          </form>
        </details>
      )}
    </article>
  );
}
