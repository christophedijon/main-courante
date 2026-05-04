import { useRef } from 'react';
import { CreditCard } from 'lucide-react';

// Format: CAR-XX-XXXX-XX-XX-XXXXXXXX
// Digits groups after CAR: 2, 4, 2, 2, 8  (total 18 digits)
const GROUPS = [2, 4, 2, 2, 8];

function formatCnaps(raw: string): string {
  // Strip "CAR" prefix (case-insensitive) and any non-digit characters
  const upper = raw.toUpperCase();
  // Remove leading CAR if present
  const withoutPrefix = upper.replace(/^CAR-?/, '');
  // Keep only digits
  const digits = withoutPrefix.replace(/\D/g, '').slice(0, 18);

  // Build formatted string
  const parts: string[] = [];
  let pos = 0;
  for (const len of GROUPS) {
    if (pos >= digits.length) break;
    parts.push(digits.slice(pos, pos + len));
    pos += len;
  }

  if (parts.length === 0) return 'CAR';
  return 'CAR-' + parts.join('-');
}

function extractDigits(formatted: string): string {
  return formatted.replace(/^CAR-?/, '').replace(/\D/g, '');
}

export function isValidCnaps(value: string): boolean {
  // Must match CAR-XX-XXXX-XX-XX-XXXXXXXX exactly
  return /^CAR-\d{2}-\d{4}-\d{2}-\d{2}-\d{8}$/.test(value);
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

    // Count digits before cursor position in raw input
    const rawBeforeCursor = raw.slice(0, selStart);
    const digitsBeforeCursor = rawBeforeCursor.replace(/^CAR-?/i, '').replace(/\D/g, '').length;

    const formatted = formatCnaps(raw);
    onChange(formatted);

    // Restore cursor: count through formatted string to find position after same number of digits
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
      // If we consumed all target digits, position after last digit
      if (digitsSeen < digitsBeforeCursor) newPos = f.length;
      inputRef.current.setSelectionRange(newPos, newPos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const input = inputRef.current;
    if (!input) return;

    // Prevent deleting the "CAR-" prefix
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

    // If selection covers the prefix, prevent deletion
    if ((e.key === 'Backspace' || e.key === 'Delete') && selStart < PREFIX_LEN && selEnd > selStart) {
      e.preventDefault();
    }
  }

  function handleFocus() {
    // Always place cursor at the end or after last digit
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    });
  }

  const incomplete = value.length > 4 && !isValidCnaps(value);
  const digits = extractDigits(value);
  const showIncomplete = incomplete && digits.length > 0 && digits.length < 18;

  return (
    <div>
      <div className="relative">
        <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value || 'CAR'}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="CAR-12-3456-78-90-12345678"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={28}
          className={`w-full bg-slate-800 border rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm font-mono
            focus:outline-none focus:ring-2 focus:border-transparent transition-all tracking-wide
            ${hasError || showIncomplete
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
    </div>
  );
}
