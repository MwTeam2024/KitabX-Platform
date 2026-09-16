/**
 * Every credit-balance mutation as a plain function taking the transactional
 * Prisma client (`tx` from `prisma.$transaction(async (tx) => ...)`), not a
 * Nest-injected service. Credit changes never happen alone — they're always
 * one step inside a larger transaction (create a listing, accept a request,
 * verify a handover — architecture doc §23) — so these are designed to be
 * called *from inside* those transactions rather than wrapping their own.
 * `{ increment }` / `{ decrement }` push the arithmetic into the single
 * UPDATE statement, so two concurrent requests can't race a read-modify-write.
 */

async function logTransaction(tx, { userId, type, amount, status = 'COMPLETED', referenceType, referenceId, description }) {
  return tx.creditTransaction.create({
    data: { userId, type, amount, status, referenceType, referenceId, description },
  });
}

/** §10 (revised): listing a book earns a credit that's spendable immediately
 * — no longer held as "pending" until the book is actually given away. A
 * member can request other books using credit from listings they haven't
 * handed over yet; `removeListing`'s availableBalance check (listings.
 * service.js) is what stops that from being farmed for free (list, spend,
 * delete the listing) — see reverseAvailableCredit below. */
export async function grantAvailableCredit(tx, { userId, referenceId, bookTitle }) {
  await tx.creditAccount.update({ where: { userId }, data: { availableBalance: { increment: 1 } } });
  await logTransaction(tx, {
    userId,
    type: 'BOOK_LISTED',
    amount: 1,
    status: 'COMPLETED',
    referenceType: 'book_listing',
    referenceId,
    description: `Listed "${bookTitle}"`,
  });
}

/** §10/§11: requesting a book reserves 1 credit from the requester's available balance. */
export async function reserveCredit(tx, { userId, referenceId, bookTitle, ownerName }) {
  await tx.creditAccount.update({
    where: { userId },
    data: { availableBalance: { decrement: 1 }, reservedBalance: { increment: 1 } },
  });
  await logTransaction(tx, {
    userId,
    type: 'REQUEST_RESERVED',
    amount: -1,
    status: 'PENDING',
    referenceType: 'book_request',
    referenceId,
    description: `Reserved for request to ${ownerName || 'owner'} — "${bookTitle}"`,
  });
}

/** §10: verified handover permanently deducts the receiver's reserved credit. */
export async function deductReservedCredit(tx, { userId, referenceId, bookTitle, ownerName }) {
  await tx.creditAccount.update({ where: { userId }, data: { reservedBalance: { decrement: 1 } } });
  await logTransaction(tx, {
    userId,
    type: 'EXCHANGE_COMPLETED',
    amount: -1,
    status: 'COMPLETED',
    referenceType: 'exchange',
    referenceId,
    description: `Received "${bookTitle}"${ownerName ? ` from ${ownerName}` : ''}`,
  });
}

/** §10/§11: decline/cancel/expiry always releases the reserved credit back. */
export async function releaseReservedCredit(tx, { userId, referenceId, reason, bookTitle }) {
  await tx.creditAccount.update({
    where: { userId },
    data: { reservedBalance: { decrement: 1 }, availableBalance: { increment: 1 } },
  });
  const type = reason === 'EXPIRED' ? 'REQUEST_EXPIRED' : 'REQUEST_CANCELLED';
  await logTransaction(tx, {
    userId,
    type,
    amount: 1,
    status: 'REVERSED',
    referenceType: 'book_request',
    referenceId,
    description: `Reserved credit released${bookTitle ? ` — "${bookTitle}"` : ''}`,
  });
}

/** Removing a listing that was never handed over withdraws the credit it
 * granted — otherwise a member could list, spend the credit, delete the
 * listing, and keep both the credit's worth and the listing gone. Callers
 * (listings.service.js#removeListing) must check availableBalance >= 1
 * first — this only decrements, it never blocks, since by the time this
 * runs the removal is already decided to go ahead. */
export async function reverseAvailableCredit(tx, { userId, referenceId, bookTitle }) {
  await tx.creditAccount.update({ where: { userId }, data: { availableBalance: { decrement: 1 } } });
  await logTransaction(tx, {
    userId,
    type: 'BOOK_LISTED',
    amount: -1,
    status: 'REVERSED',
    referenceType: 'book_listing',
    referenceId,
    description: `Listing removed — "${bookTitle}"`,
  });
}

/** §21: admin manual correction, always requires a reason for the audit trail. */
export async function adminAdjustCredit(tx, { userId, amount, reason }) {
  const account = await tx.creditAccount.update({ where: { userId }, data: { availableBalance: { increment: amount } } });
  const transaction = await logTransaction(tx, {
    userId,
    type: 'ADMIN_ADJUSTMENT',
    amount,
    status: 'COMPLETED',
    referenceType: 'admin',
    referenceId: null,
    description: `Admin correction: ${reason}`,
  });
  return { account, transaction };
}
