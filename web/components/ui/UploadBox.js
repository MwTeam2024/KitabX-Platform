'use client';

import { useRef, useState } from 'react';
import Icon from './Icon';
import { resizeImageFile } from '@/lib/image';

/**
 * Camera/file picker. Images are resized client-side before they'd be uploaded,
 * which the PWA spec (§17) requires. Falls back gracefully if resizing fails.
 */
export default function UploadBox({
  label = 'Tap to take / upload cover image',
  hint = 'JPG or PNG',
  minHeight,
  onFile,
  resizeOptions,
}) {
  const inputRef = useRef(null);
  const [done, setDone] = useState(false);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(true);
    try {
      const resized = await resizeImageFile(file, resizeOptions);
      onFile?.(resized);
    } catch {
      onFile?.(file);
    }
  };

  return (
    <>
      <button
        type="button"
        className="upload-box"
        style={{
          minHeight,
          ...(done
            ? { borderStyle: 'solid', background: 'linear-gradient(135deg,#DDD3B5,#C7B98D)', color: '#fff' }
            : null),
        }}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name={done ? 'check' : 'camera'} style={done ? { color: '#fff' } : undefined} />
        <b style={done ? { color: '#fff' } : undefined}>{done ? 'Photo added' : label}</b>
        <span style={done ? { color: 'rgba(255,255,255,.8)' } : undefined}>
          {done ? 'Tap to replace' : hint}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleChange}
      />
    </>
  );
}
