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

/** §10: listing a book earns a pending credit — not spendable until given. */
export async function grantPendingCredit(tx, { userId, referenceId, bookTitle }) {
  await tx.creditAccount.update({ where: { userId }, data: { pendingBalance: { increment: 1 } } });
  await logTransaction(tx, {
    userId,
    type: 'BOOK_LISTED',
    amount: 1,
    status: 'PENDING',
    referenceType: 'book_listing',
    referenceId,
    description: `Listed "${bookTitle}"`,
  });
}

/** §10: verified handover moves the giver's pending credit into available. */
export async function movePendingToAvailable(tx, { userId, referenceId, bookTitle, otherPartyName }) {
  await tx.creditAccount.update({
    where: { userId },
    data: { pendingBalance: { decrement: 1 }, availableBalance: { increment: 1 } },
  });
  await logTransaction(tx, {
    userId,
    type: 'BOOK_GIVEN',
    amount: 1,
    status: 'COMPLETED',
    referenceType: 'exchange',
    referenceId,
    description: `Gave "${bookTitle}"${otherPartyName ? ` to ${otherPartyName}` : ''}`,
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

/** Removing a listing that was never handed over withdraws its pending credit
 * — otherwise a member could list, delete, relist and inflate their balance. */
export async function reversePendingCredit(tx, { userId, referenceId, bookTitle }) {
  await tx.creditAccount.update({ where: { userId }, data: { pendingBalance: { decrement: 1 } } });
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
