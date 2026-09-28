/**
 * One-shot handoff for a photo captured outside the bulk-upload screen
 * (currently: the ISBN-scan "not found" fallback) that should still land on
 * `/books/add/bulk` and start scanning immediately, as if picked there
 * directly — the user is never told these are the same underlying feature.
 * A plain module-level variable is enough since this only ever bridges one
 * client-side navigation within the same tab; no persistence needed.
 */
let pendingFile = null;

export function setPendingBulkPhoto(file) {
  pendingFile = file;
}

export function takePendingBulkPhoto() {
  const file = pendingFile;
  pendingFile = null;
  return file;
}
