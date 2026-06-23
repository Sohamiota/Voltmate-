'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useSearch } from '@/components/SearchContext'
import { filterSearchEntries, getSearchEntriesForRole, type NavRole } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface GlobalSearchProps {
  userRole: NavRole
  className?: string
}

export default function GlobalSearch({ userRole, className }: GlobalSearchProps) {
  const router = useRouter()
  const { query, setQuery, clearQuery } = useSearch()
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const entries = useMemo(() => getSearchEntriesForRole(userRole), [userRole])
  const navResults = useMemo(() => filterSearchEntries(entries, query), [entries, query])

  const close = useCallback(() => {
    setOpen(false)
    setHighlight(0)
  }, [])

  const goTo = useCallback((route: string) => {
    router.push(route)
    close()
    inputRef.current?.blur()
  }, [router, close])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, close])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      close()
      inputRef.current?.blur()
      return
    }
    if (navResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, navResults.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const target = navResults[highlight]
      if (target) goTo(target.route)
    }
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search pages or filter lists…"
          aria-label="Search pages or filter lists"
          className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm w-full min-w-0"
        />
        {query && (
          <button
            type="button"
            onClick={() => { clearQuery(); close() }}
            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-[100] bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[260px]">
          {navResults.length > 0 ? (
            <>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
                Go to page
              </div>
              <ul>
                {navResults.map((item, i) => (
                  <li key={item.route}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); goTo(item.route) }}
                      onMouseEnter={() => setHighlight(i)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-sm transition-colors',
                        i === highlight ? 'bg-secondary text-foreground' : 'text-foreground hover:bg-secondary/70',
                      )}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{item.route}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No pages match. The search still filters data on this page.
            </div>
          )}
          <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border bg-secondary/30">
            Tip: use page search boxes for detailed filters, or pick a page above.
          </div>
        </div>
      )}
    </div>
  )
}
