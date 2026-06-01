/** Text wordmark — voltwheels-logo.png is Euler artwork, so we use typography for Volt Wheels. */
export function VoltWheelsWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`bill-vw-mark bill-vw-mark-${size}`} aria-label="Volt Wheels">
      <span className="bill-vw-mark-volt">VOLT</span>
      <span className="bill-vw-mark-wheels">WHEELS</span>
    </div>
  );
}

export function EulerLogo({ className = 'bill-euler-mark' }: { className?: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src="/branding/euler-logo-black.png" alt="Euler Motors" className={className} />
  );
}
