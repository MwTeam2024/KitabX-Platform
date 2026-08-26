'use client';

import { useState } from 'react';
import UploadBox from '@/components/ui/UploadBox';
import { useToast } from '@/components/ui/ToastProvider';
import { uploadsService } from '@/services/uploads.service';

/**
 * Reason + description + optional screenshot, shared by every report sheet (§14).
 * `blockLabel` adds the "also block this user" checkbox required for user reports.
 */
export default function ReportForm({ reasons, blockLabel, submitLabel = 'Submit report', onSubmit }) {
  const showToast = useToast();
  const [reason, setReason] = useState(reasons[0]);
  const [description, setDescription] = useState('');
  const [block, setBlock] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  const uploadScreenshot = async (file) => {
    setUploading(true);
    try {
      const { url } = await uploadsService.uploadListingPhoto(file);
      setScreenshotUrl(url);
    } catch (err) {
      showToast(err.message || 'Could not upload the screenshot');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="reason-list">
        {reasons.map((r) => (
          <label className="reason-item" key={r.value}>
            <input
              type="radio"
              name="report-reason"
              checked={reason.value === r.value}
              onChange={() => setReason(r)}
            />
            {r.label}
          </label>
        ))}
      </div>
      <div className="field">
        <label htmlFor="report-desc">Description</label>
        <textarea
          id="report-desc"
          placeholder="Add more detail…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Screenshot <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
        <UploadBox
          label={uploading ? 'Uploading…' : screenshotUrl ? 'Screenshot added' : 'Tap to upload a screenshot'}
          minHeight={90}
          onFile={uploadScreenshot}
        />
      </div>
      {blockLabel && (
        <label className="reason-item" style={{ marginTop: 2, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={block}
            onChange={(e) => setBlock(e.target.checked)}
            style={{ width: 16, height: 16, flexShrink: 0, accentColor: 'var(--sindoor)' }}
          />
          <span>{blockLabel}</span>
        </label>
      )}
      <button
        className="btn btn-primary"
        disabled={uploading}
        onClick={() => onSubmit({
          reason: reason.value,
          reasonLabel: reason.label,
          description,
          block,
          attachmentUrls: screenshotUrl ? [screenshotUrl] : undefined,
        })}
      >
        {submitLabel}
      </button>
    </>
  );
}
