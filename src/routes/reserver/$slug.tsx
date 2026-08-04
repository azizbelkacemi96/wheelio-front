import { createFileRoute } from "@tanstack/react-router";
import { PublicBooking } from "@/features/booking/PublicBooking";

/**
 * Public booking storefront (BOOK-01) — outside `_authenticated`: a visitor
 * reaches /reserver/<slug> with no session. The slug identifies the org.
 */
export const Route = createFileRoute("/reserver/$slug")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <PublicBooking slug={slug} />;
}
