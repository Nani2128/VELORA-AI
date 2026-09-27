import React from 'react';
import { useSound } from '../../lib/sound';
import { triggerHaptic } from '../../lib/haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  const { play } = useSound();

  const handleSelect = (val: T) => {
    if (val === value) return;
    play('toggle');
    triggerHaptic('light');
    onChange(val);
  };

  const sizeClasses = {
    sm: 'p-0.5 text-xs',
    md: 'p-1 text-sm',
  };

  const buttonSizeClasses = {
    sm: 'px-2.5 py-1 gap-1.5',
    md: 'px-3.5 py-1.5 gap-2',
  };

  return (
    <div
      role="tablist"
      className={`inline-flex items-center bg-[#10131B] border border-white/10 rounded-xl ${sizeClasses[size]} ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isSelected}
            onClick={() => handleSelect(opt.value)}
            className={`relative flex items-center justify-center font-medium rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer select-none ${
              buttonSizeClasses[size]
            } ${
              isSelected
                ? 'bg-[#1F2433] text-white shadow-sm border border-white/15'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
            {opt.badge !== undefined && (
              <span className="text-[11px] font-mono-numbers px-1.5 py-0.2 bg-white/10 rounded-md text-slate-300">
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
