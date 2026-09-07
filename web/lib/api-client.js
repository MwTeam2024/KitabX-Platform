/**
 * Thin fetch wrapper for the NestJS API (see architecture doc §1, §3).
 * Every `services/*.service.js` file should go through this instead of
 * calling `fetch` directly, so auth headers / base URL live in one place.
 */

import { notifyDevOtp } from "@/components/ui/ToastProvider";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

async function request(path, { method = "GET", body, headers, ...rest } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: isFormData ? headers : { "Content-Type": "application/json", ...headers },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    ...rest,
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let message = raw;
    try {
      const parsed = JSON.parse(raw);
      message = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
    } catch {
      // Not a JSON error body — fall back to the raw text below.
    }
    const error = new Error(message || res.statusText || `Request to ${path} failed with ${res.status}`);
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return null;
  const json = await res.json();
  // TEMPORARY — for MSG91 delivery testing. See ToastProvider.js#notifyDevOtp.
  if (json?.devCode) notifyDevOtp(json.devCode);
  return json;
}

export const apiClient = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};
