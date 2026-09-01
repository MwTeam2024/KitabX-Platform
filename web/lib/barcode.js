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
 * ISBN barcodes are Bookland EAN-13: a 978/979 prefix plus a real EAN-13
 * check digit. A misread frame (motion blur, glare, a curved cover) often
 * still decodes to *some* 13-digit string, and the scanner's EAN_8/UPC_A/
 * UPC_E fallback formats above can also lock onto an unrelated barcode
 * (a price sticker) — this is what actually tells "camera read this wrong"
 * apart from "this ISBN genuinely isn't in the book database", instead of
 * sending every decode straight to the lookup API and calling whatever
 * comes back a real miss.
 */
export function isValidIsbnBarcode(text) {
  const digits = (text || '').replace(/\D/g, '');
  if (digits.length !== 13 || !/^97[89]/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(digits[12]);
}

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
