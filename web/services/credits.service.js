import { apiClient } from "@/lib/api-client";

/** Balances/ledger are computed and owned by NestJS — never trust a client-calculated total (§10, §19). */
export const creditsService = {
  balance: () => apiClient.get("/credits/me"),
  history: () => apiClient.get("/credits/me/history"),
  deleteTransaction: (id) => apiClient.delete(`/credits/transactions/${id}`),
  clearHistory: () => apiClient.delete("/credits/transactions"),
};
