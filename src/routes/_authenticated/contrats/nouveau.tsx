import { createFileRoute } from "@tanstack/react-router";
import { ContractWizard } from "@/features/contracts/wizard/ContractWizard";

/**
 * /contrats/nouveau — the guided rental wizard (RENT-05). Static segment,
 * outranks the $contractId dynamic route. The component owns its multi-step
 * flow; no route loader.
 */
export const Route = createFileRoute("/_authenticated/contrats/nouveau")({
  component: ContractWizard,
});
