import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, RefreshCw, Search } from 'lucide-react'
import { extractSpreadsheetId } from './lib/url'
import {
  SheetsApiError,
  type SheetRowObject,
  type SheetsDataByTitle,
  fetchAllSheetsData,
} from './lib/sheets'
import { LoadingSpinner } from './components/LoadingSpinner'
import { SheetSection } from './components/SheetSection'

const PRODUCT_NAME_KEYS = ['상품명', '상품명(필수)', 'productName', 'ProductName', 'name', '상품']

function rowMatchesQuery(row: SheetRowObject, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const candidates: string[] = []
  for (const k of PRODUCT_NAME_KEYS) {
    const v = row[k]
    if (v && v.trim()) candidates.push(v)
  }
  if (candidates.length === 0) return false

  return candidates.join(' ').toLowerCase().includes(q)
}

function filterDataByQuery(all: SheetsDataByTitle, query: string): SheetsDataByTitle {
  const q = query.trim()
  if (!q) return all
  const out: SheetsDataByTitle = {}
  for (const [sheet, rows] of Object.entries(all)) {
    const matches = rows.filter((r) => rowMatchesQuery(r, q))
    if (matches.length > 0) out[sheet] = matches
  }
  return out
}

function formatErrorMessage(err: unknown): string {
  if (err instanceof SheetsApiError) return err.message
  if (err instanceof Error) return err.message
  return '알 수 없는 오류가 발생했습니다.'
}

export default function App() {
  const [url, setUrl] = useState('')
  const [query, setQuery] = useState('')
  const [allData, setAllData] = useState<SheetsDataByTitle>({})
  const [filtered, setFiltered] = useState<SheetsDataByTitle>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiKey = String(import.meta.env.VITE_GOOGLE_API_KEY ?? '')
  const apiKeyPresent = Boolean(apiKey)

  const spreadsheetId = useMemo(() => extractSpreadsheetId(url), [url])
  const canLoad = apiKeyPresent && Boolean(spreadsheetId) && !loading
  const subtitle = useMemo(() => {
    if (!apiKeyPresent) return '환경변수 VITE_GOOGLE_API_KEY가 필요합니다.'
    if (!Object.keys(allData).length) return '스프레드시트 URL을 넣고 데이터를 불러오세요.'
    return '상품명을 기준으로 검색합니다.'
  }, [apiKeyPresent, allData])

  useEffect(() => {
    setFiltered(filterDataByQuery(allData, query))
  }, [allData, query])

  async function handleLoad() {
    setError(null)
    const id = spreadsheetId
    if (!id) {
      setError('스프레드시트 URL에서 ID를 추출할 수 없습니다.')
      return
    }
    if (!apiKeyPresent) {
      setError('API Key가 필요합니다. (.env의 VITE_GOOGLE_API_KEY)')
      return
    }

    setLoading(true)
    try {
      const data = await fetchAllSheetsData(id, apiKey)
      setAllData(data)
      setFiltered(filterDataByQuery(data, query))
    } catch (e) {
      setAllData({})
      setFiltered({})
      setError(formatErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
              <FileSpreadsheet className="h-5 w-5 text-zinc-100" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Google Sheets 검색</h1>
              <p className="text-sm text-zinc-400">{subtitle}</p>
            </div>
          </div>
        </header>

        <main className="mt-8 space-y-6">
          {!apiKeyPresent && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              <div className="font-medium">API Key가 설정되지 않았습니다.</div>
              <div className="mt-1 text-amber-200/80">
                프로젝트 루트에 <code className="rounded bg-black/30 px-1 py-0.5">.env</code> 파일을 만들고{' '}
                <code className="rounded bg-black/30 px-1 py-0.5">VITE_GOOGLE_API_KEY</code>를 넣어주세요.
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              <div className="font-medium">오류</div>
              <div className="mt-1 text-rose-200/80">{error}</div>
            </div>
          )}

          <section className="rounded-2xl bg-zinc-900/40 p-4 ring-1 ring-zinc-800">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-zinc-200">Google Spreadsheet URL</div>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
                {!spreadsheetId && url.trim().length > 0 && (
                  <div className="mt-2 text-xs text-rose-300/80">유효한 스프레드시트 URL 형식이 아닙니다.</div>
                )}
              </label>
              <button
                type="button"
                disabled={!canLoad}
                onClick={handleLoad}
                className="h-10 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner className="h-4 w-4" />
                    불러오는 중...
                  </span>
                ) : (
                  '데이터 불러오기'
                )}
              </button>
            </div>
            {Object.keys(allData).length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                <div>
                  로드된 시트: <span className="text-zinc-200">{Object.keys(allData).length}</span>개
                </div>
                <button
                  type="button"
                  onClick={handleLoad}
                  disabled={loading || !spreadsheetId || !apiKeyPresent}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-zinc-200 hover:bg-zinc-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  새로고침
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-zinc-900/40 p-4 ring-1 ring-zinc-800">
            <div className="mb-2 text-sm font-medium text-zinc-200">상품명 검색</div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="검색어를 입력하세요"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
            <div className="mt-3 text-xs text-zinc-500">
              검색 키 후보: <span className="text-zinc-300">{PRODUCT_NAME_KEYS.join(', ')}</span>
            </div>
          </section>

          {loading && Object.keys(allData).length === 0 && (
            <section className="rounded-2xl bg-zinc-900/40 p-6 ring-1 ring-zinc-800">
              <div className="flex items-center justify-center gap-3 text-sm text-zinc-200">
                <LoadingSpinner className="h-5 w-5" />
                전체 시트 데이터를 불러오는 중입니다...
              </div>
            </section>
          )}

          {!loading && Object.keys(allData).length > 0 && (
            <section className="space-y-6">
              {Object.keys(filtered).length === 0 ? (
                <div className="rounded-2xl bg-zinc-900/40 p-6 text-sm text-zinc-300 ring-1 ring-zinc-800">
                  일치하는 항목이 없습니다.
                </div>
              ) : (
                Object.entries(filtered).map(([title, rows]) => (
                  <SheetSection key={title} title={title} rows={rows} query={query} />
                ))
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

