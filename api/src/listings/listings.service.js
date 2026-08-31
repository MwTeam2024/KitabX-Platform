import {
  BadRequestException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toListingLocation, toPublicUser } from '../common/serializers/user.serializer';
import { grantPendingCredit, reversePendingCredit } from '../credits/credits.tx';
import { NotificationsService } from '../notifications/notifications.service';
import { CloudinaryService } from '../uploads/cloudinary.service';

const MAX_PHOTOS = 3; // "Sirf per book 3 images upload krne ka option" — enforced here, not just in the UI.

const LISTING_INCLUDE = {
  book: true,
  owner: { include: { society: true, block: true } },
  society: true,
  photos: { orderBy: { sortOrder: 'asc' } },
};

/**
 * §8 (doc): `books` is canonical metadata, `book_listing` is one member's
 * physical copy. This service owns the whole listing lifecycle: create,
 * preview/publish (published immediately on create — there's no separate
 * draft step in the current frontend flow), edit, pause/reactivate, remove.
 */
@Dependencies(PrismaService, NotificationsService, CloudinaryService)
@Injectable()
export class ListingsService {
  constructor(prisma, notifications, cloudinary) {
    this.prisma = prisma;
    this.notifications = notifications;
    this.cloudinary = cloudinary;
  }

  async createListing(ownerId, payload) {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner.societyId) {
      throw new BadRequestException('Join a society before listing a book');
    }
    if ((payload.photoUrls || []).length > MAX_PHOTOS) {
      throw new BadRequestException(`A listing can have at most ${MAX_PHOTOS} photos`);
    }

    return this.prisma.$transaction(async (tx) => {
      const book = await this._findOrCreateBookTx(tx, payload.book);

      const listing = await tx.bookListing.create({
        data: {
          bookId: book.id,
          ownerId,
          societyId: owner.societyId,
          condition: payload.condition,
          conditionDescription: payload.conditionDescription || null,
          pickupInstructions: payload.pickupInstructions || null,
          status: 'ACTIVE',
          publishedAt: new Date(),
        },
      });

      const photoUrls = payload.photoUrls || [];
      if (photoUrls.length) {
        await tx.bookListingPhoto.createMany({
          data: photoUrls.map((url, index) => ({
            listingId: listing.id,
            imageUrl: url,
            imageType: index === 0 ? 'COVER' : 'ACTUAL_CONDITION',
            sortOrder: index,
          })),
        });
      }

      await grantPendingCredit(tx, { userId: ownerId, referenceId: listing.id, bookTitle: book.title });

      const full = await tx.bookListing.findUnique({ where: { id: listing.id }, include: LISTING_INCLUDE });
      const dto = this._toDto(full, { isMine: true });

      const wishlisters = await tx.wishlist.findMany({ where: { bookId: book.id, userId: { not: ownerId } } });
      for (const w of wishlisters) {
        await this.notifications.create(tx, {
          userId: w.userId,
          type: 'WISHLIST',
          title: 'A wishlisted book is now available!',
          body: `"${book.title}" was just listed by ${owner.name} — request it before someone else does.`,
          entityType: 'listing',
          entityId: listing.id,
        });
      }

      return dto;
    });
  }

  async _findOrCreateBookTx(tx, bookData) {
    const { isbn13, isbn10 } = bookData;
    if (isbn13 || isbn10) {
      const existing = await tx.book.findFirst({
        where: { OR: [isbn13 ? { isbn13 } : undefined, isbn10 ? { isbn10 } : undefined].filter(Boolean) },
      });
      if (existing) return existing;
    }
    return tx.book.create({
      data: {
        isbn13: isbn13 || null,
        isbn10: isbn10 || null,
        title: bookData.title,
        subtitle: bookData.subtitle || null,
        author: bookData.author,
        genre: bookData.genre || null,
        languageCode: bookData.languageCode || null,
        publisher: bookData.publisher || null,
        publicationYear: bookData.publicationYear || null,
        coverImageUrl: bookData.coverImageUrl || null,
        googleBooksId: bookData.googleBooksId || null,
      },
    });
  }

  async getListing(id, { viewerId } = {}) {
    const listing = await this.prisma.bookListing.findUnique({ where: { id }, include: LISTING_INCLUDE });
    if (!listing || listing.status === 'REMOVED') throw new NotFoundException('Listing not found');

    const isMine = viewerId && listing.ownerId === viewerId;
    let requestFromViewer = null;
    if (viewerId && !isMine) {
      // Exact address only becomes visible once the owner has accepted —
      // a still-pending REQUESTED request must not unlock it.
      requestFromViewer = await this.prisma.bookRequest.findFirst({
        where: { listingId: id, requesterId: viewerId, status: { in: ['ACCEPTED', 'PICKUP_SCHEDULED'] } },
      });
    }

    return this._toDto(listing, { isMine, requestedByViewer: !!requestFromViewer, viewerId });
  }

  async updateListing(id, ownerId, updates) {
    const listing = await this._assertOwner(id, ownerId);
    const data = {};
    if (updates.condition !== undefined) data.condition = updates.condition;
    if (updates.conditionDescription !== undefined) data.conditionDescription = updates.conditionDescription;
    if (updates.pickupInstructions !== undefined) data.pickupInstructions = updates.pickupInstructions;

    let removedPhotoUrls = [];
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.bookListing.update({ where: { id }, data });
      if (updates.book) {
        await tx.book.update({
          where: { id: listing.bookId },
          data: {
            title: updates.book.title,
            author: updates.book.author,
            genre: updates.book.genre,
            languageCode: updates.book.languageCode,
            publicationYear: updates.book.publicationYear,
            isbn13: updates.book.isbn13 || undefined,
          },
        });
      }
      if (updates.photoUrls) {
        if (updates.photoUrls.length > MAX_PHOTOS) {
          throw new BadRequestException(`A listing can have at most ${MAX_PHOTOS} photos`);
        }
        const existingPhotos = await tx.bookListingPhoto.findMany({ where: { listingId: id } });
        removedPhotoUrls = existingPhotos.map((p) => p.imageUrl).filter((url) => !updates.photoUrls.includes(url));
        await tx.bookListingPhoto.deleteMany({ where: { listingId: id } });
        await tx.bookListingPhoto.createMany({
          data: updates.photoUrls.map((url, index) => ({
            listingId: id,
            imageUrl: url,
            imageType: index === 0 ? 'COVER' : 'ACTUAL_CONDITION',
            sortOrder: index,
          })),
        });
      }
    });

    // Photos actually replaced/dropped — not the ones just kept in place —
    // are gone for good, so free the Cloudinary storage rather than leaving
    // orphaned files behind.
    await Promise.all(removedPhotoUrls.map((url) => this.cloudinary.deleteImage(url)));

    return this.getListing(id, { viewerId: ownerId });
  }

  async setPaused(id, ownerId, paused) {
    const listing = await this._assertOwner(id, ownerId);
    if (!['ACTIVE', 'PAUSED'].includes(listing.status)) {
      throw new BadRequestException(`Cannot pause a listing that is ${listing.status.toLowerCase()}`);
    }
    await this.prisma.bookListing.update({
      where: { id },
      data: { status: paused ? 'PAUSED' : 'ACTIVE', pausedAt: paused ? new Date() : null },
    });
    return this.getListing(id, { viewerId: ownerId });
  }

  async removeListing(id, ownerId) {
    const listing = await this._assertOwner(id, ownerId);
    if (listing.status === 'RESERVED' || listing.status === 'COMPLETED') {
      throw new BadRequestException('This listing has an active or completed exchange and cannot be removed');
    }

    const photos = await this.prisma.bookListingPhoto.findMany({ where: { listingId: id } });

    await this.prisma.$transaction(async (tx) => {
      await tx.bookListing.update({ where: { id }, data: { status: 'REMOVED', removedAt: new Date() } });
      // The pending credit only exists if it hasn't already been converted by
      // a completed handover — REMOVED is blocked above once that's true, so
      // this is always safe to reverse.
      await reversePendingCredit(tx, { userId: ownerId, referenceId: id, bookTitle: listing.book.title });
    });

    await Promise.all(photos.map((p) => this.cloudinary.deleteImage(p.imageUrl)));

    return { success: true };
  }

  async _assertOwner(id, ownerId) {
    const listing = await this.prisma.bookListing.findUnique({ where: { id }, include: { book: true } });
    if (!listing || listing.status === 'REMOVED') throw new NotFoundException('Listing not found');
    if (listing.ownerId !== ownerId) throw new ForbiddenException('You do not own this listing');
    return listing;
  }

  async listMine(ownerId) {
    const listings = await this.prisma.bookListing.findMany({
      where: { ownerId, status: { not: 'REMOVED' } },
      include: LISTING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return listings.map((l) => this._toDto(l, { isMine: true }));
  }

  /** Books this user has received (exchange.receiverId = user, completed). */
  async listReceived(userId) {
    const exchanges = await this.prisma.exchange.findMany({
      where: { receiverId: userId, status: 'COMPLETED' },
      include: { listing: { include: LISTING_INCLUDE } },
      orderBy: { completedAt: 'desc' },
    });
    return exchanges.map((e) => ({ ...this._toDto(e.listing, { isMine: false }), receivedAt: e.completedAt }));
  }

  _toDto(listing, { isMine, requestedByViewer, viewerId } = {}) {
    const revealFull = isMine || requestedByViewer;
    return {
      key: listing.id,
      bookId: listing.bookId,
      title: listing.book.title,
      subtitle: listing.book.subtitle,
      author: listing.book.author,
      genre: listing.book.genre,
      lang: listing.book.languageCode,
      isbn: listing.book.isbn13 || listing.book.isbn10,
      year: listing.book.publicationYear,
      edition: listing.book.edition,
      publisher: listing.book.publisher,
      description: listing.book.description,
      pageCount: listing.book.pageCount,
      cond: listing.condition,
      condDesc: listing.conditionDescription,
      pickup: listing.pickupInstructions,
      status: this._statusLabel(listing, isMine),
      paused: listing.status === 'PAUSED',
      mine: !!isMine,
      owner: initialsOf(listing.owner.name),
      ownerId: listing.owner.id,
      ownerName: isMine ? `${listing.owner.name} (you)` : listing.owner.name,
      ownerVerified: listing.owner.verificationStatus === 'VERIFIED',
      loc: toListingLocation(listing.owner, { revealFull }),
      photos: listing.photos.map((p) => p.imageUrl),
      listedDaysAgo: Math.max(0, Math.floor((Date.now() - new Date(listing.createdAt).getTime()) / 86400000)),
      tags: [listing.condition, listing.book.genre].filter(Boolean),
    };
  }

  _statusLabel(listing, isMine) {
    if (!isMine) return listing.status === 'RESERVED' ? 'Requested' : 'Available';
    switch (listing.status) {
      case 'RESERVED':
        return 'Requested';
      case 'COMPLETED':
        return 'Given away';
      case 'PAUSED':
        return 'Paused';
      default:
        return 'Available';
    }
  }
}

function initialsOf(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}
