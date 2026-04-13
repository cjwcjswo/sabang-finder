import type { SheetRowObject } from '../lib/sheets'

type Props = {
  row: SheetRowObject
  highlightKeys?: string[]
}

function entriesForDisplay(row: SheetRowObject): [string, string][] {
  const entries = Object.entries(row).filter(([, v]) => String(v ?? '').trim().length > 0)
  entries.sort(([a], [b]) => a.localeCompare(b))
  return entries
}

export function ResultCard({ row, highlightKeys }: Props) {
  const keys = highlightKeys ?? []

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/30 p-4 shadow-sm">
      <div className="grid gap-2">
        {entriesForDisplay(row).map(([k, v]) => {
          const isHighlight = keys.includes(k)
          return (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-3">
              <div
                className={[
                  'truncate text-xs font-medium',
                  isHighlight ? 'text-violet-200' : 'text-zinc-400',
                ].join(' ')}
                title={k}
              >
                {k}
              </div>
              <div className="min-w-0 text-sm text-zinc-100">
                <div className="wrap-break-word">{v}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

