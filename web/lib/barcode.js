import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException, DecodeHintType, BarcodeFormat } from '@zxing/library';

// ISBN barcodes are always EAN-13 (UPC-A/EAN-8 covers older/regional
// variants); with no hints at all ZXing also tries QR/DataMatrix/Aztec/
// PDF417/MaxiCode on every single frame, which both wastes time it could
// spend re-trying the 1D decode and skips TRY_HARDER (off by default) —
// the more thorough pass that real-world scans (a curved cover, an angle,
// imperfect lighting) usually need. This was the actual cause of "camera
// opens but never reads the barcode": not a permissions problem, a
// decode-quality one.
const HINTS = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
  [DecodeHintType.TRY_HARDER, true],
]);

/**
 * Starts the device camera in `videoEl` and decodes barcodes continuously
 * (ZXing scans every video frame) until the first hit or `stop()` is called.
 * `NotFoundException` fires on every frame with no barcode in view — that's
 * the normal "still looking" case, not a real error, so it's swallowed here.
 */
export function startScan(videoEl, onResult, onError) {
  const reader = new BrowserMultiFormatReader(HINTS);
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
