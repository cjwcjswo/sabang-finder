export function extractSpreadsheetId(input: string): string | null {
  const text = input.trim()
  if (!text) return null

  // Common forms:
  // - https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
  // - .../spreadsheets/d/{ID}
  // - {ID}
  const match =
    text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ??
    text.match(/^([a-zA-Z0-9-_]{20,})$/)

  return match?.[1] ?? null
}

