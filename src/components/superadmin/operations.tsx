"use client";
import { useEffect, useState } from "react";
import {
  Check,
  Download,
  RefreshCw,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Database,
  HardDrive,
} from "lucide-react";
import { dateTime } from "@/lib/backend/types";
import type { OperatorReport, OperatorJob } from "@/lib/superadmin/types";
import { request, useData, exportData } from "./client";
export function Operations({
  report,
  onChanged,
}: {
  report: OperatorReport;
  onChanged: () => void;
}) {
  const { data, error, loading, reload } =
      useData<OperatorJob[]>("data?view=jobs"),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const jobs = data || report.jobs || [],
    running = jobs.some((job) => ["queued", "running"].includes(job.status));
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(reload, 5000);
    return () => clearTimeout(timer);
  }, [running, data, reload]);
  async function start(kind: "backup" | "measurements") {
    if (
      !window.confirm(
        kind === "backup"
          ? "Een nieuwe reservekopie maken en controleren? De vorige kopie blijft beschikbaar."
          : "De technische gebruiksmetingen opnieuw ophalen? Dit kan enkele minuten duren.",
      )
    )
      return;
    setBusy(kind);
    setMessage("");
    try {
      await request("workspace", { action: "maintenance", kind });
      setMessage(
        "De taak is aangevraagd. Je kunt de voortgang hieronder volgen.",
      );
      reload();
      onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const backup = report.hosting?.operations?.backup;
  return (
    <section>
      <div className="sa-operations-intro">
        <ShieldCheck size={26} />
        <div>
          <h2>Een reservekopie waarop je kunt vertrouwen</h2>
          <p>
            De website maakt dagelijks een kopie van de database. Een nieuwe
            kopie wordt pas bevestigd na teruglezen en checksumcontrole. Foto’s
            staan afzonderlijk in de private mediabucket.
          </p>
        </div>
      </div>
      <dl className="sa-technical">
        <div>
          <dt>Laatste bevestiging</dt>
          <dd>
            {backup?.lastSuccess
              ? dateTime(backup.lastSuccess)
              : "Nog niet bevestigd"}
            <small>
              {backup?.status === "ready"
                ? "Opgeslagen en gecontroleerd"
                : backup?.status === "error"
                  ? "Laatste uitvoering vraagt aandacht"
                  : "Status controleren"}
            </small>
          </dd>
        </div>
        <div>
          <dt>Bewaartermijn</dt>
          <dd>
            45 dagen
            <small>Gedateerde databasekopieën; productversies 90 dagen</small>
          </dd>
        </div>
        <div>
          <dt>Inhoud</dt>
          <dd>
            24 tabellen
            <small>Collectie, verkoop, pakketrechten, taken en versies</small>
          </dd>
        </div>
        <div>
          <dt>Herstel</dt>
          <dd>
            Gecontroleerd buiten productie
            <small>Geen volledige productie-restore met één klik</small>
          </dd>
        </div>
      </dl>
      <div className="sa-button-row sa-maintenance-actions">
        <button
          className="sa-primary"
          disabled={!!busy || running}
          onClick={() => void start("backup")}
        >
          <Database size={16} />
          {busy === "backup" ? "Aanvragen…" : "Nu een reservekopie maken"}
        </button>
        <button
          className="sa-secondary"
          disabled={!!busy || running}
          onClick={() => void start("measurements")}
        >
          <RefreshCw size={16} />
          {busy === "measurements" ? "Aanvragen…" : "Gebruik opnieuw meten"}
        </button>
      </div>
      <p className="sa-muted">
        Maximaal één onderhoudstaak tegelijk en één aanvraag per tien minuten.
        Gewoon vernieuwen haalt alleen de opgeslagen resultaten op.
      </p>
      {message && (
        <p className="sa-info" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="sa-error" role="alert">
          {error}
        </p>
      )}
      <section className="sa-section">
        <div className="sa-section-heading">
          <h2>Uitvoeringen</h2>
          <button className="sa-text" disabled={loading} onClick={reload}>
            Status vernieuwen
          </button>
        </div>
        {!jobs.length ? (
          <div className="sa-empty">
            <h3>Nog geen handmatige uitvoeringen</h3>
            <p>
              De bestaande dagelijkse taken blijven actief. Nieuwe aanvragen uit
              deze werkruimte verschijnen hier.
            </p>
          </div>
        ) : (
          <div className="sa-job-list">
            {jobs.map((job) => (
              <article key={job.id} className="sa-job">
                <span
                  className={`sa-job-dot sa-job-${job.status}`}
                  aria-hidden="true"
                />
                <div>
                  <strong>
                    {job.kind === "backup"
                      ? "Reservekopie"
                      : "Gebruiksmetingen"}
                  </strong>
                  <small>{dateTime(job.created_at)}</small>
                  <p>{job.message || "De aanvraag wacht op uitvoering."}</p>
                </div>
                <span className="sa-badge">
                  {
                    {
                      queued: "In wachtrij",
                      running: "Bezig",
                      succeeded: "Geslaagd",
                      partial: "Deels afgerond",
                      skipped: "Overgeslagen",
                      error: "Controle nodig",
                    }[job.status]
                  }
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="sa-section">
        <h2>Je gegevens meenemen</h2>
        <p>
          Download de collectie of een gefilterd activiteitenlogboek. Exports
          bevatten geen wachtwoorden of sessietokens. Een databaseback-up blijft
          in de private back-upopslag.
        </p>
        <button
          className="sa-secondary"
          disabled={!!busy}
          onClick={async () => {
            setBusy("export");
            try {
              const r = await exportData("collection");
              setMessage(`${r.count} van ${r.total} producten geëxporteerd.`);
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy("");
            }
          }}
        >
          <Download size={16} />
          Collectie als CSV
        </button>
      </section>
      <section className="sa-section">
        <h2>Beheerverbindingen</h2>
        <div className="sa-provider-links">
          <a
            href="https://vercel.com/lanternnetworks-projects/lothuus"
            target="_blank"
            rel="noreferrer"
          >
            Vercel · uitrol & logs
            <ExternalLink size={16} />
          </a>
          <a
            href="https://supabase.com/dashboard/project/gzrxxdmhonzcfkomowpo"
            target="_blank"
            rel="noreferrer"
          >
            Supabase · database & accounts
            <ExternalLink size={16} />
          </a>
          <a
            href="https://github.com/kevinb42O/lothuus"
            target="_blank"
            rel="noreferrer"
          >
            GitHub · broncode
            <ExternalLink size={16} />
          </a>
        </div>
      </section>
    </section>
  );
}
export function Access({ report }: { report: OperatorReport }) {
  const { data, error, loading } = useData<{
      email: string;
      lastSignIn: string | null;
      createdAt: string | null;
      assurance: string;
      isolatedSession: boolean;
    }>("data?view=access"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function revoke() {
    if (
      !window.confirm(
        "Andere sessies van jouw superadminaccount afmelden? Je huidige sessie blijft open. Haar eigenaarsaccount wordt niet gewijzigd.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await request("workspace", { action: "revoke-sessions" });
      setMessage(
        "Andere superadminsessies zijn afgemeld. Je huidige sessie blijft actief.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sa-access">
      <div className="sa-operations-intro">
        <ShieldCheck size={28} />
        <div>
          <h2>Jouw persoonlijke beheertoegang</h2>
          <p>
            Je logt in met e-mailadres en wachtwoord. De authenticator is op
            jouw verzoek verwijderd. De server controleert daarnaast je
            beheerrol en actieve toegangsregistratie.
          </p>
        </div>
      </div>
      {loading && <p role="status">Account controleren…</p>}
      {error && (
        <p className="sa-error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <dl className="sa-detail-values">
          <div>
            <dt>Account</dt>
            <dd>{data.email}</dd>
          </div>
          <div>
            <dt>Loginmethode</dt>
            <dd>E-mailadres en wachtwoord</dd>
          </div>
          <div>
            <dt>Sessie</dt>
            <dd>Afzonderlijke HTTP-only cookie</dd>
          </div>
          <div>
            <dt>Laatste aanmelding</dt>
            <dd>
              {data.lastSignIn ? dateTime(data.lastSignIn) : "Niet bekend"}
            </dd>
          </div>
          <div>
            <dt>Account aangemaakt</dt>
            <dd>{data.createdAt ? dateTime(data.createdAt) : "Niet bekend"}</dd>
          </div>
        </dl>
      )}
      <div className="sa-access-checks">
        <p>
          <Check size={16} />
          Haar eigenaarsaccount krijgt geen toegang tot superadmin.
        </p>
        <p>
          <Check size={16} />
          Je superadmincookie geeft geen toegang tot haar eigenaarsessie.
        </p>
        <p>
          <Check size={16} />
          Wijzigingen aan objectrechten, producten en taken worden
          geregistreerd.
        </p>
      </div>
      <button
        className="sa-secondary"
        disabled={busy}
        onClick={() => void revoke()}
      >
        <LogOut size={16} />
        {busy ? "Afmelden…" : "Andere superadminsessies afmelden"}
      </button>
      {message && (
        <p className="sa-info" role="status">
          {message}
        </p>
      )}
      <section className="sa-section">
        <h2>Actieve beheerders</h2>
        <ul className="sa-plain-list">
          {report.pulse?.operators.map((operator) => (
            <li key={operator.email}>
              <strong>{operator.email}</strong>
              <span>
                {operator.enabled ? "Toegang actief" : "Toegang ingetrokken"}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="sa-section">
        <h2>Wat deze omgeving vastlegt</h2>
        <p>
          Opgeslagen productwijzigingen, publicaties, uploads, succesvolle
          aanmeldingen en belangrijke beheeracties. Geen schermopnames,
          muisbewegingen of toetsaanslagen. Het logboek toont wat werkelijk is
          opgeslagen.
        </p>
        <p className="sa-muted">
          Productversies blijven 90 dagen beschikbaar, het activiteitenlog één
          jaar en handmatige onderhoudsresultaten 30 dagen. Volledige back-ups
          bevatten geen Auth-wachtwoorden.
        </p>
      </section>
    </section>
  );
}
