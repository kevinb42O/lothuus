"use client";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import { PLANS, type HostingPlan } from "@/lib/hosting/catalogue";
import { dateTime } from "@/lib/backend/types";
import type { OperatorReport, PackageState } from "@/lib/superadmin/types";
import { addCalendarMonths } from "@/lib/hosting/terms";
import { request, useData, useUnsavedGuard } from "./client";
export function PackageActivation({
  report,
  onChanged,
}: {
  report: OperatorReport;
  onChanged: () => void;
}) {
  const { data, error, loading, reload } = useData<PackageState>(
    "data?view=package-state",
  );
  const [plan, setPlan] = useState<HostingPlan>("pro"),
    [term, setTerm] = useState("1"),
    [date, setDate] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const retryKey = useRef<{
    signature: string;
    id: string;
    validUntil: string | null;
  } | null>(null);
  useUnsavedGuard(reason.length > 0);
  function until() {
    if (plan === "basis") return null;
    if (term === "custom")
      return date ? new Date(`${date}T23:59:59`).toISOString() : null;
    return addCalendarMonths(new Date(), Number(term)).toISOString();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!data) return;
    setMessage("");
    let validUntil: string | null;
    try {
      validUntil = until();
    } catch {
      setMessage("Kies een geldige einddatum.");
      return;
    }
    if (
      plan !== "basis" &&
      (!validUntil || Date.parse(validUntil) <= Date.now())
    ) {
      setMessage("Kies een einddatum in de toekomst.");
      return;
    }
    if (
      !window.confirm(
        `${PLANS[plan].name} instellen${validUntil ? ` tot ${dateTime(validUntil)}` : ""}? Dit vervangt het huidige pakketrecht, behoudt alle producten en registreert geen ontvangen betaling.`,
      )
    )
      return;
    const input = {
      action: "grant-package",
      plan,
      validUntil,
      expectedUpdatedAt: data.account.updatedAt,
      reason,
      provisioned: plan === "basis" || confirmed,
    };
    // Reuse the exact request after an uncertain network outcome. Fresh edits get a new key.
    const signature = JSON.stringify({
      ...input,
      validUntil: term === "custom" ? validUntil : term,
    });
    if (retryKey.current?.signature !== signature)
      retryKey.current = { signature, id: crypto.randomUUID(), validUntil };
    input.validUntil = retryKey.current.validUntil;
    setBusy(true);
    try {
      await request("manage", { ...input, key: retryKey.current.id });
      setMessage(
        `${PLANS[plan].name} is toegekend. De eigenaar kan een open werkruimte vernieuwen om het pakket te zien. De bestaande collectie is behouden. Er is geen betaling als ontvangen geboekt.`,
      );
      setReason("");
      setConfirmed(false);
      retryKey.current = null;
      reload();
      onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sa-package-activation">
      <div className="sa-section-heading">
        <div>
          <h2>Een pakket activeren</h2>
          <p className="sa-muted">
            Kies het pakket en de looptijd. Een bestelling vooraf is niet nodig.
          </p>
        </div>
        <button
          className="sa-secondary"
          disabled={busy || loading}
          onClick={reload}
        >
          Rechten vernieuwen
        </button>
      </div>
      {loading ? (
        <p role="status">Actuele pakketrechten controleren…</p>
      ) : error ? (
        <p className="sa-error" role="alert">
          {error}
        </p>
      ) : (
        data && (
          <>
            <div className="sa-current-package">
              <span>Nu actief</span>
              <strong>
                {report.hosting
                  ? PLANS[report.hosting.plan].name
                  : PLANS[
                      data.account.validUntil &&
                      Date.parse(data.account.validUntil) <= Date.now()
                        ? "basis"
                        : data.account.plan
                    ].name}
              </strong>
              <span>
                {data.account.validUntil
                  ? `Tot ${dateTime(data.account.validUntil)}`
                  : "Geen betaalde looptijd"}
              </span>
            </div>
            {!report.policy.enforced && (
              <p className="sa-info">
                De objectlimiet staat momenteel uit. Een pakket activeren zet
                die niet opnieuw aan. Je kunt dit aanpassen bij Pakket &
                rechten.
              </p>
            )}
            {report.settings.object_limit !== null &&
              (!report.settings.expires_at ||
                Date.parse(report.settings.expires_at) > Date.now()) && (
                <p className="sa-info">
                  Er geldt momenteel een afwijkende objectlimiet van{" "}
                  {report.settings.object_limit}. Die blijft behouden; pas ze zo
                  nodig aan bij Pakket & rechten.
                </p>
              )}
            <form onSubmit={submit}>
              <div
                className="sa-plan-picker"
                role="group"
                aria-label="Pakket kiezen"
              >
                {(["basis", "pro", "premium"] as HostingPlan[]).map((key) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={plan === key}
                    onClick={() => {
                      setPlan(key);
                      setConfirmed(false);
                      retryKey.current = null;
                    }}
                  >
                    <span>{PLANS[key].name}</span>
                    <strong>
                      {PLANS[key].objects.toLocaleString("nl-BE")} objecten
                    </strong>
                    <small>
                      {key === "basis"
                        ? "Gratis basispakket"
                        : key === "pro"
                          ? "Beheer en ondersteuning"
                          : "Grote collectie en prioriteit"}
                    </small>
                    {plan === key && <Check size={18} />}
                  </button>
                ))}
              </div>
              {plan !== "basis" && (
                <div className="sa-form-columns">
                  <label>
                    Looptijd
                    <select
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                    >
                      <option value="1">1 maand vanaf nu</option>
                      <option value="3">3 maanden vanaf nu</option>
                      <option value="12">1 jaar vanaf nu</option>
                      <option value="custom">Zelf een einddatum kiezen</option>
                    </select>
                  </label>
                  {term === "custom" && (
                    <label>
                      Geldig tot
                      <input
                        type="date"
                        required
                        value={date}
                        min={new Date().toLocaleDateString("sv-SE")}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </label>
                  )}
                </div>
              )}
              <label>
                Reden of afspraak
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  placeholder="Bijvoorbeeld: afgesproken Pro-periode, tijdelijke proef of handmatig verwerkte overeenkomst."
                />
              </label>
              {plan !== "basis" && (
                <label className="sa-check">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    required
                  />
                  De afgesproken infrastructuur en diensten zijn beschikbaar.
                </label>
              )}
              <p className="sa-info">
                Deze actie kent pakketrechten toe en vervangt de huidige
                looptijd. Ze bevestigt geen bankbetaling. Gebruik bij een echte
                pakketbestelling de ontvangstcontrole hieronder, zodat betaling
                en activering gekoppeld blijven.
              </p>
              <button
                className="sa-primary"
                disabled={
                  busy ||
                  reason.trim().length < 3 ||
                  (plan !== "basis" && !confirmed)
                }
              >
                {busy ? "Activeren…" : `${PLANS[plan].name} activeren`}
                <ArrowRight size={16} />
              </button>
              {message && (
                <p className="sa-info sa-more" role="status">
                  {message}
                </p>
              )}
            </form>
            {data.grants.length > 0 && (
              <details className="sa-section">
                <summary>
                  Eerder handmatig toegekende pakketten ({data.grants.length})
                </summary>
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Toegekend op</th>
                        <th>Pakket</th>
                        <th>Einddatum</th>
                        <th>Reden</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.grants.map((grant) => (
                        <tr key={grant.id}>
                          <td>{dateTime(grant.created_at)}</td>
                          <td>{PLANS[grant.plan].name}</td>
                          <td>
                            {grant.ends_at ? dateTime(grant.ends_at) : "Geen"}
                          </td>
                          <td>{grant.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )
      )}
    </section>
  );
}
