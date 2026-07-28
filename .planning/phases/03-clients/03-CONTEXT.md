---
phase: 3
slug: clients
status: locked
created: 2026-07-27
mode: batch-continuation
note: >
  Continuous execution of phases 2-6 (user: "continue jusqu'à la fin").
  Decisions derived from Phase 1/2 locked decisions, PROJECT.md, REQUIREMENTS,
  and the backend customer contract — not newly invented. Researcher must
  confirm every API-shape assumption against the Go source.
---

# Phase 3 — Contexte : Clients

## Requirements
CUST-01 (create individual customer: identity document + driving license), CUST-02 (create company customer RC/NIF/NIS + designated drivers), CUST-03 (search/find existing customer).

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D-01 | Customer LIST screen at `/clients` (replaces the phase-1 placeholder), dense table (md+) / cards (<md), same pattern as VehicleList — reuse the shared table/select/EmptyState/Skeleton primitives, do NOT rebuild them | Phase 2 continuity (D-01/D-09) |
| D-02 | Individual vs company is a single entity with a `type`/`kind` discriminator on the backend (researcher confirms exact field + enum). The create form is ONE route `/clients/nouveau` with a type toggle that swaps the conditional field set — not two separate routes | Matches a discriminated backend DTO; one guided form |
| D-03 | Designated drivers (CUST-02, company): managed as a repeatable sub-form (add/remove driver rows) within the company branch of the create form, IF the backend accepts drivers nested at customer-create time; if drivers are a separate endpoint, do the create-then-attach sequence (researcher determines) | CUST-02 |
| D-04 | Search (CUST-03): server-side if the list endpoint exposes a query param (name/RC/NIF), else client-side over the fetched list — mirror VehicleList's server-status-filter + client-text-search split. Researcher confirms which params exist | CUST-03, avoid inventing API |
| D-05 | Customer DETAIL screen at `/clients/$customerId` showing identity/company fields + designated drivers (company) + (later phases) contract history. Phase 3 shows only what the customer endpoints expose | CUST scope; contract history is Phase 4 |
| D-06 | Forms: React Hook Form + Zod (Phase 1 auth-form pattern), all copy via i18n FR+EN under a new top-level `customers.*` namespace, zero bare JSX literals. Validation messages via i18n | AUTH-05/06, Phase 1 form conventions |
| D-07 | Data layer mirrors `src/features/fleet/`: `src/features/customers/{api,queries}.ts` over the shared `api` ky client, query keys `["customers", ...]`, agency scoping via currentAgencyId where the API is agency-scoped (researcher confirms whether customers are org- or agency-scoped) | D-06 phase 2 continuity |
| D-08 | Role gating: create/list/detail per backend Scope (CanOperate to create, CanRead to view — researcher confirms the customer handler's authz). No client-invented gates | Backend authority |
| D-09 | Algerian-specific fields (NIF/NIS/RC, identity document types, wilaya if present) rendered with the backend's exact enum values + i18n labels — never client-invented option sets | Compliance fidelity |

## Scope fences
- NO customer edit/delete UI unless a success criterion needs it (create + search + view are the three CUST reqs). Edit deferred unless the backend + a requirement demand it.
- NO contract history on the customer detail (Phase 4).
- NO document upload for customers (out of scope table).
- Replace the `/clients` placeholder route.

## Canonical references
- Backend source of truth: `/Users/azizbelkacemi/Desktop/work-dev/wheelio-api/internal/adapter/httpapi/customer_handler.go`, `customer_dto.go`, `internal/domain/customer/` (entity, type/enum values, driver model).
- Phase 1/2 conventions: `01-UI-SPEC.md`, `src/features/fleet/` (structure to mirror), `src/features/auth/` (RHF+Zod form pattern), existing `src/shared/ui/` inventory.
- Types: add `src/types/customer.ts` mirrored verbatim from the Go DTO.
