/**
 * Book cover. Renders the real uploaded photo when one exists (`book.photos[0]`
 * or an explicit `photoUrl` override for paging through photos 2/3 on the
 * detail screen); falls back to the generated placeholder — emblem + title —
 * only for listings that genuinely have no real photo (e.g. legacy/bulk-add
 * entries where no upload happened yet).
 */

import { cldThumb } from '@/lib/cloudinary';

function RealPhoto({ src, className, style }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />
  );
}

/** Small/medium cover: emblem + uppercase title + author, or the real photo. */
export function BookCover({ book, className = '', style, showAuthor = false, titleSize, photoUrl }) {
  const src = photoUrl || book.photos?.[0];
  if (src) {
    return <div className={`bcov ${className}`} style={{ ...style, padding: 0, overflow: 'hidden' }}><RealPhoto src={cldThumb(src, { w: 240 })} /></div>;
  }
  return (
    <div className={`bcov ${book.cov} ${className}`} style={style}>
      {book.em && <div className="bcov-emblem">{book.em}</div>}
      <div className="bcov-title" style={titleSize ? { fontSize: titleSize } : undefined}>
        {book.title}
      </div>
      {showAuthor && book.author && <div className="bcov-author">{book.author}</div>}
    </div>
  );
}

/** Spine-only thumbnail used in shelf rows and exchange minis. */
export function BookSpine({ book, className = '', style, titleSize = 9 }) {
  const src = book.photos?.[0];
  if (src) {
    return <div className={`bcov ${className}`} style={{ width: '100%', height: '100%', padding: 0, overflow: 'hidden', ...style }}><RealPhoto src={cldThumb(src, { w: 120 })} /></div>;
  }
  return (
    <div className={`bcov ${book.cov} ${className}`} style={{ width: '100%', height: '100%', ...style }}>
      <div className="bcov-title" style={{ fontSize: titleSize }}>{book.title}</div>
    </div>
  );
}

/** Large detail cover: author top, emblem, title, subtitle, sindoor mark — or the real photo. */
export function BookCoverDetail({ book, className = '', style, photoUrl }) {
  const src = photoUrl || book.photos?.[0];
  if (src) {
    return <div className={`bcov-detail ${className}`} style={{ ...style, padding: 0, overflow: 'hidden' }}><RealPhoto src={src} /></div>;
  }
  return (
    <div className={`bcov-detail ${book.cov} ${className}`} style={style}>
      <div className="bcd-author">{book.author}</div>
      <div className="bcd-emblem">{book.em}</div>
      <div className="bcd-title">{book.title}</div>
      {book.subtitle && <div className="bcd-subtitle">{book.subtitle}</div>}
      <div className="bcd-mark" />
    </div>
  );
}
