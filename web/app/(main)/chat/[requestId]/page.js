import ChatThread from '@/components/chat/ChatThread';

export const metadata = { title: 'Chat — KitabX' };

/** Request-linked conversation (§14). The id is the request/exchange the chat belongs to. */
export default async function ChatThreadPage({ params }) {
  const { requestId } = await params;
  return <ChatThread threadId={requestId} />;
}
