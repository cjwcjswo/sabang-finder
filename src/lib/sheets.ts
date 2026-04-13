export type SheetTitle = string

export type SheetRowObject = Record<string, string>
export type SheetsDataByTitle = Record<SheetTitle, SheetRowObject[]>

export type SheetsApiErrorKind =
  | 'missing_api_key'
  | 'invalid_url'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'network'
  | 'unknown'

export class SheetsApiError extends Error {
  kind: SheetsApiErrorKind
  status?: number

  constructor(kind: SheetsApiErrorKind, message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

type SpreadsheetMetaResponse = {
  sheets?: { properties?: { title?: string } }[]
}

type ValuesResponse = {
  range?: string
  majorDimension?: string
  values?: string[][]
}

function toSheetsApiErrorKind(status?: number): SheetsApiErrorKind {
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 429) return 'rate_limited'
  return 'unknown'
}

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new SheetsApiError('network', '네트워크 오류가 발생했습니다.')
  }

  if (!res.ok) {
    const kind = toSheetsApiErrorKind(res.status)
    let msg = `요청에 실패했습니다. (HTTP ${res.status})`
    if (kind === 'forbidden') msg = '권한이 없거나(API Key 제한 포함) 접근할 수 없습니다. (403)'
    if (kind === 'not_found') msg = '스프레드시트를 찾을 수 없습니다. URL/공개 설정을 확인하세요. (404)'
    if (kind === 'rate_limited') msg = '요청이 너무 많습니다. 잠시 후 다시 시도하세요. (429)'
    throw new SheetsApiError(kind, msg, res.status)
  }

  return (await res.json()) as T
}

export function buildSpreadsheetMetaUrl(spreadsheetId: string, apiKey: string): string {
  const id = encodeURIComponent(spreadsheetId)
  const key = encodeURIComponent(apiKey)
  return `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${key}`
}

export function buildSheetValuesUrl(
  spreadsheetId: string,
  sheetTitle: string,
  apiKey: string,
): string {
  const id = encodeURIComponent(spreadsheetId)
  const range = encodeURIComponent(sheetTitle)
  const key = encodeURIComponent(apiKey)
  return `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}?key=${key}`
}

export async function fetchSheetTitles(spreadsheetId: string, apiKey: string): Promise<SheetTitle[]> {
  if (!apiKey) throw new SheetsApiError('missing_api_key', 'API Key가 필요합니다.')

  const url = buildSpreadsheetMetaUrl(spreadsheetId, apiKey)
  const meta = await fetchJson<SpreadsheetMetaResponse>(url)

  const titles =
    meta.sheets
      ?.map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t && t.trim().length > 0)) ?? []

  return titles
}

function normalizeHeaders(rawHeaders: string[]): string[] {
  const used = new Map<string, number>()
  return rawHeaders.map((h, idx) => {
    const base = (h ?? '').trim() || `__col${idx + 1}`
    const prev = used.get(base) ?? 0
    used.set(base, prev + 1)
    if (prev === 0) return base
    return `${base}__${prev + 1}`
  })
}

function isBlankCell(v: unknown): boolean {
  return String(v ?? '').trim().length === 0
}

function leftFillRow(row: string[], maxCols: number): string[] {
  const filled = Array.from({ length: maxCols }, (_, i) => String(row[i] ?? ''))
  let last = ''
  for (let c = 0; c < filled.length; c++) {
    const cur = filled[c].trim()
    if (cur) last = cur
    else if (last) filled[c] = last
  }
  return filled
}

function guessHeaderRowCount(values: string[][]): number {
  // We support up to 3 header rows.
  // Heuristic: treat additional rows as header if they provide labels for columns
  // where upper rows are blank (common with merged header cells).
  const r1 = values[0] ?? []
  const r2 = values[1] ?? []
  const r3 = values[2] ?? []

  const maxCols = Math.max(r1.length, r2.length, r3.length)
  if (values.length < 2) return 1

  const hasSecondLevel = Array.from({ length: maxCols }).some(
    (_, c) => isBlankCell(r1[c]) && !isBlankCell(r2[c]),
  )

  if (values.length < 3) return hasSecondLevel ? 2 : 1

  const hasThirdLevel = Array.from({ length: maxCols }).some(
    (_, c) => (isBlankCell(r2[c]) && !isBlankCell(r3[c])) || (isBlankCell(r1[c]) && !isBlankCell(r3[c])),
  )

  if (hasThirdLevel) return 3
  if (hasSecondLevel) return 2

  return 1
}

function buildMultiRowHeaders(values: string[][], headerRowCount: number): string[] {
  const headerRows = values.slice(0, headerRowCount)
  const maxCols = Math.max(...headerRows.map((r) => r.length), 0)

  const filledRows = headerRows.map((r) => leftFillRow(r, maxCols))

  const rawKeys = Array.from({ length: maxCols }).map((_, c) => {
    const parts = filledRows
      .map((r) => String(r[c] ?? '').trim())
      .filter((p) => p.length > 0)

    const key = parts.join('/')
    return key || `__col${c + 1}`
  })

  return normalizeHeaders(rawKeys)
}

export function mapValuesToObjects(values: string[][] | undefined): SheetRowObject[] {
  if (!values || values.length === 0) return []

  const headerRowCount = guessHeaderRowCount(values)
  const headers =
    headerRowCount <= 1
      ? normalizeHeaders(values[0] ?? [])
      : buildMultiRowHeaders(values, Math.min(3, Math.max(1, headerRowCount)))

  const rows = values.slice(Math.min(headerRowCount, values.length))
  return rows
    .filter((r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim().length > 0))
    .map((r) => {
      const obj: SheetRowObject = {}
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = String(r[i] ?? '')
      }
      return obj
    })
}

export async function fetchAllSheetsData(
  spreadsheetId: string,
  apiKey: string,
): Promise<SheetsDataByTitle> {
  const titles = await fetchSheetTitles(spreadsheetId, apiKey)
  const entries = await Promise.all(
    titles.map(async (title) => {
      const url = buildSheetValuesUrl(spreadsheetId, title, apiKey)
      const data = await fetchJson<ValuesResponse>(url)
      return [title, mapValuesToObjects(data.values)] as const
    }),
  )

  const out: SheetsDataByTitle = {}
  for (const [title, rows] of entries) out[title] = rows
  return out
}

