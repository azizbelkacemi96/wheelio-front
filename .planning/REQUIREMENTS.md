# Requirements: Wheelio Front

**Defined:** 2026-07-22
**Core Value:** Une agence peut gérer tout son cycle de location — véhicule, client, contrat, état des lieux, facture — depuis une seule interface web professionnelle, aussi utilisable au comptoir que sur le terrain.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Auth & Foundations

- [x] **AUTH-01**: User can log in with email/password (JWT) and stays logged in across sessions via transparent (single-flight) token refresh
- [ ] **AUTH-02**: A session expiry never silently destroys in-progress work (especially an in-progress inspection) — refresh happens invisibly before any hard redirect
- [x] **AUTH-03**: Navigation and available actions reflect the user's role (agent / manager / owner) driven entirely by the backend's `/me` scope, never re-derived independently
- [ ] **AUTH-04**: Owner can switch between agencies within their organization
- [ ] **AUTH-05**: Interface is available in French (default) and English, switchable
- [ ] **AUTH-06**: The app is built on a documented design-token system (colors, typography, spacing) and a base component library, applied consistently across every screen

### Fleet

- [ ] **FLEET-01**: User can view the list of vehicles with live status
- [ ] **FLEET-02**: User can view a vehicle's detail (plate, brand/model, mileage, fuel, current contract)

### Clients

- [ ] **CUST-01**: User can create an individual customer record (identity document, driving license)
- [ ] **CUST-02**: User can create a company customer record (RC/NIF/NIS) with designated drivers
- [ ] **CUST-03**: User can search for and find an existing customer

### Contrats de location

- [ ] **RENT-01**: User can create a rental contract (reservation) for an available vehicle and a customer
- [ ] **RENT-02**: User can activate a contract, recording departure mileage and fuel level
- [ ] **RENT-03**: User can close a contract, recording return mileage, fuel level, and invoice lines
- [ ] **RENT-04**: User can cancel a reservation or an active contract with a reason
- [ ] **RENT-05**: User is guided through the entire new-rental golden path (vehicle → customer → contract → departure inspection) as one continuous wizard flow, not four disconnected screens — this is a full v1 feature, built properly, not a cut-corner version

### État des lieux

- [ ] **INSP-01**: User can perform a departure (sortie) inspection: mileage, fuel level, damage recorded per canonical zone
- [ ] **INSP-02**: User can capture a photo on-site (mobile/tablet) and attach it to a recorded damage, with resilience to flaky field connectivity (incremental upload, retry, no silent loss)
- [ ] **INSP-03**: User can perform a return (retour) inspection

### Facturation

- [ ] **BILL-01**: The organization's fiscal identity (NIF/NIS/RC/legal form/address) must be complete before any invoice can be issued — enforced as a blocking gate in the UI, not just a passive form
- [ ] **BILL-02**: User can view an invoice showing all décret 05-468 mandatory mentions
- [ ] **BILL-03**: User can record a payment against an invoice (cash / card / transfer)
- [ ] **BILL-04**: User can issue a credit note (avoir) against an invoice
- [ ] **BILL-05**: User can download the invoice, the rental contract, and the inspection report as PDF, via an authenticated download (never a bare link)

### Ops

- [ ] **OPS-01**: User sees a "today" overview (pickups and returns due today) on landing

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### État des lieux

- **INSP-04**: User can view a side-by-side comparison of departure vs. return damage, highlighting new damage

### Fleet

- **FLEET-03**: Fleet availability calendar view

### Ops

- **OPS-02**: Utilization / revenue analytics dashboard

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Site vitrine public / page tarifs / self-signup en ligne | Vente manuelle pour l'instant (démo + création de compte manuelle) — pas de motion self-serve à supporter |
| App mobile native (iOS/Android) | Un seul front web responsive couvre comptoir et terrain — deux codebases doubleraient la maintenance sans besoin exprimé |
| Paiement en ligne côté client final | L'agence enregistre les paiements manuellement (existant côté API) |
| Portail client final (locataire) | L'API reste à usage interne agence — pas de vue client externe |
| Maintenance préventive (UI) | Module API existant mais hors du parcours cœur v1 |
| Documents véhicule — upload/expiration (UI) | Module API existant mais hors du parcours cœur v1 |
| Signature électronique | Le backend n'a pas de capacité de signature — nécessiterait un travail backend hors périmètre |
| Détection de dommages par IA / GPS-télématique / tarification dynamique | Différenciateurs identifiés en recherche mais non alignés avec l'objectif "démo golden-path convaincante" du v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| FLEET-01 | Phase 2 | Pending |
| FLEET-02 | Phase 2 | Pending |
| CUST-01 | Phase 3 | Pending |
| CUST-02 | Phase 3 | Pending |
| CUST-03 | Phase 3 | Pending |
| RENT-01 | Phase 4 | Pending |
| RENT-02 | Phase 4 | Pending |
| RENT-03 | Phase 4 | Pending |
| RENT-04 | Phase 4 | Pending |
| RENT-05 | Phase 4 | Pending |
| INSP-01 | Phase 5 | Pending |
| INSP-02 | Phase 5 | Pending |
| INSP-03 | Phase 5 | Pending |
| BILL-01 | Phase 6 | Pending |
| BILL-02 | Phase 6 | Pending |
| BILL-03 | Phase 6 | Pending |
| BILL-04 | Phase 6 | Pending |
| BILL-05 | Phase 6 | Pending |
| OPS-01 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 25 total
- Mapped to phases: 25 (Phase 1: 6, Phase 2: 2, Phase 3: 3, Phase 4: 6, Phase 5: 3, Phase 6: 5)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-22*
*Last updated: 2026-07-22 after roadmap creation (traceability mapped)*
