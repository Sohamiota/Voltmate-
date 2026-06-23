'use client';

import * as React from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { dateToIso, formatDateDisplay, isoToDate, startOfLocalDay } from '@/lib/dates';

const FILTER_FIELD_CLS =
  'font-sans text-[13px] bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 rounded-[7px] w-full transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-cyan-400 focus:ring-[3px] focus:ring-cyan-400/10 placeholder:text-zinc-500';

const CALENDAR_CLASS_NAMES = {
  months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
  month: 'space-y-4',
  caption: 'flex justify-center pt-1 relative items-center',
  caption_label: 'text-sm font-semibold text-zinc-200',
  nav: 'space-x-1 flex items-center',
  nav_button:
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
  nav_button_previous: 'absolute left-1',
  nav_button_next: 'absolute right-1',
  table: 'w-full border-collapse space-y-1',
  head_row: 'flex',
  head_cell: 'text-zinc-500 rounded-md w-9 font-medium text-[0.72rem] uppercase',
  row: 'flex w-full mt-2',
  cell: 'h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
  day: 'h-9 w-9 p-0 font-normal rounded-md text-zinc-200 hover:bg-zinc-800 aria-selected:opacity-100',
  day_selected:
    'bg-cyan-500 text-zinc-950 hover:bg-cyan-400 hover:text-zinc-950 focus:bg-cyan-500 focus:text-zinc-950',
  day_today: 'bg-zinc-800 text-cyan-400 font-semibold',
  day_outside: 'text-zinc-600 opacity-50',
  day_disabled: 'text-zinc-700 opacity-40',
  day_hidden: 'invisible',
} as const;

export { FILTER_FIELD_CLS as DATE_PICKER_FIELD_CLS };

export interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  id?: string;
  clearable?: boolean;
  align?: 'start' | 'center' | 'end';
}

function isDayOutOfRange(day: Date, min?: string, max?: string): boolean {
  const d = startOfLocalDay(dateToIso(day));
  if (!d) return true;
  const minD = min ? startOfLocalDay(min) : undefined;
  const maxD = max ? startOfLocalDay(max) : undefined;
  if (minD && d < minD) return true;
  if (maxD && d > maxD) return true;
  return false;
}

export default function DatePickerField({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy',
  className,
  disabled,
  min,
  max,
  id,
  clearable = true,
  align = 'start',
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selected = isoToDate(value);

  const isDisabledDay = React.useCallback(
    (day: Date) => isDayOutOfRange(day, min, max),
    [min, max],
  );

  const handleClear = React.useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange('');
    },
    [onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            FILTER_FIELD_CLS,
            'flex items-center justify-between gap-2 text-left',
            !value && 'text-zinc-500',
            disabled && 'opacity-50 cursor-not-allowed',
            className,
          )}
        >
          <span className="truncate">{value ? formatDateDisplay(value) : placeholder}</span>
          <span className="flex items-center gap-1 shrink-0">
            {clearable && value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                onClick={handleClear}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') handleClear(e);
                }}
                aria-label="Clear date"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <CalendarIcon className="h-4 w-4 text-zinc-500" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto p-0 bg-zinc-950 border border-zinc-800 text-zinc-200 shadow-xl shadow-black/40"
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={day => {
            if (!day) return;
            onChange(dateToIso(day));
            setOpen(false);
          }}
          disabled={isDisabledDay}
          initialFocus
          className="rounded-lg"
          classNames={CALENDAR_CLASS_NAMES}
        />
      </PopoverContent>
    </Popover>
  );
}
