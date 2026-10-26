import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'border border-border bg-card text-foreground hover:bg-background',
  danger: 'bg-danger text-white hover:opacity-90',
  ghost: 'text-foreground hover:bg-card',
};

export function buttonClass(variant: ButtonVariant = 'primary', extra?: string) {
  return cx(
    'inline-flex min-h-11 items-center whitespace-nowrap justify-center gap-2 rounded-lg px-4 py-2 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
    buttonStyles[variant],
    extra,
  );
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

const fieldClass =
  'block w-full min-h-11 rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground placeholder:text-muted aria-[invalid=true]:border-danger';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldClass, 'min-h-24', className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldClass, className)} {...props} />;
}

export function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {help ? (
        <p id={`${id}-help`} className="text-sm text-muted">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-border bg-card p-5 sm:p-6', className)}>
      {children}
    </section>
  );
}

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'error';
  children: ReactNode;
}) {
  const tones = {
    info: 'border-brand-blue/40 bg-brand-blue/10',
    success: 'border-success/40 bg-success/10',
    error: 'border-danger/40 bg-danger/10',
  };
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('rounded-lg border px-4 py-3 text-sm', tones[tone])}
    >
      {children}
    </div>
  );
}

export function PageTitle({ children, lead }: { children: ReactNode; lead?: ReactNode }) {
  return (
    <header className="mb-6 space-y-2">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{children}</h1>
      {lead ? <p className="text-muted">{lead}</p> : null}
    </header>
  );
}
