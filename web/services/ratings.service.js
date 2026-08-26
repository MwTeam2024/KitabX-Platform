import { apiClient } from "@/lib/api-client";

export const ratingsService = {
  submit: (exchangeId, { conditionAccuracy, communication, reliability, review }) =>
    apiClient.post(`/exchanges/${exchangeId}/rating`, { conditionAccuracy, communication, reliability, review }),
};
