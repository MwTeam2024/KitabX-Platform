'use client';

import { useRef, useState, useEffect } from 'react';

const LENS_SIZE = 120;
const ZOOM = 2.5;
const DRAG_THRESHOLD = 8;

/**
 * A loupe that follows the pointer: on mouse+hover devices it tracks the
 * cursor; on touch it tracks a finger press-and-drag instead (touch has no
 * "hover" to hook into). Tracks the image's own natural size so the lens
 * lines up correctly even when the container's aspect ratio doesn't match
 * the photo's own (the `object-fit: contain` letterboxing case) instead of
 * assuming the photo fills the box edge to edge.
 *
 * The caller wraps this in a `<button onClick>` for tap-to-fullscreen — a
 * plain tap still reaches that click, but a touch that actually *dragged*
 * (inspecting via the lens) suppresses it, so lifting the finger after
 * dragging doesn't also pop the fullscreen viewer open.
 */
export default function ImageMagnifier({ src, alt = '', style, imgStyle, maxWidth, maxHeight }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [supportsHover, setSupportsHover] = useState(false);
  const [lens, setLens] = useState(null);
  const touchStartRef = useRef(null);
  const draggedRef = useRef(false);
  // Only set when maxWidth/maxHeight are given — the caller wants the box to
  // hug the photo's own (capped) size instead of a fixed box handed down
  // from outside, so there's never a letterboxing gap to account for.
  const [intrinsicSize, setIntrinsicSize] = useState(null);
  const sizeFromProps = maxWidth != null || maxHeight != null;

  const onImgLoad = () => {
    if (!sizeFromProps || !imgRef.current) return;
    const { naturalWidth: w, naturalHeight: h } = imgRef.current;
    const scale = Math.min(
      maxWidth != null ? maxWidth / w : Infinity,
      maxHeight != null ? maxHeight / h : Infinity,
      1,
    );
    let width = w * scale;
    let height = h * scale;
    // A landscape photo capped only by maxHeight can still end up wider than
    // whatever space its parent actually has (e.g. a wide bulk-upload bundle
    // shot on a narrow phone) — shrink further to fit, preserving aspect
    // ratio, rather than overflowing the column horizontally.
    const parentWidth = containerRef.current?.parentElement?.clientWidth;
    if (parentWidth && width > parentWidth) {
      const shrink = parentWidth / width;
      width *= shrink;
      height *= shrink;
    }
    setIntrinsicSize({ width, height });
  };

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setSupportsHover(mq.matches);
    const onChange = (e) => setSupportsHover(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setIntrinsicSize(null);
    setLens(null);
  }, [src]);

  const updateLensAt = (clientX, clientY) => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container || !img.naturalWidth) return;

    const rect = container.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // The rendered (letterboxed) image rect within the container, matching
    // `object-fit: contain` — the lens has to track this, not the container
    // itself, or it drifts off the actual picture whenever the aspect
    // ratios don't match.
    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const renderedW = img.naturalWidth * scale;
    const renderedH = img.naturalHeight * scale;
    const offsetX = (rect.width - renderedW) / 2;
    const offsetY = (rect.height - renderedH) / 2;

    const ix = mx - offsetX;
    const iy = my - offsetY;
    if (ix < 0 || iy < 0 || ix > renderedW || iy > renderedH) {
      setLens(null);
      return;
    }

    const fx = ix / renderedW;
    const fy = iy / renderedH;
    const bgW = renderedW * ZOOM;
    const bgH = renderedH * ZOOM;
    setLens({
      lensX: mx, lensY: my,
      bgSize: `${bgW}px ${bgH}px`,
      bgPosX: -(fx * bgW - LENS_SIZE / 2),
      bgPosY: -(fy * bgH - LENS_SIZE / 2),
    });
  };

  const handleMouseMove = (e) => updateLensAt(e.clientX, e.clientY);

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    draggedRef.current = false;
    updateLensAt(t.clientX, t.clientY);
  };

  const handleTouchMove = (e) => {
    const t = e.touches[0];
    const start = touchStartRef.current;
    if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > DRAG_THRESHOLD) {
      draggedRef.current = true;
    }
    updateLensAt(t.clientX, t.clientY);
  };

  const handleTouchEnd = () => setLens(null);

  // Swallows the click that would otherwise follow a drag-to-inspect touch —
  // a plain tap (no drag) still reaches the wrapping button's onClick.
  const handleClickCapture = (e) => {
    if (draggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      draggedRef.current = false;
    }
  };

  const containerSize = sizeFromProps
    ? { width: intrinsicSize?.width ?? maxWidth ?? 'auto', height: intrinsicSize?.height ?? maxHeight ?? 'auto' }
    : { width: '100%', height: '100%' };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', touchAction: 'none', ...containerSize, ...style }}
      onMouseMove={supportsHover ? handleMouseMove : undefined}
      onMouseLeave={() => setLens(null)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClickCapture={handleClickCapture}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={onImgLoad}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', ...imgStyle }}
      />
      {lens && (
        <div
          style={{
            position: 'absolute', top: lens.lensY - LENS_SIZE / 2, left: lens.lensX - LENS_SIZE / 2,
            width: LENS_SIZE, height: LENS_SIZE, borderRadius: '50%',
            border: '2px solid #fff', boxShadow: '0 2px 14px rgba(0,0,0,.35)',
            backgroundColor: '#fff',
            backgroundImage: `url(${src})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: lens.bgSize,
            backgroundPosition: `${lens.bgPosX}px ${lens.bgPosY}px`,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
