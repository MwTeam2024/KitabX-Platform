import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';

/**
 * Starts the device camera in `videoEl` and decodes barcodes continuously
 * (ZXing scans every video frame) until the first hit or `stop()` is called.
 * `NotFoundException` fires on every frame with no barcode in view — that's
 * the normal "still looking" case, not a real error, so it's swallowed here.
 */
export function startScan(videoEl, onResult, onError) {
  const reader = new BrowserMultiFormatReader();
  let controls = null;
  let stopped = false;

  const handleFrame = (result, err) => {
    if (stopped) return;
    if (result) {
      stopped = true;
      controls?.stop();
      onResult(result.getText());
    } else if (err && !(err instanceof NotFoundException)) {
      onError?.(err);
    }
  };

  const attach = (c) => {
    if (stopped) c.stop();
    else controls = c;
  };

  reader
    .decodeFromVideoDevice(undefined, videoEl, handleFrame)
    .then(attach)
    .catch((err) => {
      if (stopped) return;
      // A bare `facingMode` constraint is spec'd as a hint, not a hard
      // requirement, but some devices/browsers reject it outright — retry
      // with no facing preference before surfacing a real camera failure.
      if (err?.name === 'OverconstrainedError') {
        reader
          .decodeFromConstraints({ video: true }, videoEl, handleFrame)
          .then(attach)
          .catch((err2) => onError?.(err2));
      } else {
        onError?.(err);
      }
    });

  return () => {
    stopped = true;
    controls?.stop();
  };
}
