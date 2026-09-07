/**
 * Privacy rule from the architecture doc (§6, §19) and the DB doc (§4): the
 * exact flat/unit number must never appear in a public profile, and a
 * member's phone number is never exposed to other members. Every endpoint
 * that returns another user must go through `toPublicUser`, never return a
 * raw Prisma `User` row directly.
 */
export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    initials: initialsOf(user.name),
    memberId: user.memberId,
    profileImageUrl: user.profileImageUrl,
    bio: user.bio,
    verified: user.verificationStatus === 'VERIFIED',
    society: user.society ? { id: user.society.id, name: user.society.name } : null,
    block: user.block ? { id: user.block.id, name: user.block.name } : null,
    memberSince: user.createdAt,
  };
}

/** The owner's own view of their profile — still no phone/flat by default; the
 * frontend never needs the raw flat number, only whichever fields it displays. */
export function toSelfUser(user) {
  if (!user) return null;
  return {
    ...toPublicUser(user),
    phone: user.phone,
    email: user.email,
    flatUnit: user.flatUnit,
    address: user.address,
    latitude: user.latitude,
    longitude: user.longitude,
    verificationStatus: user.verificationStatus,
    isActive: user.isActive,
    city: user.city ? { id: user.city.id, name: user.city.name } : null,
    area: user.area ? { id: user.area.id, name: user.area.name } : null,
    acceptedTermsAt: user.acceptedTermsAt,
  };
}

/**
 * "A block, Society" instead of "A-402, Society" — the same reduction the
 * frontend applies client-side, now enforced at the source. Full address is
 * only included once a request between the two members has been accepted.
 * For a member's own profile "location" field — where "current" is exactly
 * right (see toBookListingLocation below for the listing-card case, which
 * needs the opposite: frozen at post time).
 */
export function toListingLocation(user, { revealFull } = {}) {
  const societyName = user?.society?.name || null;
  if (!societyName) return null;
  if (revealFull && user.flatUnit) {
    return `${user.flatUnit}, ${societyName}`;
  }
  const blockLabel = user?.block?.name ? `${user.block.name} block` : null;
  return [blockLabel, societyName].filter(Boolean).join(', ');
}

/**
 * Same "block, society" reduction, for a book listing card. Deliberately
 * reads `listing.society` (the society the listing was actually posted
 * under, frozen at creation — see listings.service.js#createListing) instead
 * of the owner's current one — confirmed live that a listing's shown
 * location was silently following the owner to wherever they moved next,
 * which makes no sense for a book that's still sitting in the original
 * society.
 */
export function toBookListingLocation(listing, { revealFull } = {}) {
  const societyName = listing?.society?.name || null;
  if (!societyName) return null;
  if (revealFull && listing.owner?.flatUnit) {
    return `${listing.owner.flatUnit}, ${societyName}`;
  }
  const blockLabel = listing.owner?.block?.name ? `${listing.owner.block.name} block` : null;
  return [blockLabel, societyName].filter(Boolean).join(', ');
}

function initialsOf(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
