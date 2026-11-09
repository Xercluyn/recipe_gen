import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-meta">
        <span className="progress-label">{label}</span>
        <span className="progress-pct">{pct}%</span>
      </div>
    </div>
  );
}

/** Segmented single-choice control. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'seg on' : 'seg'}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Delete-style button with an inline "are you sure?" step instead of confirm(). */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel,
  className = 'btn danger-ghost',
}: {
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  confirmLabel?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }
  return (
    <div className="confirm-row" role="group">
      <span className="confirm-q">{t('common.confirmDelete')}</span>
      <button type="button" className="btn ghost small" onClick={() => setAsking(false)}>
        {t('common.cancel')}
      </button>
      <button
        type="button"
        className="btn danger small"
        onClick={async () => {
          await onConfirm();
          setAsking(false);
        }}
      >
        {confirmLabel ?? t('common.yes')}
      </button>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** Playful loading mark: four bento squares hopping in turn. */
export function BentoHop() {
  return (
    <span className="hop" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

const paths: Record<string, string> = {
  pot: 'M3 11h14v3.5A4.5 4.5 0 0 1 12.5 19h-5A4.5 4.5 0 0 1 3 14.5V11Zm14 2h4M7.5 7.5c0-1.2 1.2-1.2 1.2-2.5M11.5 7.5c0-1.2 1.2-1.2 1.2-2.5',
  bookmark: 'M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1Z',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.5a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1L15 3h-4l-.3 2.5a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 1.7 1L11 21h4l.3-2.5a7.3 7.3 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6Z',
  sliders: 'M4 7h9M18 7h2M4 17h4M13 17h7M15.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10.5 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2M10 2.5h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  users:
    'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2',
  yen: 'M6 3l6 8 6-8M12 11v10M7 13h10M7 17h10',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z',
  back: 'M15 5l-7 7 7 7',
  search: 'M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5-1.5 4.5 4.5',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M6 12h12M12 6v12',
  minus: 'M6 12h12',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  sparkle: 'M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  fridge: 'M8 2.5h8a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3ZM5 10h14M9 6v1.5M9 13.5v3',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z',
  box: 'M4 7.5 12 3.5l8 4v9l-8 4-8-4v-9Zm0 0 8 4 8-4M12 11.5v9',
  download: 'M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M5 19.5h14',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.5v.01',
  alert: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5v5.5M12 16.5v.01',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.5-2.8M11 6a15 15 0 0 1 11 3.5M12 20h.01',
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  filled = false,
  size = 22,
  stroke = 2,
}: {
  name: IconName;
  filled?: boolean;
  size?: number;
  stroke?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icon"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Rounded -/+ stepper. The value is announced politely when it changes. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  decLabel,
  incLabel,
  children,
  labelledBy,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  decLabel: string;
  incLabel: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <div className="stepper-ctl" role="group" aria-labelledby={labelledBy}>
      <button
        type="button"
        className="step-btn"
        aria-label={decLabel}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Icon name="minus" size={18} stroke={2.5} />
      </button>
      <output className="step-value" aria-live="polite">
        {children}
      </output>
      <button
        type="button"
        className="step-btn plus"
        aria-label={incLabel}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Icon name="plus" size={18} stroke={2.5} />
      </button>
    </div>
  );
}

/** Decorative 2x2 bento mark used in page headers. */
export function BentoLogo() {
  return (
    <span className="bento-logo" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
