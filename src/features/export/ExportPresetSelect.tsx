import type { ExportPreset } from "../../data/types";
import { exportPresetLabels } from "./exportPreset";

export function ExportPresetSelect({
  value,
  onChange
}: {
  value: ExportPreset;
  onChange: (preset: ExportPreset) => void;
}) {
  return (
    <label className="export-preset">
      <span>Export csomag</span>
      <select
        aria-label="Export csomag"
        name="exportPreset"
        value={value}
        onChange={(event) => onChange(event.target.value as ExportPreset)}
      >
        {Object.entries(exportPresetLabels).map(([preset, label]) => (
          <option key={preset} value={preset}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

