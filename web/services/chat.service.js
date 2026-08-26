import { apiClient } from "@/lib/api-client";

/** Message history over REST; live delivery goes over the socket in lib/socket.js (§14). */
export const chatService = {
  listThreads: () => apiClient.get("/chat/threads"),
  getMessages: (conversationId) => apiClient.get(`/chat/threads/${conversationId}/messages`),
  sendMessage: (conversationId, content) => apiClient.post(`/chat/threads/${conversationId}/messages`, { content }),
  quickReplies: () => apiClient.get("/chat/quick-replies"),
  deleteThread: (conversationId) => apiClient.delete(`/chat/threads/${conversationId}`),
};
