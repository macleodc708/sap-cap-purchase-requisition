/** Heutiges Datum als ISO-String (YYYY-MM-DD) */
export const today = () => new Date().toISOString().slice(0, 10)

/** Kaufmännisch auf 2 Nachkommastellen runden */
export const round2 = value => Math.round(Number(value) * 100) / 100
