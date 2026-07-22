import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

// Temporary landing route — replaced by the real dashboard/shell in a later plan.
function IndexComponent() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Wheelio</h1>
    </div>
  );
}
