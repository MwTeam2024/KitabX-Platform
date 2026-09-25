import {
  BadRequestException,
  ConflictException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toBookListingLocation, toPublicUser } from '../common/serializers/user.serializer';
import { grantAvailableCredit, reverseAvailableCredit } from '../credits/credits.tx';
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
    const photoUrls = payload.photoUrls || [];
    if (photoUrls.length + (payload.groupPhotoUrl ? 1 : 0) > MAX_PHOTOS) {
      throw new BadRequestException(`A listing can have at most ${MAX_PHOTOS} photos`);
    }

    return this.prisma.$transaction(async (tx) => {
      const book = await this._findOrCreateBookTx(tx, payload.book);

      // Block re-listing a book the owner already has live, unless they've
      // confirmed (via the frontend's "do you have another copy?" prompt)
      // that this is a genuinely separate physical copy.
      if (!payload.confirmDuplicate) {
        const existingListing = await tx.bookListing.findFirst({
          where: { bookId: book.id, ownerId, status: { in: ['ACTIVE', 'PAUSED', 'RESERVED'] } },
        });
        if (existingListing) {
          throw new ConflictException('You already have this book listed.');
        }
      }

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

      if (photoUrls.length || payload.groupPhotoUrl) {
        // §groupPhotoUrl: the bulk-upload flow's one shared "books together"
        // photo (proof several books came from the same set) — tagged OTHER,
        // distinct from COVER/ACTUAL_CONDITION, so the frontend knows to
        // overlay it with "Includes This Book: <title>" instead of showing
        // it as if it were this book's own photo.
        const rows = photoUrls.map((url, index) => ({
          listingId: listing.id,
          imageUrl: url,
          imageType: index === 0 ? 'COVER' : 'ACTUAL_CONDITION',
          sortOrder: index,
        }));
        if (payload.groupPhotoUrl) {
          rows.push({ listingId: listing.id, imageUrl: payload.groupPhotoUrl, imageType: 'OTHER', sortOrder: rows.length });
        }
        await tx.bookListingPhoto.createMany({ data: rows });
      }

      await grantAvailableCredit(tx, { userId: ownerId, referenceId: listing.id, bookTitle: book.title });

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
    // No ISBN match (either none was supplied, or the caller's ISBN just
    // doesn't match anything yet — Gemini/Google Books identification of the
    // same physical cover isn't always consistent run to run, so the "same"
    // book can arrive with a different ISBN, or a different/missing
    // publicationYear, each time). Without this fallback, an
    // unmatched/inconsistent ISBN would silently create a second `Book` row
    // for what's really the same title, and the same-listing duplicate check
    // below (keyed on bookId) would never catch the repeat.
    //
    // publicationYear is used as a tie-breaker, not a strict requirement: a
    // missing year on either side (this scan's or the stored book's) never
    // blocks the match, since that just means the extraction wasn't
    // confident that run. But when BOTH sides do have a year and they
    // genuinely differ, that's a real signal of two different
    // editions/books sharing a title+author — those are kept as separate
    // Book rows rather than being wrongly merged.
    {
      const where = { title: bookData.title, author: bookData.author };
      if (bookData.publicationYear) {
        where.OR = [{ publicationYear: null }, { publicationYear: bookData.publicationYear }];
      }
      const existing = await tx.book.findFirst({ where });
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
        // Re-point this listing at a (found-or-created) Book row for the
        // edited details, instead of mutating `listing.bookId`'s row in
        // place. That row is shared by every listing with the same book —
        // editing one listing's title/author/etc used to silently rewrite
        // what every other owner's listing of "the same book" displayed
        // too. Re-pointing keeps an edit scoped to just this listing: other
        // listings still on the old row are untouched, and if the edited
        // details match an existing row, this listing simply joins it.
        const book = await this._findOrCreateBookTx(tx, updates.book);
        await tx.bookListing.update({ where: { id }, data: { bookId: book.id } });
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
    // Same wishlist alert as a brand-new listing (createListing above) — a
    // reactivated listing is just as "now available" to someone who wishlisted
    // it while it sat paused. Only fires on the actual PAUSED -> ACTIVE edge,
    // not on a same-state no-op call.
    const isReactivating = !paused && listing.status === 'PAUSED';
    await this.prisma.$transaction(async (tx) => {
      await tx.bookListing.update({
        where: { id },
        data: { status: paused ? 'PAUSED' : 'ACTIVE', pausedAt: paused ? new Date() : null },
      });
      if (isReactivating) {
        const wishlisters = await tx.wishlist.findMany({ where: { bookId: listing.bookId, userId: { not: ownerId } } });
        for (const w of wishlisters) {
          await this.notifications.create(tx, {
            userId: w.userId,
            type: 'WISHLIST',
            title: 'A wishlisted book is now available!',
            body: `"${listing.book.title}" is available again — request it before someone else does.`,
            entityType: 'listing',
            entityId: id,
          });
        }
      }
    });
    return this.getListing(id, { viewerId: ownerId });
  }

  async removeListing(id, ownerId) {
    const listing = await this._assertOwner(id, ownerId);
    if (listing.status === 'RESERVED' || listing.status === 'COMPLETED') {
      throw new BadRequestException('This listing has an active or completed exchange and cannot be removed');
    }

    // Listing grants a credit the instant it's published — spendable right
    // away, before the book is ever actually given to anyone (see
    // grantAvailableCredit). Removing the listing claws that credit back
    // (below), but only as long as it's still free: once it's been spent —
    // reserved against an outgoing request of this member's own — there's
    // nothing left to reclaim, so the removal itself has to wait until those
    // requests resolve (handed over, declined, cancelled or expired all
    // release the reservation the normal way) rather than letting the
    // member walk away having already spent credit a deleted listing never
    // really backed.
    const account = await this.prisma.creditAccount.findUnique({ where: { userId: ownerId } });
    if (!account || account.availableBalance < 1) {
      // This only ever fires once availableBalance has hit 0 — each
      // successful removal decrements it, and that's the only way in here —
      // so there's never a positive count of "still allowed" to quote; the
      // message says so plainly instead of an always-zero number.
      const requested = account?.reservedBalance || 0;
      throw new BadRequestException(
        `You cannot remove books because you have already requested ${requested} `
        + `book${requested === 1 ? '' : 's'}. The remaining books cannot be removed until the associated exchanges are completed.`,
      );
    }

    const photos = await this.prisma.bookListingPhoto.findMany({ where: { listingId: id } });

    await this.prisma.$transaction(async (tx) => {
      await tx.bookListing.update({ where: { id }, data: { status: 'REMOVED', removedAt: new Date() } });
      await reverseAvailableCredit(tx, { userId: ownerId, referenceId: id, bookTitle: listing.book.title });
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
      loc: toBookListingLocation(listing, { revealFull }),
      photos: listing.photos.map((p) => p.imageUrl),
      groupPhotoUrl: listing.photos.find((p) => p.imageType === 'OTHER')?.imageUrl || null,
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
