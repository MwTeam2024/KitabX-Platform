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

    const results = await Promise.all(
      rows.map(async (row) => {
        const activeListing = await this.prisma.bookListing.findFirst({
          where: { bookId: row.bookId, status: 'ACTIVE', ownerId: { not: userId } },
          include: { owner: true, photos: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { createdAt: 'asc' },
        });
        const requested = activeListing
          ? await this.prisma.bookRequest.findFirst({
              where: {
                listingId: activeListing.id,
                requesterId: userId,
                status: { in: ['REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED'] },
              },
            })
          : null;

        return {
          bookId: row.book.id,
          key: activeListing?.id || row.book.id,
          title: row.book.title,
          author: row.book.author,
          genre: row.book.genre,
          available: !!activeListing,
          requested: !!requested,
          ownerName: activeListing?.owner?.name || null,
          photos: activeListing?.photos?.map((p) => p.imageUrl) || [],
        };
      }),
    );
    return results;
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
