import Link from 'next/link';

/**
 * The KitabX wordmark in app headers — tapping it goes back to Discover,
 * the way a site logo normally returns you home.
 */
export default function BrandLogo({ href = '/home', className = '', style }) {
  return (
    <Link
      href={href}
      className={`logo-badge ${className}`.trim()}
      style={style}
      aria-label="KitabX — go to Discover"
    />
  );
}
