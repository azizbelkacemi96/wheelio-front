/**
 * Billing fixtures typed against types/billing.ts. Used by the MSW handlers
 * and the billing screen tests.
 */
import type {
  CreditNoteResponse,
  InvoiceResponse,
  OrgFiscalIdentityResponse,
} from "@/types/billing";
import { ownerFixture } from "./scope";
import { activeContractFixture } from "./fleet";

const now = "2026-07-30T10:00:00.000Z";

export const invoiceIssuedFixture: InvoiceResponse = {
  id: "40404040-4040-4404-8404-404040404040",
  number: "FACT-2026-000001",
  status: "issued",
  issued_at: now,
  contract_id: activeContractFixture.id,
  customer_id: activeContractFixture.customer_id,
  total_ht_cents: 500000,
  total_vat_cents: 95000,
  total_ttc_cents: 595000,
  total_in_words: "cinq mille neuf cent cinquante dinars algériens",
  lines: [
    {
      description: "Location véhicule — 5 jours",
      quantity: 5,
      unit_price_ht_cents: 100000,
      vat_rate: 19,
      line_ht_cents: 500000,
      line_vat_cents: 95000,
    },
  ],
};

export const creditNoteFixture: CreditNoteResponse = {
  id: "50505050-5050-4505-8505-505050505050",
  invoice_id: invoiceIssuedFixture.id,
  number: "AV-2026-000001",
  lines: [
    { description: "Annulation facture", amount_ht_cents: 500000, vat_rate: 19, vat_cents: 95000 },
  ],
  total_ht_cents: 500000,
  total_vat_cents: 95000,
  total_ttc_cents: 595000,
  reason: "Erreur de facturation",
  created_at: now,
};

export const orgFiscalIdentityFixture: OrgFiscalIdentityResponse = {
  id: ownerFixture.me.organization.id,
  name: ownerFixture.me.organization.name,
  legal_form: "SARL",
  nif: "000016001234567",
  nis: "000016009876543",
  tax_article_number: "16050123456",
  commerce_register_number: "16/00-1234567 B 21",
  address_line: "12 rue Didouche Mourad",
  city: "Alger",
  postal_code: "16000",
  updated_at: now,
};
