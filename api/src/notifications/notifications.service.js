import { Dependencies, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from '../common/firebase/firebase-admin.service';
import { NotificationsGateway } from './notifications.gateway';
// Chat is commented out for now (see chat.module.js) — this used to depend
// on ChatGateway (via forwardRef, since it lived in a module on the other
// side of a cycle) purely to reuse its connection/auth + emitToUser. That
// now lives in NotificationsGateway instead, in this same module, so no
// forwardRef is needed here any more either.
// import { forwardRef } from '@nestjs/common';
// import { ChatGateway } from '../chat/chat.gateway';

/**
 * §16: the notifications table is the permanent notification centre; FCM is
 * only the delivery channel on top of it. `create()` takes an explicit Prisma
 * client so callers already inside a `$transaction(async (tx) => ...)` block
 * (accepting a request, verifying a handover, ...) can pass `tx` and have the
 * notification row commit atomically with the rest of that transaction —
 * standalone callers just pass the regular injected client.
 *
 * §35: this is also the single choke point every request/pickup/exchange
 * notification already flows through, so it's the one place to add a live
 * Socket.IO push (`notification:new`, to that user's room) that instantly
 * covers every current and future notification-worthy event, rather than
 * instrumenting each mutation service individually. Same best-effort
 * fire-and-forget treatment as the FCM push right below it — a client with no
 * socket open right now just sees it on their next poll/navigation instead.
 */
@Dependencies(PrismaService, FirebaseAdminService, NotificationsGateway)
@Injectable()
export class NotificationsService {
  constructor(prisma, firebase, gateway) {
    this.prisma = prisma;
    this.firebase = firebase;
    this.gateway = gateway;
  }

  async create(client, { userId, type, title, body, entityType, entityId }) {
    const db = client?.notification ? client : this.prisma;
    const notification = await db.notification.create({
      data: { userId, type, title, body, entityType: entityType || null, entityId: entityId || null },
    });

    // Push delivery is best-effort and must never fail the caller's transaction —
    // queue it after the fact rather than awaiting inside the caller's tx.
    if (this.firebase.isConfigured()) {
      this._pushAsync(userId, notification).catch(() => {});
    }
    try {
      this.gateway.emitToUser(userId, 'notification:new', notification);
    } catch {
      // A socket-layer hiccup must never fail the caller's transaction either.
    }
    return notification;
  }

  async _pushAsync(userId, notification) {
    const [prefs, devices] = await Promise.all([
      this.prisma.userNotificationPreference.findUnique({ where: { userId } }),
      this.prisma.userDevice.findMany({ where: { userId, isActive: true } }),
    ]);
    if (prefs && prefs.pushEnabled === false) return;
    if (!devices.length) return;

    const result = await this.firebase.sendToTokens(
      devices.map((d) => d.fcmToken),
      { title: notification.title, body: notification.body, data: { url: this._deepLink(notification) } },
    );
    await this.prisma.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        provider: 'fcm',
        status: result.sent > 0 ? 'sent' : 'failed',
        sentAt: result.sent > 0 ? new Date() : null,
        failedAt: result.sent > 0 ? null : new Date(),
      },
    });
  }

  _deepLink(notification) {
    switch (notification.entityType) {
      case 'exchange':
        return `/exchanges/${notification.entityId}`;
      case 'book_request':
        return '/requests';
      case 'listing':
        return `/books/${notification.entityId}`;
      default:
        return '/notifications';
    }
  }

  async list(userId, { limit = 30 } = {}) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
  }

  async markRead(userId, id) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true, readAt: new Date() } });
    return { success: true };
  }

  async markAllRead(userId) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    return { success: true };
  }

  async unreadCount(userId) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async deleteOne(userId, id) {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
    return { success: true };
  }

  async deleteAll(userId) {
    await this.prisma.notification.deleteMany({ where: { userId } });
    return { success: true };
  }
}
