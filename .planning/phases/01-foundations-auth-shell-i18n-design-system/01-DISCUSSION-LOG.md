# Phase 1: Foundations — Auth, Shell, i18n, Design System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 1-Foundations — Auth, Shell, i18n, Design System
**Areas discussed:** Identité visuelle, Connexion & session, Navigation par rôle, Switch agence (owner)

---

## Identité visuelle

| Option | Description | Selected |
|--------|-------------|----------|
| Linear/Notion | Neutre, épuré, accent discret — feel "outil pro pointu" | |
| Stripe | Plus coloré/gradient, feel "fintech confiant" | ✓ |
| Autre référence | Freeform | |

**User's choice:** Stripe

| Option | Description | Selected |
|--------|-------------|----------|
| Light only v1 | Un seul thème, dark ajoutable après | |
| Light + dark dès v1 | Les deux dès le départ | ✓ |

**User's choice:** Light + dark dès v1

| Option | Description | Selected |
|--------|-------------|----------|
| Bleu | Confiance, standard SaaS/auto | ✓ |
| Vert | Mobilité/éco | |
| Autre couleur | Freeform | |

**User's choice:** Bleu

| Option | Description | Selected |
|--------|-------------|----------|
| Dense/compact | Plus de lignes visibles, utile agent guichet | ✓ |
| Aéré/spacieux | Plus d'espace, look premium, moins de données par écran | |

**User's choice:** Dense/compact

**Notes:** Aucune identité de marque existante — tout est décidé ici from scratch.

---

## Connexion & session

| Option | Description | Selected |
|--------|-------------|----------|
| Rien, pas de lien | Pas d'endpoint backend = pas de vraie fonctionnalité | |
| Lien vers contact/support | Lien mais qui ouvre juste un mailto | |
| (freeform) | "on le fera plus tard" | ✓ |

**User's choice:** Différé — pas en v1, à faire plus tard (nécessite un endpoint backend hors périmètre de ce projet frontend)

| Option | Description | Selected |
|--------|-------------|----------|
| Message générique | Cohérent avec le timing-equalizer anti-énumération backend | ✓ |
| Distinguer email inconnu / mdp faux | Casserait la protection anti-énumération | |

**User's choice:** Message générique

| Option | Description | Selected |
|--------|-------------|----------|
| Pas de signup front | Cohérent avec "vente manuelle" — toi tu crées le compte via API | |
| Signup accessible depuis le front | Formulaire signup dans l'app | ✓ |

**User's choice:** Signup accessible depuis le front

**Notes:** L'API backend n'a aucun endpoint de reset password (`/auth/signup`, `/login`, `/refresh`, `/logout`, `/me` uniquement) — confirmé par lecture directe de `auth_handler.go`. Le signup front reste un écran applicatif, pas un site vitrine public (ne contredit pas la décision "pas de self-signup public" de PROJECT.md).

---

## Navigation par rôle

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal focus | Aujourd'hui/Véhicules/Clients/Contrats/EDL, rien d'admin | |
| Complet comme owner | Même menu que owner, actions filtrées par permission | ✓ (précisé ensuite) |

**User's choice:** Complet comme owner — précisé ensuite : la base (5 items) est identique pour tous les rôles, mais 3 sections admin spécifiques restent cachées pour agent/gérant (voir ci-dessous).

| Option | Description | Selected |
|--------|-------------|----------|
| Identité fiscale société | Formulaire NIF/NIS/RC | ✓ |
| Gestion agences | Vue liste des agences | ✓ |
| Vue facturation transverse | Toutes factures toutes agences | ✓ |

**User's choice:** Les trois sélectionnées comme admin owner-only.

**Follow-up clarification:**

| Option | Description | Selected |
|--------|-------------|----------|
| Ces 3 cachés pour agent/gérant | Nav-section masquée entièrement pour non-owner | ✓ |
| Visibles pour tous, grisés si pas la permission | Item présent partout mais désactivé | |

**User's choice:** Ces 3 cachés pour agent/gérant — résout l'ambiguïté entre "menu complet comme owner" (structure de base) et les 3 sections réellement owner-only.

---

## Switch agence (owner)

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown top bar | Style Slack/Linear, toujours visible | ✓ |
| Page séparée | Page dédiée "Mes agences" | |

**User's choice:** Dropdown top bar

| Option | Description | Selected |
|--------|-------------|----------|
| Reste sur même section, data change | Ex: reste sur Contrats, données de la nouvelle agence | ✓ |
| Retour à l'accueil | Switch ramène toujours au dashboard | |

**User's choice:** Reste sur même section, data change

---

## Claude's Discretion

Aucune — chaque zone grise a reçu une décision utilisateur concrète.

## Deferred Ideas

- Password reset (self-service) flow — nécessite un nouvel endpoint backend côté `wheelio-api`, hors périmètre de ce projet frontend. À reconsidérer plus tard.
