interface NumberFieldProps {
  /** Current value, or `undefined` when the field has been cleared. */
  value: number | undefined
  /** Emits the parsed value, or `undefined` while the field is empty. */
  onChange: (value: number | undefined) => void
  min?: number
  step?: number
}

/**
 * A controlled `<input type="number">` that is allowed to be empty.
 *
 * The usual `Number(e.target.value) || fallback` pattern makes the last digit
 * undeletable: clearing the box yields `''`, `Number('')` is `0`, and the
 * `|| fallback` immediately writes a value back. Here an empty box maps to
 * `undefined` instead, so backspacing the final digit sticks. Consumers store
 * the optional field as-is and apply their own default at read time
 * (e.g. `readingDelayMs ?? DEFAULT_READING_DELAY` in the player).
 */
export default function NumberField({ value, onChange, min, step }: NumberFieldProps) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value
        onChange(raw === '' ? undefined : Number(raw))
      }}
    />
  )
}
