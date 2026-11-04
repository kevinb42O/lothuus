import type { HostingReport } from '../hosting/catalogue';
export type OperatorSession = { authenticated: boolean; verified?: boolean; email?: string; factorId?: string | null };
export type Activity = { id: string; at: string; actor: string; kind: string; object_id: string | null; title: string; details: { fields?: string[]; number?: string; reason?: string; before?: unknown; after?: unknown } };
export type OperatorReport = {
 policy: { count: number; limit: number; enforced: boolean };
 settings: { enforce_limit: boolean; object_limit: number | null; expires_at: string | null; version: number; updated_at: string };
 activity: Activity[]; hosting: HostingReport | null; technicalError: string | null;
};
export const activityLabels: Record<string, string> = {
 product_created: 'Product toegevoegd', product_updated: 'Product gewijzigd', product_published: 'Product gepubliceerd', product_unpublished: 'Terug naar concept', product_archived: 'Product gearchiveerd', product_removed: 'Product verwijderd',
 owner_login: 'Eigenaar aangemeld', superadmin_login: 'Superadmin aangemeld', photo_uploaded: 'Foto geüpload', capacity_denied: 'Toevoeging geweigerd', policy_changed: 'Objectrechten gewijzigd', payment_activated: 'Pakket geactiveerd', website_settings_updated: 'Website-instellingen gewijzigd',
};
export const fieldLabels: Record<string, string> = { title:'Titel',description:'Beschrijving',priceCents:'Prijs',priceUnset:'Prijsstatus',publication:'Publicatie',photos:'Foto’s',materialGroup:'Materiaalgroep',productNumber:'Productnummer',date:'Periode',dimensions:'Afmetingen',condition:'Staat',maker:'Maker',material:'Materiaal',category:'Categorie',editorReady:'Volledigheid' };
