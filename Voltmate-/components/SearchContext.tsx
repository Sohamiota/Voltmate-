'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type SearchContextValue = {
  query: string
  setQuery: (q: string) => void
  clearQuery: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  const clearQuery = useCallback(() => setQuery(''), [])
  return (
    <SearchContext.Provider value={{ query, setQuery, clearQuery }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error('useSearch must be used within SearchProvider')
  }
  return ctx
}

/** Local page search takes priority; falls back to header search. */
export function useEffectiveSearch(localQuery: string): string {
  const { query: globalQuery } = useSearch()
  return localQuery.trim() || globalQuery.trim()
}
