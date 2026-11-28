import { Suspense } from "react";
import { getOperatorDocuments } from "@/lib/operators/portal";
import Link from "next/link";
import { OperatorDocumentStatus } from "@/components/operator-status";
import { OperatorWorkspace } from "@/components/operator-workspace";
import { OperatorVehicleManager } from "@/components/operator-vehicle-manager";
import { LoginArrival } from "@/components/login-transition";
import type { VehiclePhoto } from "@/lib/operators/vehicles";
async function Content() {
  const actor = await getOperatorDocuments();
  const records = actor.vehicles;
  const photos = records.length
    ? await actor.supabase
        .from("operator_vehicle_photos")
        .select()
        .in(
          "vehicle_id",
          records.map((vehicle) => vehicle.id),
        )
    : { data: [], error: null };
  if (photos.error) throw new Error("Unable to load vehicle photos.");
  return (
    <OperatorWorkspace
      title="My vans"
      approved={actor.application.status === "approved"}
    >
      <LoginArrival />
      <OperatorVehicleManager
        vehicles={records}
        photos={photos.data as VehiclePhoto[]}
        approved={actor.application.status === "approved"}
        location={actor.application.operating_base}
        documents={actor.documents}
        requirements={actor.requirements}
      />
      <div className="operator-fleet-extras">
        <section className="operator-panel">
          <h2>Drivers</h2>
          <p className="operator-muted">
            Driver profile management will be added in a later phase. Your
            submitted professional-license documents are available under
            Documents.
          </p>
          <Link className="operator-text-button" href="/operator/documents">
            View submitted documents ↗
          </Link>
        </section>
        <OperatorDocumentStatus
          documents={actor.documents}
          requirements={actor.requirements}
          vehicles={actor.vehicles}
        />
      </div>
    </OperatorWorkspace>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="operator-loading" role="status">
          Loading vans…
        </p>
      }
    >
      <Content />
    </Suspense>
  );
}
