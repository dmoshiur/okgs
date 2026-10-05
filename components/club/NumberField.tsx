"use client";

export function NumberField({
  label,
  value,
  min = 0,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="cs-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value || ""}
        onChange={(event) => onChange(Math.max(min, Math.floor(Number(event.target.value) || 0)))}
      />
    </label>
  );
}
