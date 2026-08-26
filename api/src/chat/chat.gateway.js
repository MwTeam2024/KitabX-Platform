import { Dependencies, forwardRef, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Params } from '../common/decorators/params.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

/**
 * "Hume apna khud ka bnana hai using socket.io" — a self-hosted realtime
 * layer, not a third-party chat SaaS. One event in, one event out:
 * `message:send` persists via ChatService (identical path to the REST
 * fallback in chat.controller.js) — and since Task 46, the `message:new`
 * fan-out to every socket in that conversation's room lives inside
 * `ChatService#sendMessage` itself, so REST-sent messages get the same live
 * push the socket path always did (previously they didn't — the real chat
 * UI always sends via REST, so live delivery silently never fired).
 *
 * Auth: the session lives in an httpOnly cookie (see auth.service.js), which
 * Socket.IO's handshake still carries (`handshake.headers.cookie`) even
 * though cookie-parser's Express middleware never runs on it. This is done
 * as real Socket.IO *middleware* (`server.use`, wired in `afterInit`) rather
 * than in the `handleConnection` lifecycle hook — `handleConnection` is
 * async but Socket.IO does NOT wait for it before dispatching a client's
 * first messages, so a client that emits `thread:join` immediately after
 * `connect` could race the cookie/JWT lookup and see `client.data.userId`
 * still unset (confirmed with a real two-client test before this fix).
 * Middleware registered via `server.use` genuinely blocks the handshake
 * until it calls `next()`, which is the guarantee this needs.
 */
@Dependencies(JwtService, ConfigService, PrismaService, forwardRef(() => ChatService))
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
})
export class ChatGateway {
  @WebSocketServer()
  server;

  constructor(jwt, config, prisma, chat) {
    this.jwt = jwt;
    this.config = config;
    this.prisma = prisma;
    this.chat = chat;
    this.logger = new Logger(ChatGateway.name);
  }

  afterInit(server) {
    server.use(async (socket, next) => {
      try {
        const cookieName = this.config.get('SESSION_COOKIE_NAME') || 'kitabx_session';
        const token = parseCookie(socket.handshake.headers.cookie, cookieName);
        if (!token) throw new Error('No session cookie');

        const payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user || !user.isActive) throw new Error('Inactive session');

        socket.data.userId = user.id;
        // §35: a per-user room, joined here rather than on a client-sent
        // event, so every authenticated connection — not just one with a
        // chat thread open — can be pushed a live update the moment it's
        // ready, instead of waiting on a poll interval to notice it.
        socket.join(userRoom(user.id));
        next();
      } catch (err) {
        this.logger.warn(`Rejected socket connection: ${err.message}`);
        next(new Error('Authentication failed'));
      }
    });
  }

  handleDisconnect() {
    // Stateless per-connection — nothing to clean up beyond the socket itself.
  }

  /** §35: lets other modules (NotificationsService) push a live update to
   * every connection a given user currently has open, the same way `onSend`
   * pushes `message:new` to a conversation room — no-ops harmlessly if that
   * user has no socket connected right now (they'll just see it on next
   * poll/navigation instead). */
  emitToUser(userId, event, payload) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  /** §46: used by ChatService#sendMessage — the single choke point for both
   * the socket `message:send` path and the REST fallback, so a message sent
   * either way reaches every participant currently viewing this thread. */
  emitToConversation(conversationId, event, payload) {
    this.server?.to(roomName(conversationId)).emit(event, payload);
  }

  @SubscribeMessage('thread:join')
  @Params({ 0: MessageBody(), 1: ConnectedSocket() })
  async onJoin(conversationId, client) {
    await this.chat.assertParticipant(conversationId, client.data.userId).catch(() => null);
    client.join(roomName(conversationId));
  }

  @SubscribeMessage('thread:leave')
  @Params({ 0: MessageBody(), 1: ConnectedSocket() })
  onLeave(conversationId, client) {
    client.leave(roomName(conversationId));
  }

  @SubscribeMessage('message:send')
  @Params({ 0: MessageBody(), 1: ConnectedSocket() })
  async onSend(data, client) {
    try {
      // §46: the emit itself now lives in ChatService#sendMessage, shared
      // with the REST fallback — this handler only needs to persist and
      // surface an error back to the sender's own socket on failure.
      await this.chat.sendMessage(data.conversationId, client.data.userId, data.content, data.messageType);
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('typing')
  @Params({ 0: MessageBody(), 1: ConnectedSocket() })
  onTyping(data, client) {
    client.to(roomName(data.conversationId)).emit('typing', { conversationId: data.conversationId, userId: client.data.userId });
  }
}

function roomName(conversationId) {
  return `conversation:${conversationId}`;
}

function userRoom(userId) {
  return `user:${userId}`;
}

function parseCookie(header, name) {
  if (!header) return null;
  const match = header.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
