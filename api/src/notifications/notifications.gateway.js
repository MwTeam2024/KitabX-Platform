import { Dependencies, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Minimal realtime layer for live notification push — split out of
 * chat.gateway.js when chat itself was switched off (see chat.module.js).
 * The connection/auth handshake and the per-user room `emitToUser` uses were
 * never actually chat-specific; `NotificationsService` only went through
 * `ChatGateway` because it happened to be the one Socket.IO gateway that
 * existed. This keeps notifications pushing live with chat fully commented
 * out — see chat.gateway.js for the original combined version if chat comes
 * back and this should be merged back into it.
 */
@Dependencies(JwtService, ConfigService, PrismaService)
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
})
export class NotificationsGateway {
  @WebSocketServer()
  server;

  constructor(jwt, config, prisma) {
    this.jwt = jwt;
    this.config = config;
    this.prisma = prisma;
    this.logger = new Logger(NotificationsGateway.name);
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

  /** Lets NotificationsService push a live update to every connection a
   * given user currently has open — no-ops harmlessly if that user has no
   * socket connected right now (they'll just see it on next poll instead). */
  emitToUser(userId, event, payload) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }
}

function userRoom(userId) {
  return `user:${userId}`;
}

function parseCookie(header, name) {
  if (!header) return null;
  const match = header.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
