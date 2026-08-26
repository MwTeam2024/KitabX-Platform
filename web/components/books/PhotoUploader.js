'use client';

import { useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { resizeImageFile } from '@/lib/image';
import { uploadsService } from '@/services/uploads.service';
import { useToast } from '@/components/ui/ToastProvider';

const MAX_PHOTOS = 3;
const SLOT_LABELS = ['Cover', 'Photo 2', 'Photo 3'];

/**
 * Three fixed slots in one row — slot 1 is always the cover (shown first
 * everywhere in the app, per `BookCover.js`); slots 2-3 are condition photos
 * and unlock in order, so `photos[0]` is always the cover and removing a
 * photo shifts the rest up instead of leaving a hole.
 */
export default function PhotoUploader({ photos = [], onChange }) {
  const inputRefs = useRef([]);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const showToast = useToast();

  const handleFile = async (slot, file) => {
    if (!file) return;
    setUploadingSlot(slot);
    try {
      const resized = await resizeImageFile(file).catch(() => file);
      const { url } = await uploadsService.uploadListingPhoto(resized);
      const next = [...photos];
      next[slot] = url;
      onChange(next.slice(0, MAX_PHOTOS));
    } catch (err) {
      showToast(err.message || 'Could not upload this photo');
    } finally {
      setUploadingSlot(null);
    }
  };

  const remove = (slot) => onChange(photos.filter((_, i) => i !== slot));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map((slot) => {
          const url = photos[slot];
          const locked = slot > 0 && !photos[slot - 1];
          return (
            <div key={slot} style={{ flex: 1, minWidth: 0 }}>
              {url ? (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 10, overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={SLOT_LABELS[slot]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {slot === 0 && (
                    <span
                      style={{
                        position: 'absolute', top: 4, left: 4, fontSize: 9, fontWeight: 700, padding: '2px 6px',
                        borderRadius: 5, background: 'rgba(0,0,0,.55)', color: '#fff',
                      }}
                    >
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    className="circle-btn"
                    style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, background: 'rgba(0,0,0,.55)', color: '#fff' }}
                    onClick={() => remove(slot)}
                    aria-label={`Remove ${SLOT_LABELS[slot]}`}
                  >
                    <Icon name="x" style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="upload-box"
                  style={{ width: '100%', aspectRatio: '1', minHeight: 0, padding: 0, opacity: locked ? 0.5 : 1 }}
                  onClick={() => inputRefs.current[slot]?.click()}
                  disabled={locked || uploadingSlot === slot}
                >
                  <Icon name="camera" />
                  <span style={{ fontSize: 10 }}>{uploadingSlot === slot ? 'Uploading…' : SLOT_LABELS[slot]}</span>
                </button>
              )}
              <input
                ref={(el) => { inputRefs.current[slot] = el; }}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => { handleFile(slot, e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        {photos.length}/{MAX_PHOTOS} photos added — the cover is shown first everywhere
      </div>
    </div>
  );
}
