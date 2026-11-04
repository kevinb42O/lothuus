"use client";
import { useState, type FormEvent } from "react";
import { Plus, Check, Clock3, Flag } from "lucide-react";
import { dateTime } from "@/lib/backend/types";
import type { OperatorNote } from "@/lib/superadmin/types";
import { request, useData, useUnsavedGuard } from "./client";
const labels = {
  open: "Open",
  doing: "In uitvoering",
  done: "Afgerond",
  archived: "Gearchiveerd",
};
export function WorkDesk({ onChanged }: { onChanged: () => void }) {
  const [filter, setFilter] = useState("active"),
    [editing, setEditing] = useState<OperatorNote | "new" | null>(null),
    [notice, setNotice] = useState("");
  const { data, error, loading, reload } = useData<{ notes: OperatorNote[] }>(
    `data?view=work&filter=${filter}`,
  );
  return (
    <section>
      <div className="sa-section-heading">
        <div>
          <h2>Jouw afspraken, taken en notities</h2>
          <p className="sa-muted">
            Alleen zichtbaar in jouw superadmin. Er worden geen berichten naar
            de eigenaar verstuurd.
          </p>
        </div>
        <button
          className="sa-primary"
          onClick={() => {
            if (
              window.dispatchEvent(
                new window.Event("operator-before-navigate", {
                  cancelable: true,
                }),
              )
            )
              setEditing("new");
          }}
        >
          <Plus size={16} />
          Nieuwe taak of notitie
        </button>
      </div>
      <div className="sa-filter-tabs" role="group" aria-label="Takenfilter">
        {[
          ["active", "Open & in uitvoering"],
          ["done", "Afgerond"],
          ["archived", "Archief"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p className="sa-info" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="sa-error" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <NoteForm
          key={editing === "new" ? "new" : `${editing.id}-${editing.version}`}
          note={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            onChanged();
            setNotice("De taak is opgeslagen in je interne werkruimte.");
          }}
        />
      )}
      {loading ? (
        <p role="status">Taken laden…</p>
      ) : data && !data.notes.length ? (
        <div className="sa-empty">
          <h3>
            {filter === "active"
              ? "Je werkblad is leeg"
              : "Geen taken in deze weergave"}
          </h3>
          <p>Leg een afspraak, verbeterpunt of technische opvolging vast.</p>
        </div>
      ) : (
        <div className="sa-notes">
          {data?.notes.map((note) => (
            <button
              key={note.id}
              className="sa-note"
              onClick={() => {
                if (
                  window.dispatchEvent(
                    new window.Event("operator-before-navigate", {
                      cancelable: true,
                    }),
                  )
                )
                  setEditing(note);
              }}
            >
              <span className="sa-note-status">
                {note.status === "done" ? (
                  <Check size={18} />
                ) : note.priority === "high" ? (
                  <Flag size={18} />
                ) : (
                  <Clock3 size={18} />
                )}
              </span>
              <span>
                <strong>{note.title}</strong>
                <span className="sa-note-body">
                  {note.body || "Geen aanvullende notitie."}
                </span>
                <small>
                  {labels[note.status]}
                  {note.priority === "high" ? " · Prioriteit" : ""}
                  {note.due_at ? ` · Tegen ${dateTime(note.due_at)}` : ""}
                  {note.due_at &&
                  Date.parse(note.due_at) < Date.now() &&
                  ["open", "doing"].includes(note.status)
                    ? " · Termijn verstreken"
                    : ""}
                </small>
              </span>
              <span className="sa-muted">Openen</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function NoteForm({
  note,
  onCancel,
  onSaved,
}: {
  note?: OperatorNote;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      due = String(form.get("due") || "");
    setBusy(true);
    setError("");
    try {
      await request("workspace", {
        action: "note",
        id: note?.id || crypto.randomUUID(),
        version: note?.version || 0,
        title: form.get("title"),
        body: form.get("body"),
        status: form.get("status"),
        priority: form.get("priority"),
        itemId: note?.item_id || null,
        dueAt: due ? new Date(`${due}T17:00:00`).toISOString() : null,
      });
      setDirty(false);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="sa-note-form"
      onSubmit={submit}
      onChange={() => setDirty(true)}
    >
      <h3>{note ? "Taak of notitie bewerken" : "Nieuwe taak of notitie"}</h3>
      <label>
        Titel
        <input
          name="title"
          defaultValue={note?.title || ""}
          required
          maxLength={180}
        />
      </label>
      <label>
        Interne notitie
        <textarea
          name="body"
          defaultValue={note?.body || ""}
          maxLength={6000}
          rows={4}
        />
      </label>
      <div className="sa-form-columns">
        <label>
          Status
          <select name="status" defaultValue={note?.status || "open"}>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioriteit
          <select name="priority" defaultValue={note?.priority || "normal"}>
            <option value="normal">Normaal</option>
            <option value="high">Hoog</option>
          </select>
        </label>
        <label>
          Uiterlijk op
          <input
            type="date"
            name="due"
            defaultValue={
              note?.due_at
                ? new Date(note.due_at).toLocaleDateString("sv-SE")
                : ""
            }
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="sa-error">
          {error}
        </p>
      )}
      <div className="sa-button-row">
        <button className="sa-primary" disabled={busy}>
          {busy ? "Opslaan…" : "Taak opslaan"}
        </button>
        <button
          type="button"
          className="sa-secondary"
          disabled={busy}
          onClick={() => {
            if (
              !dirty ||
              window.confirm("Deze nog niet opgeslagen notitie sluiten?")
            )
              onCancel();
          }}
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
