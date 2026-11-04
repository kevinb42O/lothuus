// A fixed action catalogue: no button text, form values, URLs or credentials.
export const usageActions = {
  nav_overview: "Overzicht openen",
  nav_items: "Producten openen",
  nav_reservations: "Bestellingen openen",
  nav_customers: "Klanten openen",
  nav_emails: "E-mailuitbox openen",
  nav_settings: "Instellingen openen",
  nav_hearts: "Hartjes openen",
  nav_hosting: "Hosting & capaciteit openen",
  nav_visitors: "Bezoekers openen",
  nav_updates: "Updates openen",
  product_add: "Product toevoegen proberen",
  product_open: "Productfiche openen",
  capacity_plans: "Pakketten openen vanuit limietmelding",
  usage_view: "Verbruik daadwerkelijk in beeld",
  plans_view: "Pakketten daadwerkelijk in beeld",
  usage_refresh: "Verbruik vernieuwen",
  usage_details: "Verbruiksdetails openen",
  plan_pro: "Pro-pakket aanklikken",
  plan_business: "Business-pakket aanklikken",
  payment_capacity: "Extra objectcapaciteit kiezen",
  billing_month: "Maandprijzen bekijken",
  billing_year: "Jaarprijzen bekijken",
  payment_open: "Betaalvenster openen",
  payment_close: "Betaalvenster sluiten",
  payment_order: "Bestelling vastleggen aanklikken",
  payment_paid: "Betaling melden aanklikken",
  payment_iban: "Rekeningnummer kopiëren",
  payment_details: "Betaalgegevens heropenen",
  payment_cancel: "Bestelling annuleren aanklikken",
  faq_maintenance: "FAQ onderhoud openen",
  faq_backup: "FAQ reservekopieën openen",
  faq_free: "FAQ Free openen",
  faq_availability: "FAQ bereikbaarheid openen",
} as const;
export type UsageAction = keyof typeof usageActions;
export const usageSections = [
  "overview",
  "items",
  "reservations",
  "customers",
  "emails",
  "settings",
  "hearts",
  "hosting",
  "visitors",
  "updates",
] as const;
export type UsageSection = (typeof usageSections)[number];
export type UsageEvent = {
  id: string;
  action: UsageAction;
  section: UsageSection;
  product?:
    | "pro_month"
    | "pro_year"
    | "premium_month"
    | "premium_year"
    | "extra50"
    | "extra150";
};
export function usageCategory(
  action: string,
): "packages" | "usage" | "workspace" {
  if (
    action.startsWith("plan_") ||
    action.startsWith("billing_") ||
    action.startsWith("payment_") ||
    action === "plans_view" ||
    action === "capacity_plans"
  )
    return "packages";
  if (action.startsWith("usage_") || action === "nav_hosting") return "usage";
  return "workspace";
}
