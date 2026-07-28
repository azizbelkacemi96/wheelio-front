import { createFileRoute } from "@tanstack/react-router";
import { ContractList } from "@/features/contracts/ContractList";

/**
 * /contrats — the real rental-contract list screen (RENT-01..04), replacing
 * the Phase 1 placeholder. No loader: Phase 1 established component-level
 * useQuery (mirrors clients/index.tsx) — ContractList owns its own data
 * fetching via useAllContractsQuery (the client-side composition; there is no
 * list-all endpoint).
 */
export const Route = createFileRoute("/_authenticated/contrats/")({
  component: ContractList,
});
