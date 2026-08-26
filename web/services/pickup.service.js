import { apiClient } from "@/lib/api-client";

/** Pickup is scoped to the request, not the exchange — see PickupController on the backend. */
export const pickupService = {
  get: (requestId) => apiClient.get(`/requests/${requestId}/pickup`),
  /** Also used to reschedule — proposing again after a CONFIRMED pickup counts
   * as the one reschedule the MVP allows (§12). */
  propose: (requestId, { pickupDate, timeSlot, pickupPointId, customLocation, instructions }) =>
    apiClient.post(`/requests/${requestId}/pickup`, { pickupDate, timeSlot, pickupPointId, customLocation, instructions }),
  confirm: (requestId) => apiClient.post(`/requests/${requestId}/pickup/confirm`),
};
