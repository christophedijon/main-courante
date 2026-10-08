import { useRef } from 'react';
import { CreditCard } from 'lucide-react';

// Format CNAPS: CAR-XXX-XXXX-XX-XX-XXXXXXXXXXX
// Groups after CAR-: 3, 4, 2, 2, 11 digits (total 22)
const GROUPS = [3, 4, 2, 2, 11];
const TOTAL_DIGITS = 22;

function formatCnaps(raw: string): string {
  // Remove leading "CAR-" (case-insensitive) and spaces
  let cleaned = raw.replace(/\s/g, '');
  const upper = cleaned.toUpperCase();
  // Remove leading CAR- if present (handles paste of full value)
  const withoutPrefix = upper.replace(/^CAR-?/, '');
  // Keep only digits
  const digits = withoutPrefix.replace(/\D/g, '').slice(0, TOTAL_DIGITS);

  const parts: string[] = [];
  let pos = 0;
  for (const len of GROUPS) {
    if (pos >= digits.length) break;
    parts.push(digits.slice(pos, pos + len));
    pos += len;
  }

  if (parts.length === 0) return 'CAR-';
  return 'CAR-' + parts.join('-');
}

function extractDigits(formatted: string): string {
  return formatted.replace(/^CAR-?/i, '').replace(/\D/g, '');
}

export function isValidCnaps(value: string): boolean {
  // Must match CAR-XXX-XXXX-XX-XX-XXXXXXXXXXX exactly
  const match = value.match(/^CAR-(\d{3})-(\d{4})-(\d{2})-(\d{2})-(\d{11})$/);
  if (!match) return false;
  const month = parseInt(match[3], 10);
  const day = parseInt(match[4], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

type Props = {
  value: string;
  onChange: (val: string) => void;
  hasError?: boolean;
};

export default function CnapsInput({ value, onChange, hasError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const selStart = e.target.selectionStart ?? raw.length;

    const rawBeforeCursor = raw.slice(0, selStart);
    const digitsBeforeCursor = rawBeforeCursor.replace(/^CAR-?/i, '').replace(/\D/g, '').length;

    const formatted = formatCnaps(raw);
    onChange(formatted);

    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      const f = formatted;
      let digitsSeen = 0;
      let newPos = f.length;
      for (let i = 0; i < f.length; i++) {
        if (digitsSeen === digitsBeforeCursor) {
          newPos = i;
          break;
        }
        if (/\d/.test(f[i])) digitsSeen++;
      }
      if (digitsSeen < digitsBeforeCursor) newPos = f.length;
      inputRef.current.setSelectionRange(newPos, newPos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const input = inputRef.current;
    if (!input) return;

    const selStart = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;
    const PREFIX_LEN = 4; // "CAR-"

    if ((e.key === 'Backspace' || e.key === 'Delete') && selStart === selEnd) {
      if (e.key === 'Backspace' && selStart <= PREFIX_LEN) {
        e.preventDefault();
        return;
      }
      if (e.key === 'Delete' && selStart < PREFIX_LEN) {
        e.preventDefault();
        return;
      }
    }

    if ((e.key === 'Backspace' || e.key === 'Delete') && selStart < PREFIX_LEN && selEnd > selStart) {
      e.preventDefault();
    }
  }

  function handleFocus() {
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    });
  }

  const incomplete = value.length > 4 && !isValidCnaps(value);
  const digits = extractDigits(value);
  const showIncomplete = incomplete && digits.length > 0 && digits.length < TOTAL_DIGITS;
  const formatError = incomplete && digits.length === TOTAL_DIGITS;

  return (
    <div>
      <div className="relative">
        <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={value || 'CAR-'}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="CAR-021-2026-11-26-20210140455"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          className={`w-full bg-slate-800 border rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm font-mono
            focus:outline-none focus:ring-2 focus:border-transparent transition-all tracking-wide
            ${hasError || showIncomplete || formatError
              ? 'border-red-500/60 focus:ring-red-500'
              : isValidCnaps(value)
                ? 'border-emerald-500/50 focus:ring-emerald-500'
                : 'border-slate-700 focus:ring-blue-500'}`}
        />
        {isValidCnaps(value) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
      {showIncomplete && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
          <svg viewBox="0 0 16 16" className="w-3 h-3 shrink-0" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 5zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
          Numéro de carte professionnelle incomplet
        </p>
      )}
      {formatError && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
          <svg viewBox="0 0 16 16" className="w-3 h-3 shrink-0" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 5zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
          Format attendu : 021-2026-11-26-20210140455
        </p>
      )}
    </div>
  );
}
