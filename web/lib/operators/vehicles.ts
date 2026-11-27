export const photoPositions = ["front", "side", "interior", "back"] as const;
export const amenities = [
  "Air conditioning",
  "Reclining seats",
  "USB charging",
  "Wi-Fi",
  "Roof rack",
  "PWD-friendly",
] as const;
export type VehicleDraft = {
  title: string;
  make: string;
  model: string;
  model_year: number;
  seats: number;
  location: string;
  description: string;
  plate_number: string;
  amenities: string[];
};
export type OperatorVehicle = VehicleDraft & {
  id: string;
  operator_id: string;
  status: "draft" | "submitted" | "published" | "rejected";
  version: number;
  available_for_requests: boolean;
  updated_at: string;
};
export type VehiclePhoto = {
  id: string;
  vehicle_id: string;
  storage_path: string;
  position: (typeof photoPositions)[number];
  file_name: string;
  content_type: string;
  size_bytes: number;
};
export function readVehicle(
  form: FormData,
  prefix = "",
  location = "",
): VehicleDraft {
  const text = (key: string) => String(form.get(prefix + key) ?? "").trim();
  const value = {
    make: text("make"),
    model: text("model"),
    model_year: Number(text("model_year")),
    seats: Number(text("seats")),
    location: text("location") || location,
    description: text("description"),
    plate_number: text("plate_number"),
    amenities: form.getAll(prefix + "amenities").map(String),
  };
  if (
    !value.make ||
    value.make.length > 80 ||
    !value.model ||
    value.model.length > 65 ||
    !value.plate_number ||
    value.plate_number.length > 30 ||
    !value.location ||
    value.location.length > 200 ||
    value.description.length > 3000 ||
    !Number.isInteger(value.model_year) ||
    value.model_year < 1990 ||
    value.model_year > 2100 ||
    !Number.isInteger(value.seats) ||
    value.seats < 1 ||
    value.seats > 30 ||
    value.amenities.some(
      (item) => !amenities.includes(item as (typeof amenities)[number]),
    )
  )
    throw new Error(
      "Complete each vehicle's make, model, plate number, year, seats, and operating location.",
    );
  return {
    ...value,
    title: `${value.make} ${value.model}`,
    amenities: [...new Set(value.amenities)],
  };
}
