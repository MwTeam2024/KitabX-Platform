'use client';

import { useRouter } from 'next/navigation';
import Icon from './Icon';
import BrandLogo from '@/components/layout/BrandLogo';

/**
 * The curved cream header at the top of every screen.
 * `variant="main"` = tall home-style header (logo + actions + children),
 * `variant="sub"`  = short back-button header with a title.
 */
export default function ScreenHeader({
  title,
  subtitle,
  back,
  backHref,
  right,
  children,
  className = '',
  style,
}) {
  const router = useRouter();

  const goBack = () => {
    if (backHref) router.push(backHref);
    else router.back();
  };

  return (
    <header className={`hdr ${className}`} style={style}>
      <div className="hdr-row">
        <div className="flex items-center gap-2.5 min-w-0">
          {back && (
            <button className="circle-btn" onClick={goBack} aria-label="Go back" style={{ flexShrink: 0 }}>
              <Icon name="arrowLeft" />
            </button>
          )}
          {title ? (
            <div className="min-w-0">
              <div className="hdr-title" style={{ fontSize: 17 }}>{title}</div>
              {subtitle && <div className="hdr-sub">{subtitle}</div>}
            </div>
          ) : (
            <BrandLogo />
          )}
        </div>
        {right}
      </div>
      {children}
    </header>
  );
}

/** Step counter + progress bar shown across the add-book wizard. */
export function StepProgress({ label, percent }) {
  return (
    <>
      <div className="step-label">{label}</div>
      <div className="step-bar"><i style={{ width: `${percent}%` }} /></div>
    </>
  );
}
