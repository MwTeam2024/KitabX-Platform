/**
 * The actual "delete an account" mutation, as a plain function taking the
 * transactional Prisma client — shared between an admin actioning a
 * deletion request (admin.service.js#actionDeletionRequest) and the 30-day
 * auto-delete cron (scheduled-tasks/account-deletion-expiry.service.js) so
 * the two paths can never drift apart.
 *
 * `phone`/`email` are tombstoned (prefixed) rather than left as-is: both
 * columns are plain `@unique`, so leaving the real value in place would
 * permanently squat that phone number/email address — the person could
 * never sign up again, and a fresh OTP login with that same number would
 * find and silently resume this deleted row (auth.service.js's
 * findUserByPhone/findUserByEmail have no isActive/deletedAt filter)
 * instead of never finding a match at all — confirmed live, that's exactly
 * how a deleted account was still able to log in and get a session before
 * failing on every subsequent screen. Prefixing frees the real value up for
 * a genuine new signup; the original is kept (not nulled) for admin/audit
 * traceability.
 *
 * Also pauses every listing this member still has ACTIVE — Discovery's own
 * query only ever checks the LISTING's `status`, never the owner's
 * `isActive`/`deletedAt`, so without this a deleted member's books kept
 * showing up wishlist-able and requestable to an owner who could never
 * respond or complete a handover again.
 */
export async function softDeleteUser(tx, existingUser) {
  const tombstone = `deleted:${Date.now()}:`;
  const user = await tx.user.update({
    where: { id: existingUser.id },
    data: {
      deletedAt: new Date(),
      isActive: false,
      phone: `${tombstone}${existingUser.phone}`,
      email: existingUser.email ? `${tombstone}${existingUser.email}` : null,
    },
  });
  await tx.bookListing.updateMany({
    where: { ownerId: existingUser.id, status: 'ACTIVE' },
    data: { status: 'PAUSED', pausedAt: new Date() },
  });
  return user;
}
