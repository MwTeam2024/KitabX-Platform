import { Dependencies, ForbiddenException, forwardRef, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { redactPhoneNumbers } from '../common/redact-phone';
import { ReportsService } from '../reports/reports.service';
import { ChatGateway } from './chat.gateway';

const QUICK_REPLIES = [
  'Is it still available?',
  'I can pick it up today 👍',
  "Let's meet at the gate",
  'Thanks!',
];

/**
 * §14/§15 (Module 11): request-linked real-time chat, unread counts, quick
 * replies, system messages, phone-number privacy, and disabling after
 * completion.
 *
 * §46: `sendMessage` is the single choke point for BOTH the socket
 * `message:send` path (chat.gateway.js#onSend) and the REST fallback
 * (chat.controller.js) — moving the `message:new` emit in here (rather than
 * only in the gateway's own handler) closes a real gap Task 35 flagged but
 * didn't fix: the actual chat UI (ChatThread.js) always sends via REST, so
 * the socket-only emit never fired for a single real message sent through
 * the app — the recipient only ever saw it on their next poll/reopen.
 */
@Dependencies(PrismaService, ReportsService, forwardRef(() => ChatGateway))
@Injectable()
export class ChatService {
  constructor(prisma, reports, gateway) {
    this.prisma = prisma;
    this.reports = reports;
    this.gateway = gateway;
  }

  quickReplies() {
    return QUICK_REPLIES;
  }

  async assertParticipant(conversationId, userId) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('You are not part of this conversation');
  }

  async listThreads(userId) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId, deletedAt: null },
      include: {
        conversation: {
          include: {
            participants: { include: { user: true } },
            request: { include: { listing: { include: { book: true } } } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    // §35: one grouped unread-count query for every conversation instead of
    // one `count()` per conversation — this ran on every poll tick before.
    const unreadRows = participations.length
      ? await this.prisma.message.groupBy({
          by: ['conversationId'],
          where: {
            conversationId: { in: participations.map((p) => p.conversation.id) },
            senderId: { not: userId },
            NOT: { reads: { some: { userId } } },
          },
          _count: { _all: true },
        })
      : [];
    const unreadByConversation = new Map(unreadRows.map((r) => [r.conversationId, r._count._all]));

    const threads = participations.map(({ conversation }) => {
      const other = conversation.participants.find((p) => p.userId !== userId)?.user;
      const last = conversation.messages[0];
      return {
        id: conversation.id,
        requestId: conversation.requestId,
        disabled: conversation.status === 'DISABLED',
        otherUserId: other?.id || null,
        initials: initialsOf(other?.name),
        name: other?.name || 'Member',
        bookTitle: conversation.request?.listing?.book?.title || '',
        lastMessage: last ? redactPhoneNumbers(last.content) : null,
        time: last?.createdAt || conversation.createdAt,
        unread: unreadByConversation.get(conversation.id) || 0,
      };
    });

    return threads.sort((a, b) => new Date(b.time) - new Date(a.time));
  }

  async getMessages(conversationId, userId, { limit = 100 } = {}) {
    await this.assertParticipant(conversationId, userId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: { sender: true },
    });

    await this._markRead(conversationId, userId);

    return messages.map((m) => ({
      id: m.id,
      from: m.senderId === userId ? 'me' : 'them',
      senderId: m.senderId,
      type: m.messageType,
      text: redactPhoneNumbers(m.content),
      createdAt: m.createdAt,
    }));
  }

  /** Used by both the REST fallback and the Socket.IO gateway so the two paths can never diverge. */
  async sendMessage(conversationId, senderId, content, messageType = 'TEXT') {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.status === 'DISABLED') throw new ForbiddenException('This chat has been closed');
    await this.assertParticipant(conversationId, senderId);

    if (messageType === 'TEXT') {
      const other = await this.prisma.conversationParticipant.findFirst({
        where: { conversationId, userId: { not: senderId } },
      });
      if (other && await this.reports.isBlocked(senderId, other.userId)) {
        throw new ForbiddenException('You can no longer message this member');
      }
    }

    const message = await this.prisma.message.create({
      data: { conversationId, senderId, messageType, content: redactPhoneNumbers(content) },
    });

    // A new message un-hides the thread for anyone who had deleted it on
    // their side — otherwise they'd silently miss the reply.
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });

    try {
      this.gateway.emitToConversation(conversationId, 'message:new', {
        id: message.id,
        conversationId,
        senderId: message.senderId,
        text: message.content,
        createdAt: message.createdAt,
      });
    } catch {
      // A socket-layer hiccup must never fail the send itself — same
      // best-effort treatment as every other emit in this app.
    }

    return message;
  }

  /** "Delete for me" — hides the thread for this user only; the other participant keeps their history. */
  async deleteThread(conversationId, userId) {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { deletedAt: new Date() },
    });
    await this._purgeIfAbandoned(conversationId);
    return { success: true };
  }

  /** Once every participant has deleted their side, the conversation and its messages serve no purpose — hard-delete them. */
  async _purgeIfAbandoned(conversationId) {
    const remaining = await this.prisma.conversationParticipant.count({
      where: { conversationId, deletedAt: null },
    });
    if (remaining === 0) {
      await this.prisma.conversation.delete({ where: { id: conversationId } });
    }
  }

  async _markRead(conversationId, userId) {
    const unread = await this.prisma.message.findMany({
      where: { conversationId, senderId: { not: userId }, NOT: { reads: { some: { userId } } } },
      select: { id: true },
    });
    if (!unread.length) return;
    await this.prisma.messageRead.createMany({
      data: unread.map((m) => ({ messageId: m.id, userId })),
      skipDuplicates: true,
    });
  }

  /** Disables the chat once its exchange is complete (§14: "disable after a defined period"). */
  async disableForRequest(requestId) {
    await this.prisma.conversation.updateMany({
      where: { requestId },
      data: { status: 'DISABLED', disabledAt: new Date() },
    });
  }
}

function initialsOf(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}
