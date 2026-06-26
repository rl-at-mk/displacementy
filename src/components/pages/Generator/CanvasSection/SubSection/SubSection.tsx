import clsx from 'clsx';

export function SubSection({
  disabled,
  title,
  hint,
  children,
}: {
  readonly disabled?: boolean;
  readonly title: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className={clsx('pt-4', disabled && 'opacity-50')}>
      <h2 className='pb-1'>{title}</h2>
      <div className={clsx(disabled && 'pointer-events-none')}>{children}</div>
      {disabled && hint && (
        <p className='pt-1 text-xs text-white/70 italic'>{hint}</p>
      )}
    </div>
  );
}
