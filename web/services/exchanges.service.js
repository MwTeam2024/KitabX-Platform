import { apiClient } from "@/lib/api-client";

/** The exchange "id" throughout is the BookRequest id — see exchanges.service.js on the backend. */
export const exchangesService = {
  list: (tab) => apiClient.get(`/exchanges${tab ? `?tab=${tab}` : ""}`),
  /** §44: all 4 tabs in one request — see AppDataContext#refreshExchanges. */
  listAll: () => apiClient.get(`/exchanges/all`),
  get: (id) => apiClient.get(`/exchanges/${id}`),
  getHandoverCode: (exchangeId) => apiClient.get(`/exchanges/${exchangeId}/handover/otp`),
  verifyHandoverOtp: (exchangeId, code) => apiClient.post(`/exchanges/${exchangeId}/handover/verify`, { code }),
};
