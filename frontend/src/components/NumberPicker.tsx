import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Check, X } from 'lucide-react';

interface NumberPickerProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

function parseNumbers(value: string): string[] {
  return value
    .split(/[^0-9]+/)
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => n.padStart(2, '0'));
}

function formatNumbers(numbers: string[]): string {
  return numbers.join(',');
}

export function NumberPicker({ value, onChange, children }: NumberPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(parseNumbers(value)));
  const [open, setOpen] = useState(false);

  const toggle = (n: string) => {
    const next = new Set(selected);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setSelected(next);
  };

  const handleApply = () => {
    const sorted = Array.from(selected).sort((a, b) => parseInt(a) - parseInt(b));
    onChange(formatNumbers(sorted));
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(new Set());
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setSelected(new Set(parseNumbers(value)));
    }
  };

  const numbers = Array.from({ length: 60 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start">
          <Popover.Popup className="z-50 w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl outline-none">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">Selecione as dezenas</span>
              <Popover.Close
                className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={16} />
              </Popover.Close>
            </div>
            <div className="grid grid-cols-10 gap-2">
              {numbers.map((n) => {
                const isSelected = selected.has(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggle(n)}
                    className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      isSelected
                        ? 'bg-blue-700 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-blue-50'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? <Check size={12} /> : n}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-800"
              >
                Aplicar ({selected.size})
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
