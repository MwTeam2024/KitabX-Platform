import { Dependencies, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** §Module 5 — saved books, availability/requested status, remove. */
@Dependencies(PrismaService)
@Injectable()
export class WishlistService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async list(userId) {
    const rows = await this.prisma.wishlist.findMany({
      where: { userId },
      include: { book: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!rows.length) return [];

    // Was one findFirst (listing) + one findFirst (request) per wishlisted
    // book — a 20-book wishlist cost ~40 extra round trips. Two batched
    // findManys instead, with the "earliest active listing per book" and
    // "did I request that specific listing" logic done in memory.
    const bookIds = rows.map((r) => r.bookId);
    const activeListings = await this.prisma.bookListing.findMany({
      where: { bookId: { in: bookIds }, status: 'ACTIVE', ownerId: { not: userId } },
      include: { owner: true, photos: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    const listingByBookId = new Map();
    for (const listing of activeListings) {
      if (!listingByBookId.has(listing.bookId)) listingByBookId.set(listing.bookId, listing);
    }

    const listingIds = [...listingByBookId.values()].map((l) => l.id);
    const myRequests = listingIds.length
      ? await this.prisma.bookRequest.findMany({
          where: {
            listingId: { in: listingIds },
            requesterId: userId,
            status: { in: ['REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED'] },
          },
        })
      : [];
    const requestedListingIds = new Set(myRequests.map((r) => r.listingId));

    return rows.map((row) => {
      const activeListing = listingByBookId.get(row.bookId) || null;
      return {
        bookId: row.book.id,
        key: activeListing?.id || row.book.id,
        title: row.book.title,
        author: row.book.author,
        genre: row.book.genre,
        available: !!activeListing,
        requested: activeListing ? requestedListingIds.has(activeListing.id) : false,
        ownerName: activeListing?.owner?.name || null,
        photos: activeListing?.photos?.map((p) => p.imageUrl) || [],
      };
    });
  }

  async add(userId, bookId) {
    return this.prisma.wishlist.upsert({
      where: { userId_bookId: { userId, bookId } },
      update: {},
      create: { userId, bookId },
    });
  }

  async remove(userId, bookId) {
    await this.prisma.wishlist.deleteMany({ where: { userId, bookId } });
    return { success: true };
  }
}
