import { Layers } from 'lucide-react'
import type { SheetRowObject } from '../lib/sheets'
import { ResultCard } from './ResultCard'

type Props = {
  title: string
  rows: SheetRowObject[]
  query: string
}

export function SheetSection({ title, rows }: Props) {
  return (
    <section className="rounded-2xl bg-zinc-900/40 p-4 ring-1 ring-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        </div>
        <div className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-xs text-zinc-300">
          {rows.length}건
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((row, idx) => (
          <ResultCard key={idx} row={row} highlightKeys={['상품명', '상품명(필수)', 'productName']} />
        ))}
      </div>
    </section>
  )
}

