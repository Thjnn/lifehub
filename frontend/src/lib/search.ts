const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd')

// Case- and diacritic-insensitive: "banh mi" finds "Bánh mì". Empty term matches everything.
export function searchMatch(text: string, term: string) {
  const needle = fold(term.trim())
  return !needle || fold(text).includes(needle)
}
