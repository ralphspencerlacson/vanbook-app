"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveVehicle, setVehicleAvailability } from "@/app/operator/actions";
import {
  type OperatorVehicle,
  type VehiclePhoto,
} from "@/lib/operators/vehicles";
import { VehicleFields } from "./vehicle-fields";
export function OperatorVehicleManager({
  vehicles,
  photos,
  approved,
  location,
}: {
  vehicles: OperatorVehicle[];
  photos: VehiclePhoto[];
  approved: boolean;
  location: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  return (
    <>
      <div className="operator-van-toolbar">
        <p>
          {vehicles.length} registered {vehicles.length === 1 ? "van" : "vans"}
        </p>
        <button
          className="site-button is-yellow"
          onClick={() => setEditing("new")}
        >
          ＋ Add vehicle
        </button>
      </div>
      {notice && (
        <p role="status" className="operator-pending-banner">
          {notice}
        </p>
      )}
      <div className="operator-van-table-wrap">
        <table className="operator-van-table">
          <caption className="sr-only">
            Your registered vans, seat capacity, review status, and availability
          </caption>
          <thead>
            <tr>
              <th>Van</th>
              <th>Seats</th>
              <th>Photos</th>
              <th>Status</th>
              <th>Available for requests</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => {
              const front = photos.find(
                (photo) =>
                  photo.vehicle_id === vehicle.id && photo.position === "front",
              );
              return (
                <tr key={vehicle.id}>
                  <th scope="row">
                    <div className="operator-van-identity">
                      {front ? (
                        <Image
                          src={`/vehicle-photos/${front.id}`}
                          width={64}
                          height={44}
                          alt={vehicle.title}
                          unoptimized
                        />
                      ) : (
                        <span
                          className="operator-van-placeholder"
                          aria-hidden="true"
                        >
                          ▰
                        </span>
                      )}
                      <div>
                        <strong>{vehicle.title}</strong>
                        <small>
                          {vehicle.plate_number} · {vehicle.model_year}
                        </small>
                      </div>
                    </div>
                  </th>
                  <td data-label="Seats">{vehicle.seats}</td>
                  <td data-label="Photos">
                    {
                      photos.filter((photo) => photo.vehicle_id === vehicle.id)
                        .length
                    }{" "}
                    on file
                  </td>
                  <td data-label="Status">
                    <span
                      className={`requirement-badge ${vehicle.status === "published" ? "is-active" : vehicle.status === "rejected" ? "is-required" : "is-optional"}`}
                    >
                      {vehicle.status === "published"
                        ? "Approved"
                        : vehicle.status === "rejected"
                          ? "Changes needed"
                          : "Pending review"}
                    </span>
                  </td>
                  <td data-label="Available">
                    <AvailabilitySwitch
                      key={`${vehicle.id}-${vehicle.version}`}
                      vehicle={vehicle}
                      approved={approved}
                      onResult={setNotice}
                    />
                  </td>
                  <td>
                    <button
                      className="operator-text-button"
                      onClick={() => setEditing(vehicle.id)}
                      aria-label={`Edit ${vehicle.title}`}
                    >
                      Edit ↗
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!vehicles.length && (
          <div className="operator-empty">
            <h2>No vans added yet</h2>
            <p>Add your first vehicle and upload a front photo for review.</p>
          </div>
        )}
      </div>
      <p className="operator-muted">
        Vans must be approved before accepting requests. Editing vehicle details
        sends the van back for review.
      </p>
      {editing !== null && (
        <VehicleDrawer
          key={editing}
          vehicle={vehicles.find((vehicle) => vehicle.id === editing)}
          photos={photos.filter((photo) => photo.vehicle_id === editing)}
          location={location}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setNotice(message);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
function AvailabilitySwitch({
  vehicle,
  approved,
  onResult,
}: {
  vehicle: OperatorVehicle;
  approved: boolean;
  onResult: (message: string) => void;
}) {
  const router = useRouter();
  const [available, setAvailable] = useState(vehicle.available_for_requests);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function update(value: boolean) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setAvailable(value);
    try {
      const result = await setVehicleAvailability(
        vehicle.id,
        vehicle.version,
        value,
      );
      onResult(result.message);
      if (result.success) router.refresh();
      else setAvailable(vehicle.available_for_requests);
    } catch {
      setAvailable(vehicle.available_for_requests);
      onResult("Availability could not be saved. Try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <label className="operator-availability">
      <input
        type="checkbox"
        role="switch"
        aria-label={`Available for requests: ${vehicle.title}`}
        checked={available}
        disabled={!approved || vehicle.status !== "published" || pending}
        onChange={(event) => update(event.target.checked)}
      />
      <span aria-hidden="true" />
    </label>
  );
}
function VehicleDrawer({
  vehicle,
  photos,
  location,
  onClose,
  onSaved,
}: {
  vehicle?: OperatorVehicle;
  photos: VehiclePhoto[];
  location: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await saveVehicle(new FormData(event.currentTarget));
      if (result.success) onSaved(result.message);
      else setMessage(result.message);
    } catch {
      setMessage("We couldn't save this van. Your entries are still here.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <dialog
      className="requirements-editor-panel operator-vehicle-drawer"
      ref={dialog}
      aria-labelledby="vehicle-editor-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy.current) event.preventDefault();
      }}
    >
      <div className="requirements-drawer-content">
        <header>
          <button
            className="requirements-drawer-close"
            aria-label="Close vehicle editor"
            disabled={pending}
            onClick={onClose}
          >
            ×
          </button>
          <span className="requirements-eyebrow">MY VANS</span>
          <h2 id="vehicle-editor-title">
            {vehicle ? "Edit vehicle" : "Add vehicle"}
          </h2>
          <p>Keep the registered seating and vehicle details accurate.</p>
        </header>
        <form onSubmit={submit} aria-busy={pending}>
          <input type="hidden" name="id" value={vehicle?.id ?? ""} />
          <input type="hidden" name="version" value={vehicle?.version ?? 0} />
          <VehicleFields
            initial={vehicle ?? { location }}
            photos={photos}
            disabled={pending}
          />
          <p className="operator-muted">
            PNG or JPEG photos. Combined upload limit: 3 MB.
          </p>
          {message && (
            <p role="alert" className="requirements-error">
              {message}
            </p>
          )}
          <div className="requirements-editor-actions">
            <button
              className="requirements-button is-secondary"
              type="button"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </button>
            <button className="requirements-button" disabled={pending}>
              {pending ? "Saving…" : "Save vehicle"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
