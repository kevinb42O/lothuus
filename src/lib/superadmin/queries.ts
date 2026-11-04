import { BusinessError } from "../backend/service";
export function activityInput(p: URLSearchParams) {
  const q = p.get("q") || "",
    kind = p.get("kind") || "all",
    who = p.get("who") || "all",
    before = p.get("before");
  const since = p.get("since"),
    until = p.get("until");
  if (
    q.length > 120 ||
    !["all", "product", "access", "capacity", "payment", "operator"].includes(
      kind,
    ) ||
    !["all", "owner", "operator", "system"].includes(who) ||
    (before && !/^[1-9]\d{0,17}$/.test(before)) ||
    (since && !Number.isFinite(Date.parse(since))) ||
    (until && !Number.isFinite(Date.parse(until)))
  )
    throw new BusinessError("Controleer de filters voor activiteiten.");
  if (since && until && Date.parse(since) >= Date.parse(until))
    throw new BusinessError(
      "Het begin van de periode moet vóór het einde liggen.",
    );
  return {
    search_text: q,
    event_filter: kind,
    actor_filter: who,
    since_at: since || null,
    until_at: until || null,
    before_id: before || null,
  };
}
