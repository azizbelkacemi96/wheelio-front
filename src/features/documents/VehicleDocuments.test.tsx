/**
 * VehicleDocuments — renders the vehicle's documents with type labels and an
 * expiry badge, and the empty state. Uses the shared MSW documents handler,
 * overridden per test to return a specific document.
 */
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import i18n from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import type { DocumentResponse } from "@/types/document";
import { VehicleDocuments } from "./VehicleDocuments";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";
const VEHICLE_ID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";

function Harness({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const insuranceExpired: DocumentResponse = {
  id: "d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0",
  vehicle_id: VEHICLE_ID,
  type: "insurance",
  title: "Assurance 2019",
  content_type: "application/pdf",
  size_bytes: 12345,
  sha256: "0".repeat(64),
  expires_at: "2020-01-01",
  created_at: "2019-01-01T00:00:00.000Z",
};

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

describe("VehicleDocuments", () => {
  it("shows a document with its type label and an expired badge", async () => {
    server.use(
      http.get(`${API_URL}/vehicles/:vehicleId/documents`, () =>
        HttpResponse.json([insuranceExpired], { status: 200 }),
      ),
    );
    render(
      <Harness>
        <VehicleDocuments vehicleId={VEHICLE_ID} canWrite={false} />
      </Harness>,
    );

    await waitFor(() => expect(screen.getByText("Assurance 2019")).toBeInTheDocument());
    expect(screen.getByText("Assurance")).toBeInTheDocument();
    expect(screen.getByText("Expiré")).toBeInTheDocument();
  });

  it("shows the empty state when there are no documents", async () => {
    server.use(
      http.get(`${API_URL}/vehicles/:vehicleId/documents`, () =>
        HttpResponse.json([], { status: 200 }),
      ),
    );
    render(
      <Harness>
        <VehicleDocuments vehicleId={VEHICLE_ID} canWrite={false} />
      </Harness>,
    );
    await waitFor(() => expect(screen.getByText("Aucun document.")).toBeInTheDocument());
  });

  it("hides the upload form when the user cannot write", async () => {
    server.use(
      http.get(`${API_URL}/vehicles/:vehicleId/documents`, () =>
        HttpResponse.json([], { status: 200 }),
      ),
    );
    render(
      <Harness>
        <VehicleDocuments vehicleId={VEHICLE_ID} canWrite={false} />
      </Harness>,
    );
    await waitFor(() => expect(screen.getByText("Aucun document.")).toBeInTheDocument());
    expect(screen.queryByText("Choisir un fichier")).not.toBeInTheDocument();
  });
});
