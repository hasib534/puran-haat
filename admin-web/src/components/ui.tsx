import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

import { initials } from '../lib/format';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

export function Icon({
  name,
  className = '',
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span aria-hidden className={`material-symbols-outlined ${filled ? 'fill' : ''} ${className}`}>
      {name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

const AVATAR_SIZES = {
  sm: 'h-9 w-9 text-[13px]',
  md: 'h-11 w-11 text-[15px]',
  lg: 'h-16 w-16 text-[22px]',
  xl: 'h-24 w-24 text-[30px]',
} as const;

export function Avatar({
  src,
  name,
  size = 'md',
}: {
  src?: string;
  name: string;
  size?: keyof typeof AVATAR_SIZES;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${AVATAR_SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-surface-container-low`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${AVATAR_SIZES[size]} flex shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-on-secondary-container`}
    >
      {initials(name) || 'PH'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pills / chips
// ---------------------------------------------------------------------------

const PILL_TONES = {
  ok: 'bg-primary-fixed text-on-primary-fixed',
  info: 'bg-secondary-container text-on-secondary-container',
  warn: 'bg-tertiary-fixed text-on-tertiary-fixed',
  danger: 'bg-error-container text-on-error-container',
  neutral: 'bg-surface-container text-on-surface-variant',
} as const;

export function Pill({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: keyof typeof PILL_TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-md ${PILL_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-container shadow-sm shadow-primary/20',
  secondary: 'border border-primary/25 text-primary hover:bg-primary-fixed/40',
  danger: 'bg-error text-on-error hover:bg-error/90',
  neutral: 'bg-surface-container text-on-surface hover:bg-surface-container-high',
  ghost: 'text-on-surface-variant hover:bg-surface-container',
} as const;

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-label-md gap-1',
  md: 'px-4 py-2.5 text-label-md gap-1.5',
  lg: 'px-6 py-3 text-body-sm font-semibold gap-2',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  icon?: string;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icon ? (
        <Icon name={icon} className="text-[18px]" />
      ) : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl border border-surface-variant/60 bg-surface-container-lowest p-md shadow-sm shadow-primary/5 ${className}`}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-headline-md font-semibold text-on-surface">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-xs">{children}</div> : null}
    </div>
  );
}

export function StatCard({
  icon,
  value,
  label,
  hint,
  tone = 'primary',
  onClick,
}: {
  icon: string;
  value: number | string;
  label: string;
  hint?: string;
  tone?: 'primary' | 'tertiary' | 'danger';
  onClick?: () => void;
}) {
  const shell = `flex w-full flex-col gap-sm rounded-xl border border-surface-variant/60 bg-surface-container-lowest p-md text-left shadow-sm shadow-primary/5 transition-shadow ${
    onClick ? 'hover:shadow-md' : ''
  }`;
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            tone === 'tertiary'
              ? 'bg-tertiary-container/20 text-tertiary'
              : tone === 'danger'
                ? 'bg-error-container text-error'
                : 'bg-primary-container/20 text-primary'
          }`}
        >
          <Icon name={icon} className="text-[20px]" />
        </span>
        <span
          className={`text-headline-md font-semibold ${
            tone === 'danger' ? 'text-error' : 'text-primary'
          }`}
        >
          {value}
        </span>
      </div>
      <div>
        <h3 className="text-body-md font-semibold text-on-surface">{label}</h3>
        {hint ? <p className="mt-0.5 text-body-sm text-on-surface-variant">{hint}</p> : null}
      </div>
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={`${shell} cursor-pointer`}>
      {content}
    </button>
  ) : (
    <div className={shell}>{content}</div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  children,
}: {
  icon?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/70 bg-surface-container-low/60 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-outline">
        <Icon name={icon} className="text-[26px]" />
      </span>
      <h3 className="text-body-md font-semibold text-on-surface">{title}</h3>
      {description ? (
        <p className="max-w-[28rem] text-body-sm text-on-surface-variant">{description}</p>
      ) : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-on-surface-variant">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary/25 border-t-primary" />
      <p className="text-body-sm">{label}</p>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-error/25 bg-error-container/60 px-3 py-2 text-body-sm text-on-error-container">
      <Icon name="error" className="text-[18px]" />
      <span>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

export const inputClass =
  'w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-3 py-2.5 text-body-sm text-on-surface outline-none transition-colors placeholder:text-outline/70 focus:border-primary';

export function Field({
  label,
  hint,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-label-md text-on-surface">
        {label}
        {required ? <span className="text-error"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-body-sm text-on-surface-variant">{hint}</span> : null}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[32rem] rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-md shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-headline-sm text-on-surface">{title}</h3>
            {description ? (
              <p className="mt-1 text-body-sm text-on-surface-variant">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        {children ? <div className="mt-md">{children}</div> : null}
        {footer ? <div className="mt-md flex justify-end gap-xs">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Button that asks for confirmation in a modal before running its action. */
export function ConfirmButton({
  label,
  icon,
  variant = 'primary',
  size = 'sm',
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  disabled,
  className = '',
}: {
  label: string;
  icon?: string;
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={className}
      >
        {label}
      </Button>
      <Modal
        open={open}
        title={title}
        description={message}
        onClose={() => (busy ? undefined : setOpen(false))}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onClick={run}
              loading={busy}
            >
              {confirmLabel}
            </Button>
          </>
        }
      />
    </>
  );
}