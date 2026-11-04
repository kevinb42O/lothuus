"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImageOff,
  Search,
  RotateCcw,
  ExternalLink,
  Download,
  Check,
} from "lucide-react";
import { Dialog } from "../dialog";
import { dateTime, money, type Item } from "@/lib/backend/types";
import {
  fieldLabels,
  type InventoryReport,
  type ProductReport,
} from "@/lib/superadmin/types";
import { request, useData, exportData, useUnsavedGuard } from "./client";
export const publicationLabel: Record<string, string> = {
  draft: "Concept",
  published: "Gepubliceerd",
  archived: "Archief",
};
export const stockLabel: Record<string, string> = {
  available: "Beschikbaar",
  reserved: "Gereserveerd",
  sold: "Verkocht",
};
export const qualityLabels: Record<string, string> = {
  ...fieldLabels,
  price: "Prijs",
  photos: "Foto’s",
  materialGroup: "Materiaalgroep",
};
const restorable = [
  "title",
  "description",
  "date",
  "dimensions",
  "condition",
  "maker",
  "material",
  "category",
  "priceCents",
  "priceUnset",
] as const;
export function Collection({
  initialFilter = "all",
  initialId,
  onChanged,
}: {
  initialFilter?: string;
  initialId?: string | null;
  onChanged: () => void;
}) {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(initialFilter),
    [sort, setSort] = useState("recent"),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<string | null>(initialId || null),
    [notice, setNotice] = useState(""),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  const params = new URLSearchParams({
      view: "inventory",
      q: search,
      filter,
      sort,
      offset: String(offset),
    }),
    { data, error, loading, reload } = useData<InventoryReport>(
      `data?${params}`,
    );
  const filters = [
    ["all", "Alle producten"],
    ["published", "Gepubliceerd"],
    ["draft", "Concepten"],
    ["incomplete", "Aanvullen"],
    ["price", "Zonder prijs"],
    ["photos", "Fotocontrole"],
    ["reserved", "Gereserveerd"],
    ["sold", "Verkocht"],
    ["archived", "Archief"],
  ];
  return (
    <>
      <div className="sa-work-toolbar">
        <label className="sa-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Zoek collectie"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={120}
            placeholder="Zoek op titel of productnummer"
          />
        </label>
        <label>
          <span className="sa-sr-only">Collectie filteren</span>
          <select
            aria-label="Collectie filteren"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setOffset(0);
            }}
          >
            {filters.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
                {data?.counts[value] !== undefined
                  ? ` (${data.counts[value]})`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sa-sr-only">Collectie sorteren</span>
          <select
            aria-label="Collectie sorteren"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setOffset(0);
            }}
          >
            <option value="recent">Recent gewijzigd</option>
            <option value="title">Titel A–Z</option>
            <option value="price">Prijs oplopend</option>
          </select>
        </label>
        <button
          className="sa-secondary"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            setNotice("");
            try {
              const result = await exportData("collection");
              setNotice(
                `${result.count} van ${result.total} producten geëxporteerd. Een download bevat maximaal 5.000 producten en 3 MB.`,
              );
            } catch (e) {
              setNotice((e as Error).message);
            } finally {
              setExporting(false);
            }
          }}
        >
          <Download size={16} />
          {exporting ? "Exporteren…" : "Collectie exporteren"}
        </button>
      </div>
      {notice && (
        <p role="status" className="sa-info">
          {notice}
        </p>
      )}
      {error && (
        <p className="sa-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Collectie laden…</p>
      ) : (
        data && (
          <>
            <p className="sa-muted">
              {data.total} resultaten · de lijst toont maximaal 40 producten per
              pagina.
            </p>
            {!data.items.length ? (
              <div className="sa-empty">
                <h2>Geen producten gevonden</h2>
                <p>Pas je zoekopdracht of filter aan.</p>
              </div>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table sa-inventory">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Publicatie & voorraad</th>
                      <th>Prijs</th>
                      <th>Fichecontrole</th>
                      <th>Bijgewerkt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <button
                            className="sa-product-link"
                            onClick={() => setSelected(item.id)}
                          >
                            {item.photoId ? (
                              <img
                                src={`/api/superadmin/image?id=${encodeURIComponent(item.photoId)}`}
                                alt=""
                                width={48}
                                height={48}
                                loading="lazy"
                              />
                            ) : (
                              <span className="sa-product-placeholder">
                                <ImageOff size={18} />
                              </span>
                            )}
                            <span>
                              <strong>
                                {item.title || "Nog zonder titel"}
                              </strong>
                              <small>{item.number || "Nog geen nummer"}</small>
                            </span>
                          </button>
                        </td>
                        <td>
                          <span>
                            {publicationLabel[item.publication] ||
                              item.publication}
                          </span>
                          <small>{stockLabel[item.stock] || item.stock}</small>
                        </td>
                        <td>
                          {item.priceUnset || item.priceCents <= 0
                            ? "Nog geen prijs"
                            : money(item.priceCents)}
                        </td>
                        <td>
                          {item.missing.length ? (
                            <span className="sa-quality">
                              {item.missing.length} onderdelen ontbreken
                              <small>
                                {item.missing
                                  .map((field) => qualityLabels[field] || field)
                                  .join(", ")}
                              </small>
                            </span>
                          ) : (
                            <span className="sa-ok">
                              <Check size={14} />
                              Volledig
                            </span>
                          )}
                        </td>
                        <td>
                          <small>{dateTime(item.updatedAt)}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="sa-pagination">
              <button
                className="sa-secondary"
                disabled={offset === 0}
                onClick={() => setOffset((n) => Math.max(0, n - 40))}
              >
                <ArrowLeft size={16} />
                Vorige
              </button>
              <span>
                {data.total ? offset + 1 : 0}–
                {Math.min(offset + 40, data.total)} van {data.total}
              </span>
              <button
                className="sa-secondary"
                disabled={offset + 40 >= data.total}
                onClick={() => setOffset((n) => n + 40)}
              >
                Volgende
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )
      )}
      {selected && (
        <ProductDetail
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            reload();
            onChanged();
          }}
        />
      )}
    </>
  );
}
function ProductDetail({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, error, loading, reload } = useData<ProductReport>(
      `data?view=product&id=${id}`,
    ),
    [version, setVersion] = useState(""),
    [past, setPast] = useState<Item | null>(null),
    [fields, setFields] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [versionError, setVersionError] = useState("");
  useEffect(() => {
    let active = true;
    setPast(null);
    setFields([]);
    setVersionError("");
    if (version)
      void request<Item>(`data?view=version&id=${id}&version=${version}`)
        .then((item) => {
          if (active) {
            setPast(item);
            setFields(
              restorable.filter(
                (field) =>
                  JSON.stringify(item[field]) !==
                    JSON.stringify(data?.item[field]) &&
                  !["priceCents", "priceUnset"].includes(field),
              ),
            );
          }
        })
        .catch((e) => {
          if (active) setVersionError((e as Error).message);
        });
    return () => {
      active = false;
    };
  }, [version, id, data?.item]);
  useUnsavedGuard(reason.trim().length > 0);
  async function restore(event: FormEvent) {
    event.preventDefault();
    if (!data || !past || !fields.length) return;
    if (
      !window.confirm(
        `${fields.length} velden herstellen uit deze versie? De huidige toestand blijft als versie bewaard. Foto’s, productnummers en verkoopgeschiedenis veranderen niet.`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await request("workspace", {
        action: "restore",
        itemId: id,
        versionId: version,
        expectedVersion: data.item.version,
        fields,
        reason,
      });
      setMessage("De geselecteerde velden zijn hersteld.");
      setVersion("");
      setReason("");
      reload();
      onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publication(value: string) {
    if (!data || reason.trim().length < 3) {
      setMessage("Vul eerst een reden in.");
      return;
    }
    if (!window.confirm(`Product wijzigen naar ${publicationLabel[value]}?`))
      return;
    setBusy(true);
    setMessage("");
    try {
      await request("workspace", {
        action: "publication",
        itemId: id,
        expectedVersion: data.item.version,
        publication: value,
        reason,
      });
      setMessage("De productstatus is gewijzigd en geregistreerd.");
      reload();
      onChanged();
      setReason("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Productcontrole en versiegeschiedenis"
      className="sa-detail"
      onClose={() => {
        if (
          !reason.trim() ||
          window.confirm(
            "Je hebt nog niet opgeslagen invoer. Productcontrole sluiten?",
          )
        )
          onClose();
      }}
    >
      <h2>Productcontrole</h2>
      {loading && <p role="status">Fiche laden…</p>}
      {error && (
        <p className="sa-error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="sa-detail-head">
            <div>
              <span className="sa-muted">
                {data.item.productNumber ||
                  data.item.sourceReference ||
                  "Zonder nummer"}
              </span>
              <h3>{data.item.title || "Nog zonder titel"}</h3>
              <p>
                {publicationLabel[data.item.publication]} ·{" "}
                {stockLabel[data.stock]} · versie {data.item.version}
              </p>
            </div>
            <a
              className="sa-secondary"
              href="/"
              target="_blank"
              rel="noreferrer"
            >
              Website
              <ExternalLink size={15} />
            </a>
          </div>
          <div className="sa-detail-grid">
            <div>
              <div className="sa-photo-strip">
                {data.item.photos.map((photo) => (
                  <img
                    key={photo.id}
                    src={`/api/superadmin/image?id=${encodeURIComponent(photo.id)}&size=detail`}
                    alt={photo.alt || data.item.title}
                    loading="lazy"
                  />
                ))}
              </div>
              <p className="sa-description">
                {data.item.description || "Nog geen beschrijving"}
              </p>
              <dl className="sa-detail-values">
                <div>
                  <dt>Prijs</dt>
                  <dd>
                    {data.item.priceUnset
                      ? "Nog niet ingevuld"
                      : money(data.item.priceCents)}
                  </dd>
                </div>
                {[
                  ["date", "Stijl / periode"],
                  ["dimensions", "Afmetingen"],
                  ["condition", "Staat"],
                  ["maker", "Maker / merk"],
                ].map(([field, label]) => (
                  <div key={field}>
                    <dt>{label}</dt>
                    <dd>
                      {String(
                        data.item[field as keyof Item] || "Nog niet ingevuld",
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {data.missing.length > 0 && (
                <p className="sa-info">
                  Nog aan te vullen:{" "}
                  {data.missing.map((field) => qualityLabels[field]).join(", ")}
                  .
                </p>
              )}
            </div>
            <section>
              <h3>Versiegeschiedenis</h3>
              <p className="sa-muted">
                De huidige toestand is bij installatie vastgelegd. Nieuwe
                versies blijven maximaal 90 dagen bewaard, tot 50 per product.
                Je herstelt alleen de velden die je kiest.
              </p>
              <label>
                Kies een versie
                <select
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Vergelijk een eerdere versie</option>
                  {data.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      Versie {v.item_version} · {dateTime(v.captured_at)}
                    </option>
                  ))}
                </select>
              </label>
              {versionError && (
                <p role="alert" className="sa-error">
                  {versionError}
                </p>
              )}
              {past && (
                <form onSubmit={restore}>
                  <div className="sa-diff-list">
                    {restorable
                      .filter(
                        (field) =>
                          JSON.stringify(past[field]) !==
                          JSON.stringify(data.item[field]),
                      )
                      .map((field) => (
                        <label className="sa-diff" key={field}>
                          <span className="sa-check">
                            <input
                              type="checkbox"
                              checked={fields.includes(field)}
                              onChange={(e) =>
                                setFields((current) =>
                                  e.target.checked
                                    ? [...current, field]
                                    : current.filter((f) => f !== field),
                                )
                              }
                            />
                            {fieldLabels[field] || field}
                          </span>
                          <span>
                            <small>Nu</small>
                            {String(data.item[field] ?? "Leeg")}
                          </span>
                          <span>
                            <small>Deze versie</small>
                            {String(past[field] ?? "Leeg")}
                          </span>
                        </label>
                      ))}
                  </div>
                  {!restorable.some(
                    (field) =>
                      JSON.stringify(past[field]) !==
                      JSON.stringify(data.item[field]),
                  ) && <p>Deze velden zijn gelijk aan de huidige fiche.</p>}
                  <label>
                    Reden van herstel
                    <textarea
                      required
                      minLength={3}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                    />
                  </label>
                  <p className="sa-muted">
                    Prijswijzigingen bij gereserveerde of verkochte producten
                    blijven geblokkeerd.
                  </p>
                  <button
                    className="sa-primary"
                    disabled={busy || !fields.length}
                  >
                    <RotateCcw size={16} />
                    {busy ? "Herstellen…" : "Geselecteerde velden herstellen"}
                  </button>
                </form>
              )}
              {!past && (
                <div className="sa-status-controls">
                  <h3>Publicatie beheren</h3>
                  <label>
                    Reden
                    <textarea
                      minLength={3}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                    />
                  </label>
                  <div className="sa-button-row">
                    {["draft", "published", "archived"]
                      .filter((value) => value !== data.item.publication)
                      .map((value) => (
                        <button
                          className="sa-secondary"
                          disabled={busy || reason.trim().length < 3}
                          key={value}
                          onClick={() => void publication(value)}
                        >
                          {publicationLabel[value]}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              {message && (
                <p className="sa-info" role="status">
                  {message}
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </Dialog>
  );
}
