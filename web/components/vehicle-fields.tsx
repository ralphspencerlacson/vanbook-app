"use client";
import { useState } from "react";
import {
  amenities,
  photoPositions,
  type VehicleDraft,
  type VehiclePhoto,
} from "@/lib/operators/vehicles";
export function VehicleFields({
  prefix = "",
  photoPrefix = "photo:van:",
  initial,
  photos = [],
  disabled,
  onFilesChange,
}: {
  prefix?: string;
  photoPrefix?: string;
  initial?: Partial<VehicleDraft>;
  photos?: VehiclePhoto[];
  disabled?: boolean;
  onFilesChange?: (name: string, file: File | undefined) => void;
}) {
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  return (
    <>
      <div className="operator-vehicle-fields">
        {[
          ["make", "Make", "text", 80],
          ["model", "Model", "text", 65],
          ["plate_number", "Plate number", "text", 30],
          ["model_year", "Year", "number", 4],
          ["seats", "Registered seats", "number", 2],
          ["location", "Operating location", "text", 200],
        ].map(([key, label, type, max]) => (
          <label key={key}>
            {label}
            <input
              name={prefix + key}
              type={String(type)}
              defaultValue={
                (initial?.[key as keyof VehicleDraft] as string | number) ?? ""
              }
              required
              disabled={disabled}
              maxLength={Number(max)}
              min={
                key === "model_year" ? 1990 : key === "seats" ? 1 : undefined
              }
              max={
                key === "model_year" ? 2100 : key === "seats" ? 30 : undefined
              }
              placeholder={
                key === "make"
                  ? "Toyota"
                  : key === "model"
                    ? "Hiace"
                    : key === "seats"
                      ? "15"
                      : undefined
              }
            />
          </label>
        ))}
      </div>
      <div className="operator-photo-grid">
        {photoPositions.map((position) => (
          <label className="operator-photo-upload" key={position}>
            <span className="operator-photo-title"><span aria-hidden="true">{fileNames[position] ? "✓ " : "+ "}</span>
              {position[0].toUpperCase() + position.slice(1)} photo{" "}
              {position === "front" ? "*" : ""}
            </span>
            {fileNames[position] && <small className="operator-photo-filename">{fileNames[position]}</small>}
            {photos.some((photo) => photo.position === position) && (
              <small>Photo on file · choose to replace</small>
            )}
            <input
              name={photoPrefix + position}
              aria-label={`${position} photo`}
              type="file"
              accept="image/jpeg,image/png"
              required={
                position === "front" &&
                !photos.some((photo) => photo.position === "front")
              }
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setFileNames((previous) => ({ ...previous, [position]: file?.name ?? "" }));
                onFilesChange?.(photoPrefix + position, file);
              }}
            />
          </label>
        ))}
      </div>
      <fieldset className="operator-amenities">
        <legend>Amenities (optional)</legend>
        {amenities.map((item) => (
          <label key={item}>
            <input
              type="checkbox"
              name={prefix + "amenities"}
              value={item}
              defaultChecked={initial?.amenities?.includes(item)}
              disabled={disabled}
            />
            {item}
          </label>
        ))}
      </fieldset>
    </>
  );
}
