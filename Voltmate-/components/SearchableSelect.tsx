'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SSOption { value: string; label: string; }

interface SearchableSelectProps {
  options: (string | SSOption)[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyLabel?: string;        // e.g. "All statuses" — adds a blank first option
  disabled?: boolean;
  id?: string;
  /** CSS class to apply to the trigger button so it matches existing field styles */
  fieldClass?: string;
  /** Extra inline style for the trigger button */
  fieldStyle?: React.CSSProperties;
  /** Accent colour for focused search input border (default #00c9b1) */
  accentColor?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  emptyLabel,
  disabled,
  id,
  fieldClass,
  fieldStyle,
  accentColor = '#00c9b1',
}: SearchableSelectProps) {
  const [open,      setOpen]      = useState(false);
  const [query,     setQuery]     = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalise to { value, label }
  const normalised: SSOption[] = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  );
  const allOpts: SSOption[] = emptyLabel
    ? [{ value: '', label: emptyLabel }, ...normalised]
    : normalised;

  const filtered = query.trim()
    ? allOpts.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : allOpts;

  const selected    = allOpts.find(o => o.value === value);
  const displayLabel = selected?.label ?? '';

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setHighlight(0);
    setTimeout(() => inputRef.current?.focus(), 20);
  }

  const closeDropdown = useCallback(() => { setOpen(false); setQuery(''); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeDropdown();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, closeDropdown]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && filtered[highlight]) {
      e.preventDefault();
      onChange(filtered[highlight].value);
      closeDropdown();
    }
    if (e.key === 'Escape') closeDropdown();
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      {/* ── Trigger button — inherits the page's field class ── */}
      <button
        id={id}
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        className={fieldClass}
        style={{
          width: '100%',
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          userSelect: 'none',
          backgroundImage: 'none',   // override the select arrow SVG bg
          ...fieldStyle,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {displayLabel
            ? displayLabel
            : <span style={{ opacity: .4 }}>{placeholder}</span>
          }
        </span>
        {/* Chevron */}
        <svg
          width="11" height="11" viewBox="0 0 12 12"
          fill="currentColor"
          style={{ flexShrink: 0, opacity: .45, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        >
          <path d="M6 8L1 3h10z"/>
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: '#141720',
          border: '1px solid #272b40',
          borderRadius: 9,
          boxShadow: '0 10px 32px rgba(0,0,0,.7)',
          overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e2236' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlight(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search…"
              style={{
                width: '100%',
                background: '#0e1118',
                border: `1px solid #1e2236`,
                borderRadius: 6,
                padding: '7px 10px',
                color: '#dde3f0',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color .15s',
              }}
              onFocus={e  => (e.target.style.borderColor = accentColor)}
              onBlur={e   => (e.target.style.borderColor = '#1e2236')}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 13, color: '#4b5268' }}>No matches</div>
            ) : (
              filtered.map((o, i) => (
                <div
                  key={o.value === '' ? '__empty__' : o.value}
                  onMouseDown={e => { e.preventDefault(); onChange(o.value); closeDropdown(); }}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    padding: '9px 14px',
                    fontSize: 13,
                    cursor: 'pointer',
                    color: o.value === value ? accentColor : '#dde3f0',
                    fontWeight: o.value === value ? 600 : 400,
                    background: i === highlight
                      ? `rgba(0,0,0,.22)`
                      : o.value === value
                        ? 'rgba(0,201,177,.06)'
                        : 'transparent',
                    borderBottom: i < filtered.length - 1 ? '1px solid #1e2236' : 'none',
                    transition: 'background .08s',
                  }}
                >
                  {o.label || <span style={{ color: '#4b5268', fontStyle: 'italic' }}>—</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
