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

// Left to itself, Android Chrome hands back a small (~640x480) frame with a
// fixed focus, which is too soft for a 1D barcode held at reading distance —
// iOS Safari picks a sharper stream on its own, which is why the same book
// scanned there and not here. Ask for a full-HD rear camera with continuous
// autofocus; every key is a preference (`ideal` / `advanced`), so a device
// that can't do one of them still opens the camera instead of failing.
const CAMERA = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    advanced: [{ focusMode: 'continuous' }],
  },
};

// Chrome on Android ships the OS barcode engine as `BarcodeDetector` — it
// reads blurry/angled EAN-13 far better than a JS decoder. Used when the
// browser has it (and supports EAN-13), otherwise ZXing below.
async function nativeDetector() {
  try {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return formats.includes('ean_13') ? new window.BarcodeDetector({ formats: ['ean_13'] }) : null;
  } catch {
    return null;
  }
}

async function startNative(detector, videoEl, onText) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(CAMERA);
  } catch (err) {
    if (err?.name !== 'OverconstrainedError') throw err;
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
  }
  videoEl.srcObject = stream;
  await videoEl.play().catch(() => {});

  let live = true;
  let busy = false;
  const timer = setInterval(async () => {
    if (!live || busy || videoEl.readyState < 2) return;
    busy = true;
    try {
      const hit = (await detector.detect(videoEl)).find((c) => c.rawValue);
      if (hit && live) onText(hit.rawValue);
    } catch {
      // A frame the detector couldn't process — just try the next one.
    }
    busy = false;
  }, 120);

  return () => {
    live = false;
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    videoEl.srcObject = null;
  };
}

/**
 * ZXing path: it scans every video frame itself. `NotFoundException` fires on
 * each frame with no barcode in view — that's the normal "still looking"
 * case, not a real error, so it's swallowed.
 */
async function startZxing(videoEl, onText, onError) {
  const reader = new BrowserMultiFormatReader(HINTS);
  const handleFrame = (result, err) => {
    if (result) onText(result.getText());
    else if (err && !(err instanceof NotFoundException)) onError(err);
  };
  let controls;
  try {
    controls = await reader.decodeFromConstraints(CAMERA, videoEl, handleFrame);
  } catch (err) {
    // Some devices reject even a soft constraint — retry with none.
    if (err?.name !== 'OverconstrainedError') throw err;
    controls = await reader.decodeFromConstraints({ video: true }, videoEl, handleFrame);
  }
  return () => controls.stop();
}

/**
 * Starts the device camera in `videoEl` and decodes barcodes continuously
 * until the first hit or the returned `stop()` is called.
 */
export function startScan(videoEl, onResult, onError) {
  let stopped = false;
  let stopCamera = null;

  const finish = (text) => {
    if (stopped) return;
    stopped = true;
    stopCamera?.();
    onResult(text);
  };
  const fail = (err) => {
    if (!stopped) onError?.(err);
  };

  (async () => {
    const detector = await nativeDetector();
    const stop = detector
      ? await startNative(detector, videoEl, finish)
      : await startZxing(videoEl, finish, fail);
    // stop() may have been called while the camera was still starting.
    if (stopped) stop();
    else stopCamera = stop;
  })().catch(fail);

  return () => {
    stopped = true;
    stopCamera?.();
  };
}
