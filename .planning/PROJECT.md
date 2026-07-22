# Wheelio Front

## What This Is

Dashboard SaaS professionnel pour Wheelio — le front qui expose l'API `wheelio-api` (gestion de flotte pour sociétés de location de voitures en Algérie) aux trois profils d'utilisateurs de l'agence : agent de guichet, gérant d'agence, owner de société multi-agences. Application web responsive unique (pas d'app native) puisque l'état des lieux se fait sur place, au véhicule.

## Core Value

Une agence peut gérer tout son cycle de location — véhicule, client, contrat, état des lieux, facture — depuis une seule interface web professionnelle, aussi utilisable au comptoir que sur le terrain.

## Business Context

- **Customer**: Sociétés de location de voitures algériennes (agents de guichet, gérants d'agence, owners multi-agences)
- **Revenue model**: SaaS B2B — vente manuelle/démo à ce stade (pas de site vitrine ni de self-signup en v1)
- **Success metric**: Le parcours cœur (véhicule → client → contrat → état des lieux → clôture → facture PDF) démontrable de bout en bout, avec une UI/UX assez soignée pour être un argument de vente
- **Strategy notes**: —

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Auth : login/signup miroir de l'API (JWT access + refresh), gestion de session
- [ ] Rôles : 3 profils (agent guichet / gérant agence / owner société) avec navigation et permissions reflétant le RBAC backend (OrgRole owner/admin/member × AgencyRole manager/agent/viewer)
- [ ] Fleet : liste/fiche véhicule, statut, kilométrage
- [ ] Clients : création/fiche client (particulier/entreprise), conducteurs désignés
- [ ] Contrats de location : création (réservation), activation (départ), clôture (retour + lignes de facturation), annulation
- [ ] État des lieux : sortie et retour, saisie dommages par zone, capture photo depuis mobile/tablette sur le terrain, comparaison sortie/retour
- [ ] Facturation : vue facture, enregistrement paiement, émission avoir, téléchargement PDF (facture, contrat, état des lieux)
- [ ] Identité fiscale société : formulaire de saisie (NIF/NIS/RC/forme juridique/adresse) — bloquant pour l'émission de facture conforme
- [ ] Interface bilingue français/anglais (français par défaut)
- [ ] Identité visuelle propre à créer (pas d'existant) — direction SaaS moderne

### Out of Scope

- Site vitrine public / page tarifs / self-signup en ligne — vente manuelle pour l'instant, à reconsidérer si le modèle commercial change
- App mobile native (iOS/Android) — un seul front web responsive couvre comptoir et terrain
- Paiement en ligne côté client final — l'agence enregistre les paiements manuellement (existant côté API)
- Portail client final (locataire) — l'API et donc ce front restent à usage interne agence, pas de vue client externe
- Maintenance préventive, documents véhicule (upload/expiration) — modules API existants mais hors du parcours cœur v1 ; viendront en phase(s) suivante(s)

## Context

- Backend `wheelio-api` déjà livré et fonctionnellement complet (milestone v1.0, 4 phases) : identity/auth, fleet, documents, maintenance, customer, rental, inspection, billing/PDF — architecture hexagonale Go, RLS multi-tenant, JWT
- API REST déjà stable : signup/login JWT, endpoints CRUD pour chaque module, upload multipart pour documents/photos, endpoints PDF streaming (`application/pdf`, jamais mis en cache)
- Le modèle de facture est conforme au décret exécutif algérien 05-468 (mentions obligatoires, TVA 19%/9%, timbre fiscal, DZD) — le front doit refléter ces champs fidèlement, pas les réinterpréter
- RBAC déjà modélisé côté API : `Scope.CanRead/CanOperate/CanManage` par agence + `IsOrgAdmin` — le front doit driver son affichage/permissions depuis les mêmes rôles renvoyés par `/me` et le payload JWT, jamais dupliquer une logique de rôle indépendante
- Repo front actuellement vide (greenfield complet) — seuls des skills de design (`ui-ux-pro-max`, `design-system`, `ui-styling`, `brand`, etc.) sont pré-installés dans `.claude/skills/`, à exploiter pour la direction visuelle
- Le choix de stack (framework, gestion d'état, styling) est intentionnellement laissé à la phase de recherche du projet, pas figé pendant le questioning

## Constraints

- **Tech stack**: À déterminer en recherche (dashboard SaaS responsive, pas de besoin SEO, consomme une API REST JWT existante) — greenfield, aucune contrainte héritée
- **Compatibilité API**: Le front consomme `wheelio-api` tel quel (contrat REST existant, DTOs JSON, JWT Bearer) — aucune modification du backend prévue dans ce projet
- **Responsive**: Obligatoire — l'état des lieux (photos de dommages) se fait sur le terrain, au véhicule, souvent depuis un téléphone ou une tablette
- **i18n**: Français par défaut + anglais dès la v1 — architecture i18n dès le départ, pas ajoutée après coup
- **Identité visuelle**: Aucune existante — palette/typographie/composants à définir dans ce projet, niveau "pro" (référence SaaS moderne)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Un seul front web responsive, pas d'app native | L'état des lieux terrain doit marcher depuis un navigateur mobile ; deux codebases (web + native) doublerait la maintenance pour un gain non demandé | — Pending |
| V1 = parcours cœur uniquement (véhicule→client→contrat→EDL→clôture→facture), pas tous les modules API | "Vendre un service" a besoin d'une démo end-to-end convaincante vite, pas d'une couverture large mais superficielle ; maintenance/documents peuvent attendre une phase ultérieure | — Pending |
| Vente manuelle, pas de site vitrine/self-signup en v1 | Le modèle commercial actuel est démo + création de compte manuelle (l'API signup existe déjà) ; construire un site public serait prématuré | — Pending |
| Interface bilingue FR/EN dès la v1 | Anticipation d'expansion hors Algérie ; ajouter l'i18n après coup sur une v1 mono-langue coûterait plus cher que de l'architecturer dès le départ | — Pending |
| Stack technique non figée au questioning, déléguée à la recherche | Aucune préférence/contrainte exprimée ; le contexte (dashboard SaaS, responsive, pas de SEO, API REST JWT) est assez précis pour qu'une recherche 2025 tranche objectivement | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-22 after initialization*
