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

  reader
    .decodeFromVideoDevice(undefined, videoEl, (result, err) => {
      if (stopped) return;
      if (result) {
        stopped = true;
        controls?.stop();
        onResult(result.getText());
      } else if (err && !(err instanceof NotFoundException)) {
        onError?.(err);
      }
    })
    .then((c) => {
      if (stopped) c.stop();
      else controls = c;
    })
    .catch((err) => onError?.(err));

  return () => {
    stopped = true;
    controls?.stop();
  };
}
