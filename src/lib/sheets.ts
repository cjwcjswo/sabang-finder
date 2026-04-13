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

export function mapValuesToObjects(values: string[][] | undefined): SheetRowObject[] {
  if (!values || values.length === 0) return []
  const rawHeaders = values[0] ?? []
  const headers = normalizeHeaders(rawHeaders)

  const rows = values.slice(1)
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

