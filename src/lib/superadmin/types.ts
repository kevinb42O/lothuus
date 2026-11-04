import type { HostingReport } from '../hosting/catalogue';
export type OperatorSession = { authenticated: boolean; verified?: boolean; email?: string; factorId?: string | null };
export type Activity = { id: string; at: string; actor: string; kind: string; object_id: string | null; title: string; details: { fields?: string[]; number?: string; reason?: string; before?: unknown; after?: unknown } };
export type OperatorReport = {
 policy: { count: number; limit: number; enforced: boolean };
 settings: { enforce_limit: boolean; object_limit: number | null; expires_at: string | null; version: number; updated_at: string };
 activity: Activity[]; hosting: HostingReport | null; technicalError: string | null; pulse?:OperatorPulse|null; jobs?:OperatorJob[]; fetchedAt?:string;
};
export const activityLabels: Record<string, string> = {
 workspace_open:"Werkruimte opnieuw geopend",
 product_restored:'Productinhoud hersteld',product_status_changed:'Productstatus door beheer gewijzigd',note_changed:'Interne taak gewijzigd',maintenance_requested:'Onderhoud aangevraagd',export_created:'Export gemaakt',sessions_revoked:'Andere sessies afgemeld',product_created: 'Product toegevoegd', product_updated: 'Product gewijzigd', product_published: 'Product gepubliceerd', product_unpublished: 'Terug naar concept', product_archived: 'Product gearchiveerd', product_removed: 'Product verwijderd',
 owner_login: 'Eigenaar aangemeld', superadmin_login: 'Superadmin aangemeld', photo_uploaded: 'Foto geüpload', capacity_denied: 'Toevoeging geweigerd', policy_changed: 'Objectrechten gewijzigd', package_granted:'Pakket handmatig toegekend',payment_activated: 'Pakket geactiveerd', website_settings_updated: 'Website-instellingen gewijzigd',
};
export const fieldLabels: Record<string, string> = { title:'Titel',description:'Beschrijving',priceCents:'Prijs',priceUnset:'Prijsstatus',publication:'Publicatie',photos:'Foto’s',materialGroup:'Materiaalgroep',productNumber:'Productnummer',date:'Periode',dimensions:'Afmetingen',condition:'Staat',maker:'Maker',material:'Materiaal',category:'Categorie',editorReady:'Volledigheid' };

export type InventoryItem = { id: string; title: string; number: string | null; publication: string; stock: string; priceCents: number; priceUnset?: boolean; photoId: string | null; photoCount: number; missing: string[]; updatedAt: string; version: number };
export type InventoryReport = { items: InventoryItem[]; total: number; offset: number; counts: Record<string, number> };
export type ProductVersion = { id: string; item_version: number; captured_at: string };
export type ProductReport = { item: import('../backend/types').Item; stock: string; missing: string[]; versions: ProductVersion[] };
export type OperatorNote = { id: string; title: string; body: string; status: 'open'|'doing'|'done'|'archived'; priority: 'normal'|'high'; item_id: string|null; due_at: string|null; version: number; updated_at: string; created_at: string };
export type OperatorJob = { id: string; kind: 'backup'|'measurements'; status: 'queued'|'running'|'succeeded'|'partial'|'skipped'|'error'; created_at: string; finished_at: string|null; message: string };
export type OperatorPulse = {
 collection: Record<string,number>; sales: { active: number; completed: number; netReceived: number; overdue: number };
 lastOwnerActivity: string|null; trackingSince: string|null;
 daily: { day: string; events: number; products: number }[];
 work: { open: number; high: number; overdue: number };
 operators: { email: string; enabled: boolean; createdAt: string }[];
};

export type UsageReport={days:number;recordingSince:string|null;lastInteraction:string|null;totals:{actions:number;hostingOpens:number;usageViews:number;usageRefreshes:number;plansViews:number;planClicks:number;paymentOpens:number;orderClicks:number;paymentClaims:number};top:{action:string;hits:number}[];products:{product:string;clicks:number|null;opens:number|null;orders:number|null;claims:number|null}[];daily:{day:string;clicks:number|null;packages:number|null;usage:number|null}[];events:{id:string;at:string;action:string;section:string;product:string}[]};
export type PackageState={account:{plan:import('../hosting/catalogue').HostingPlan;validUntil:string|null;updatedAt:string};grants:{id:string;plan:import('../hosting/catalogue').HostingPlan;starts_at:string;ends_at:string|null;reason:string;created_at:string}[]};
