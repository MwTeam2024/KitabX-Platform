'use client';

/**
 * Real-backend-backed app data. Every domain here maps 1:1 onto a NestJS
 * module (see KitabX-Backend-NestJS-JavaScript.md) via `services/*.service.js`.
 * Nothing is computed client-side beyond display formatting — balances,
 * exchange stages and privacy redaction are all decided by the API.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotifications } from '@/store/slices/notificationSlice';
import { useInterval } from '@/hooks/useInterval';
import { listingsService } from '@/services/listings.service';
import { discoveryService } from '@/services/discovery.service';
import { wishlistService } from '@/services/wishlist.service';
import { creditsService } from '@/services/credits.service';
import { requestsService } from '@/services/requests.service';
import { exchangesService } from '@/services/exchanges.service';
import { pickupService } from '@/services/pickup.service';
import { ratingsService } from '@/services/ratings.service';
import { chatService } from '@/services/chat.service';
import { adminService } from '@/services/admin.service';
import { usersService } from '@/services/users.service';
import { isTerminal } from '@/lib/exchange';
import { coverForDraft } from './BookDraftContext';
import { getSocket } from '@/lib/socket';

const AppDataContext = createContext(null);

function withCover(dto) {
  const { cov, em } = coverForDraft({ title: dto.title || '', author: dto.author || '', genre: dto.genre || '' });
  return { ...dto, cov, em };
}

function withExchangeCover(exchange) {
  const { cov, em } = coverForDraft({ title: exchange.bookTitle || '', author: exchange.bookAuthor || '', genre: '' });
  return { ...exchange, cov, em };
}

function upsertBy(list, item, key = 'id') {
  const idx = list.findIndex((x) => x[key] === item[key]);
  if (idx === -1) return [item, ...list];
  const next = list.slice();
  next[idx] = { ...next[idx], ...item };
  return next;
}

export function AppDataProvider({ children }) {
  const dispatch = useDispatch();
  const sessionUser = useSelector((s) => s.auth.user);

  const [books, setBooks] = useState({});
  const [discoveryKeys, setDiscoveryKeys] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [credits, setCredits] = useState({ available: 0, pending: 0, reserved: 0 });
  const [creditHistory, setCreditHistory] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [chatThreads, setChatThreads] = useState([]);

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminDeletionRequests, setAdminDeletionRequests] = useState([]);
  const [adminSocieties, setAdminSocieties] = useState([]);
  const [adminLocationRequests, setAdminLocationRequests] = useState([]);
  const [adminFlaggedListings, setAdminFlaggedListings] = useState([]);
  const [adminFlaggedUsers, setAdminFlaggedUsers] = useState([]);
  const [adminExchanges, setAdminExchanges] = useState([]);
  const [adminCreditsLedger, setAdminCreditsLedger] = useState([]);
  const [adminReports, setAdminReports] = useState([]);
  const [adminSettings, setAdminSettings] = useState({ supportEmail: 'support@kitabx.app', supportPhone: '' });
  const [adminDashboard, setAdminDashboard] = useState(null);

  const ownerProfileCache = useRef(new Map());

  // ---- books / listings ----

  const mergeListings = useCallback((dtos) => {
    setBooks((prev) => {
      const next = { ...prev };
      dtos.forEach((dto) => { next[dto.key] = withCover(dto); });
      return next;
    });
  }, []);

  const refreshMyBooks = useCallback(async () => {
    const [mine, received] = await Promise.all([
      listingsService.myListings(),
      listingsService.received(),
    ]);
    mergeListings(mine);
    mergeListings(received.map((r) => ({ ...r, mine: true, status: 'Received' })));
  }, [mergeListings]);

  // Rapidly tapping the radius stepper (the most natural way to test it —
  // and exactly how this was caught) fires several of these back to back
  // before the earlier ones resolve. Network timing, not request order,
  // decides which promise settles last, so without a guard a stale, already
  // superseded response (e.g. the small radius that found nothing) could
  // land after the real answer and wipe it back out — the discovery list
  // would flicker to "no books nearby" for a radius that plainly has some.
  // Only the most recently *initiated* call is allowed to commit state.
  const searchRequestIdRef = useRef(0);
  const searchBooks = useCallback(async (params) => {
    const myId = ++searchRequestIdRef.current;
    const { listings } = await discoveryService.search(params);
    if (myId !== searchRequestIdRef.current) return listings; // superseded by a newer call
    mergeListings(listings);
    setDiscoveryKeys(listings.map((l) => l.key));
    return listings;
  }, [mergeListings]);

  // Task 60 — the book detail page previously only ever had whatever DTO
  // happened to already be cached (discovery's skinny card DTO, or my-books'
  // richer-but-still-partial one), and never called the dedicated detail
  // endpoint at all. This always fetches the full record and merges it over
  // whatever's cached, so the detail page shows complete data regardless of
  // which list the viewer arrived from. Swallows errors (a removed/missing
  // listing) so the page can fall back to its own "no longer available"
  // state instead of crashing.
  const ensureBookDetail = useCallback(async (id) => {
    try {
      const detail = await listingsService.get(id);
      // The generic detail endpoint only knows "am I this listing's original
      // owner" — it has no concept of "I received this via a completed
      // exchange", so for a book `refreshMyBooks` already tagged Received/
      // Given away, a naive overwrite would flip `mine`/`status` back to
      // what a stranger sees (e.g. a completed listing reads as plain
      // "Available" to a non-owner) — keep that framing, just enrich with
      // the fuller fields (description, publisher, pageCount, ...).
      setBooks((prev) => {
        const existing = prev[id];
        const preserveViewerContext = existing?.status === 'Received' || existing?.status === 'Given away';
        const merged = preserveViewerContext
          ? { ...detail, mine: existing.mine, status: existing.status, receivedAt: existing.receivedAt }
          : detail;
        return { ...prev, [id]: withCover(merged) };
      });
      return detail;
    } catch {
      return null;
    }
  }, []);

  const refreshCredits = useCallback(async () => {
    const [balance, history] = await Promise.all([creditsService.balance(), creditsService.history()]);
    setCredits(balance);
    setCreditHistory(history);
  }, []);

  const deleteCreditTransaction = useCallback(async (id) => {
    await creditsService.deleteTransaction(id);
    setCreditHistory((list) => list.filter((h) => h.id !== id));
  }, []);

  const clearCreditHistory = useCallback(async () => {
    await creditsService.clearHistory();
    setCreditHistory([]);
  }, []);

  const refreshBooks = useCallback(async () => {
    await Promise.all([refreshMyBooks(), searchBooks({}), refreshCredits()]);
  }, [refreshMyBooks, searchBooks, refreshCredits]);

  // ---- wishlist ----

  const refreshWishlist = useCallback(async () => {
    const items = await wishlistService.list();
    setWishlist(items);
  }, []);

  const isWishlisted = useCallback((bookId) => wishlist.some((w) => w.bookId === bookId), [wishlist]);

  const toggleWishlist = useCallback(async (bookId) => {
    if (wishlist.some((w) => w.bookId === bookId)) {
      await wishlistService.remove(bookId);
    } else {
      await wishlistService.add(bookId);
    }
    await refreshWishlist();
  }, [wishlist, refreshWishlist]);

  // ---- exchanges / requests ----

  // A Set, not an array — BookGrid checks membership once per card in a
  // grid that can hold dozens of them; `.includes` there was an O(n²) scan
  // over the whole grid on every render.
  const requestedKeys = useMemo(
    () => new Set(
      exchanges.filter((e) => e.role === 'receiver' && e.status !== 'done' && !isTerminal(e.stage)).map((e) => e.bookKey),
    ),
    [exchanges],
  );

  // §44: one request for all 4 tabs instead of 4 separate ones (each of
  // which also cost its own CORS preflight) — same data, same shape.
  const refreshExchanges = useCallback(async () => {
    const { forme, mine, done, cancelled } = await exchangesService.listAll();
    setExchanges([...forme, ...mine, ...done, ...cancelled].map(withExchangeCover));
  }, []);

  const getExchange = useCallback((id) => exchanges.find((e) => e.id === id) || null, [exchanges]);

  const ensureExchange = useCallback(async (id) => {
    if (exchanges.some((e) => e.id === id)) return true;
    const detail = await exchangesService.get(id).catch(() => null);
    if (!detail) return false;
    setExchanges((list) => upsertBy(list, withExchangeCover({ ...detail, status: detail.requestStatus === 'COMPLETED' ? 'done' : undefined })));
    return true;
  }, [exchanges]);

  const refreshExchangeDetail = useCallback(async (id) => {
    const detail = await exchangesService.get(id);
    setExchanges((list) => upsertBy(list, withExchangeCover(detail)));
    return detail;
  }, []);

  const requestBook = useCallback(async (key) => {
    try {
      await requestsService.create(key);
      await Promise.all([refreshExchanges(), refreshCredits(), refreshMyBooks()]);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: /credit/i.test(err.message) ? 'no-credit' : 'unavailable', message: err.message };
    }
  }, [refreshExchanges, refreshCredits, refreshMyBooks]);

  const cancelBookRequest = useCallback(async (bookKey) => {
    const mine = exchanges.find((e) => e.bookKey === bookKey && e.role === 'receiver' && !isTerminal(e.stage) && e.status !== 'done');
    if (!mine) return;
    await requestsService.cancel(mine.id);
    await Promise.all([refreshExchanges(), refreshCredits()]);
  }, [exchanges, refreshExchanges, refreshCredits]);

  const acceptExchange = useCallback(async (id) => {
    await requestsService.accept(id);
    await Promise.all([refreshExchanges(), refreshCredits()]);
  }, [refreshExchanges, refreshCredits]);

  const declineExchange = useCallback(async (id) => {
    await requestsService.decline(id);
    await Promise.all([refreshExchanges(), refreshCredits()]);
  }, [refreshExchanges, refreshCredits]);

  const cancelExchange = useCallback(async (id, reason) => {
    await requestsService.cancel(id, reason);
    await Promise.all([refreshExchanges(), refreshCredits(), refreshMyBooks()]);
  }, [refreshExchanges, refreshCredits, refreshMyBooks]);

  const proposePickup = useCallback(async (id, { date, timeSlot, pickupPointId, customLocation, instructions }) => {
    await pickupService.propose(id, { pickupDate: date, timeSlot, pickupPointId, customLocation, instructions });
    await refreshExchangeDetail(id);
  }, [refreshExchangeDetail]);

  const confirmPickup = useCallback(async (id) => {
    await pickupService.confirm(id);
    await refreshExchangeDetail(id);
  }, [refreshExchangeDetail]);

  const getHandoverCode = useCallback((exchangeId) => exchangesService.getHandoverCode(exchangeId), []);

  const verifyHandover = useCallback(async (exchangeId, requestId, code) => {
    await exchangesService.verifyHandoverOtp(exchangeId, code);
    await Promise.all([refreshExchangeDetail(requestId), refreshCredits()]);
  }, [refreshExchangeDetail, refreshCredits]);

  const submitRating = useCallback(async (exchangeId, requestId, ratings) => {
    await ratingsService.submit(exchangeId, ratings);
    await refreshExchangeDetail(requestId);
  }, [refreshExchangeDetail]);

  // ---- chat ----

  const refreshChatThreads = useCallback(async () => {
    const threads = await chatService.listThreads();
    setChatThreads((prev) => threads.map((t) => {
      const existing = prev.find((p) => p.id === t.id);
      return existing ? { ...t, messages: existing.messages } : { ...t, messages: null };
    }));
  }, []);

  const loadThreadMessages = useCallback(async (conversationId) => {
    const messages = await chatService.getMessages(conversationId);
    setChatThreads((list) => list.map((t) => (t.id === conversationId ? { ...t, messages, unread: 0 } : t)));
    return messages;
  }, []);

  const appendMessage = useCallback((conversationId, message) => {
    setChatThreads((list) => list.map((t) => (
      t.id === conversationId
        ? { ...t, messages: t.messages ? [...t.messages, message] : t.messages, time: message.createdAt, lastMessage: message.text }
        : t
    )));
  }, []);

  const sendMessage = useCallback(async (conversationId, content) => {
    const saved = await chatService.sendMessage(conversationId, content);
    appendMessage(conversationId, { id: saved.id, from: 'me', text: saved.content ?? content, createdAt: saved.createdAt });
  }, [appendMessage]);

  const deleteThread = useCallback(async (conversationId) => {
    await chatService.deleteThread(conversationId);
    setChatThreads((list) => list.filter((t) => t.id !== conversationId));
  }, []);

  /** Chat only exists once a request has been created — find its conversation by requestId. */
  const openThreadForExchange = useCallback(async (exchangeRequestId) => {
    let thread = chatThreads.find((t) => t.requestId === exchangeRequestId);
    if (!thread) {
      const threads = await chatService.listThreads();
      setChatThreads(threads.map((t) => ({ ...t, messages: null })));
      thread = threads.find((t) => t.requestId === exchangeRequestId);
    }
    return thread?.id || null;
  }, [chatThreads]);

  // ---- owner trust profiles (lazy, cached) ----

  const getOwnerProfile = useCallback(async (userId) => {
    if (!userId) return null;
    if (ownerProfileCache.current.has(userId)) return ownerProfileCache.current.get(userId);
    const profile = await usersService.getProfile(userId);
    ownerProfileCache.current.set(userId, profile);
    return profile;
  }, []);

  // ---- admin ----

  const loadAdminDashboard = useCallback(async () => setAdminDashboard(await adminService.dashboard()), []);
  const loadAdminUsers = useCallback(async (q) => setAdminUsers(await adminService.listUsers(q)), []);
  const setUserVerification = useCallback(async (id, verified) => {
    await adminService.setVerification(id, verified);
    setAdminUsers((list) => list.map((u) => (u.id === id ? { ...u, verified } : u)));
  }, []);
  const setUserSuspension = useCallback(async (id, suspended) => {
    await adminService.setSuspended(id, suspended);
    setAdminUsers((list) => list.map((u) => (u.id === id ? { ...u, status: suspended ? 'suspended' : 'active' } : u)));
  }, []);
  const approveAdminUser = useCallback(async (id) => {
    await adminService.approveUser(id);
    setAdminUsers((list) => list.map((u) => (u.id === id ? { ...u, status: 'active', verified: true } : u)));
  }, []);
  const rejectAdminUser = useCallback(async (id) => {
    await adminService.rejectUser(id);
    setAdminUsers((list) => list.map((u) => (u.id === id ? { ...u, status: 'rejected' } : u)));
  }, []);

  const loadAdminDeletionRequests = useCallback(async () => setAdminDeletionRequests(await adminService.listDeletionRequests()), []);
  const actionAdminDeletionRequest = useCallback(async (id) => {
    await adminService.actionDeletionRequest(id);
    setAdminDeletionRequests((list) => list.filter((r) => r.id !== id));
  }, []);
  const rejectAdminDeletionRequest = useCallback(async (id) => {
    await adminService.rejectDeletionRequest(id);
    setAdminDeletionRequests((list) => list.filter((r) => r.id !== id));
  }, []);

  const loadAdminSocieties = useCallback(async () => setAdminSocieties(await adminService.listSocieties()), []);
  const addAdminSociety = useCallback(async (society) => {
    await adminService.createSociety(society);
    await loadAdminSocieties();
  }, [loadAdminSocieties]);
  const editAdminSociety = useCallback(async (id, updates) => {
    await adminService.updateSociety(id, updates);
    await loadAdminSocieties();
  }, [loadAdminSocieties]);
  const deleteAdminSociety = useCallback(async (id) => {
    await adminService.removeSociety(id);
    await loadAdminSocieties();
  }, [loadAdminSocieties]);

  const loadAdminLocationRequests = useCallback(async () => setAdminLocationRequests(await adminService.listLocationRequests()), []);
  const approveAdminLocationRequest = useCallback(async (id) => {
    await adminService.approveLocationRequest(id);
    setAdminLocationRequests((list) => list.filter((r) => r.id !== id));
    await loadAdminSocieties(); // approval just created a new one — refresh the list it now belongs to
  }, [loadAdminSocieties]);
  const rejectAdminLocationRequest = useCallback(async (id, reason) => {
    await adminService.rejectLocationRequest(id, reason);
    setAdminLocationRequests((list) => list.filter((r) => r.id !== id));
  }, []);

  const loadAdminFlaggedListings = useCallback(async () => setAdminFlaggedListings(await adminService.listFlaggedListings()), []);
  const removeFlaggedListing = useCallback(async (listingId) => {
    await adminService.removeListing(listingId);
    setAdminFlaggedListings((list) => list.filter((b) => b.listingId !== listingId));
  }, []);

  const loadAdminFlaggedUsers = useCallback(async () => setAdminFlaggedUsers(await adminService.listFlaggedUsers()), []);
  const resolveFlaggedUser = useCallback(async (reportId) => {
    await adminService.resolveReport(reportId);
    setAdminFlaggedUsers((list) => list.filter((r) => r.reportId !== reportId));
  }, []);

  const loadAdminExchanges = useCallback(async () => setAdminExchanges(await adminService.listExchanges()), []);
  const loadAdminCreditsLedger = useCallback(async () => setAdminCreditsLedger(await adminService.creditsLedger()), []);
  const submitAdminCreditCorrection = useCallback(async (userId, amount, reason) => {
    await adminService.correctCredit(userId, amount, reason);
    // Task 57 — the ledger and the per-user "current balance" it now shows
    // both read from `admin.users`, so that needs refreshing too, not just
    // the ledger rows, or the balance just displayed would go stale the
    // instant this correction is the thing that changed it.
    await Promise.all([loadAdminCreditsLedger(), loadAdminUsers()]);
  }, [loadAdminCreditsLedger, loadAdminUsers]);

  const loadAdminReports = useCallback(async (status) => setAdminReports(await adminService.listReports(status)), []);
  const resolveAdminReport = useCallback(async (id) => {
    await adminService.resolveSupportRequest(id);
    setAdminReports((list) => list.map((r) => (r.id === id ? { ...r, status: 'RESOLVED' } : r)));
  }, []);

  const loadAdminSettings = useCallback(async () => {
    const s = await adminService.getSettings();
    setAdminSettings({ supportEmail: s.supportEmail, supportPhone: s.supportPhone });
  }, []);
  const saveAdminSettings = useCallback(async (updates) => {
    const s = await adminService.updateSettings(updates);
    setAdminSettings({ supportEmail: s.supportEmail, supportPhone: s.supportPhone });
  }, []);

  // Session is hydrated by SessionGate before this provider's children ever
  // render, so a real `sessionUser` here means the httpOnly cookie is valid —
  // safe to load every member-scoped domain once, up front.
  useEffect(() => {
    if (!sessionUser?.id) return;
    refreshMyBooks().catch(() => {});
    searchBooks({}).catch(() => {});
    refreshCredits().catch(() => {});
    refreshWishlist().catch(() => {});
    refreshExchanges().catch(() => {});
    // Chat is switched off for now (see chat.module.js) — this would just
    // 404 against the now-unregistered chat endpoints.
    // refreshChatThreads().catch(() => {});
    dispatch(fetchNotifications());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.id]);

  // §35: every request/pickup/exchange mutation already flows through
  // NotificationsService#create server-side, which now also pushes
  // `notification:new` to this user's own Socket.IO room the instant it
  // happens — so react to that immediately instead of waiting on a poll.
  // Opened here (not per-screen, like Task 16's original chat-only usage)
  // so it covers every screen at once, the same surface the poll below does.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    if (!sessionUser?.id) {
      // Signed out — drop the connection rather than leave it authenticated
      // as whoever was just signed in, in case a different user signs in
      // next in the same tab without a full page reload.
      if (socket.connected) socket.disconnect();
      return undefined;
    }

    if (!socket.connected) socket.connect();

    const onLiveUpdate = () => {
      // A notification of any type commonly means one of these changed too
      // (someone requested/returned a book, a wishlisted title reopened, a
      // handover just granted a credit, ...) — refresh all of them here so
      // whichever screen the user is already sitting on updates itself
      // instead of only catching up the next time they navigate to it.
      refreshExchanges().catch(() => {});
      refreshMyBooks().catch(() => {});
      refreshWishlist().catch(() => {});
      refreshCredits().catch(() => {});
      // refreshChatThreads().catch(() => {}); // chat switched off — see chat.module.js
      dispatch(fetchNotifications());
    };
    socket.on('notification:new', onLiveUpdate);
    return () => socket.off('notification:new', onLiveUpdate);
  }, [sessionUser?.id, refreshExchanges, refreshMyBooks, refreshWishlist, refreshCredits, dispatch]);

  // §16/§35: the socket push above now delivers the common case near-
  // instantly — this interval is just the safety net for a dropped/still-
  // connecting socket, an offline gap, or a notification-less change, so it
  // can run much less often than the original 15s without regressing the
  // worst case a user actually notices.
  useInterval(() => {
    refreshExchanges().catch(() => {});
    refreshMyBooks().catch(() => {});
    refreshWishlist().catch(() => {});
    refreshCredits().catch(() => {});
    // refreshChatThreads().catch(() => {}); // chat switched off — see chat.module.js
    dispatch(fetchNotifications());
  }, 45000, { enabled: !!sessionUser?.id });

  const value = useMemo(() => ({
    books, discoveryKeys, wishlist, credits, creditHistory, exchanges, chatThreads, requestedKeys,
    accountSuspended: false,
    admin: {
      users: adminUsers, deletionRequests: adminDeletionRequests, societies: adminSocieties,
      locationRequests: adminLocationRequests, flaggedListings: adminFlaggedListings,
      flaggedUsers: adminFlaggedUsers,
      exchanges: adminExchanges, creditsLedger: adminCreditsLedger, reports: adminReports,
      settings: adminSettings, dashboard: adminDashboard,
    },
    refreshBooks, refreshMyBooks, searchBooks, ensureBookDetail, refreshCredits, deleteCreditTransaction, clearCreditHistory,
    isWishlisted, toggleWishlist, refreshWishlist,
    requestBook, cancelBookRequest,
    publishBook: async (payload) => {
      const dto = await listingsService.create(toListingPayload(payload));
      await Promise.all([refreshMyBooks(), refreshCredits()]);
      return dto.key;
    },
    editListing: async (key, updates) => {
      await listingsService.update(key, toListingPayload(updates, { partial: true }));
      await refreshMyBooks();
    },
    removeListing: async (key) => {
      await listingsService.remove(key);
      setBooks((prev) => { const next = { ...prev }; delete next[key]; return next; });
      await refreshCredits();
    },
    togglePauseListing: async (key) => {
      const book = books[key];
      if (!book) return;
      await listingsService.setPaused(key, !book.paused);
      await refreshMyBooks();
    },
    getExchange, ensureExchange, refreshExchanges, refreshExchangeDetail,
    acceptExchange, declineExchange, cancelExchange, proposePickup, confirmPickup,
    getHandoverCode, verifyHandover, submitRating,
    refreshChatThreads, loadThreadMessages, sendMessage, appendMessage, openThreadForExchange, deleteThread,
    getOwnerProfile,
    loadAdminDashboard, loadAdminUsers, setUserVerification, setUserSuspension, approveAdminUser, rejectAdminUser,
    loadAdminDeletionRequests, actionAdminDeletionRequest, rejectAdminDeletionRequest,
    loadAdminSocieties, addAdminSociety, editAdminSociety, deleteAdminSociety,
    loadAdminLocationRequests, approveAdminLocationRequest, rejectAdminLocationRequest,
    loadAdminFlaggedListings, removeFlaggedListing,
    loadAdminFlaggedUsers, resolveFlaggedUser,
    loadAdminExchanges, loadAdminCreditsLedger, submitAdminCreditCorrection,
    loadAdminReports, resolveAdminReport, loadAdminSettings, saveAdminSettings,
  }), [
    books, discoveryKeys, wishlist, credits, creditHistory, exchanges, chatThreads, requestedKeys,
    adminUsers, adminDeletionRequests, adminSocieties, adminLocationRequests, adminFlaggedListings, adminFlaggedUsers, adminExchanges, adminCreditsLedger, adminReports, adminSettings, adminDashboard,
    refreshBooks, refreshMyBooks, searchBooks, ensureBookDetail, refreshCredits, deleteCreditTransaction, clearCreditHistory,
    isWishlisted, toggleWishlist, refreshWishlist,
    requestBook, cancelBookRequest, getExchange, ensureExchange, refreshExchanges, refreshExchangeDetail,
    acceptExchange, declineExchange, cancelExchange, proposePickup, confirmPickup,
    getHandoverCode, verifyHandover, submitRating,
    refreshChatThreads, loadThreadMessages, sendMessage, appendMessage, openThreadForExchange, deleteThread, getOwnerProfile,
    loadAdminDashboard, loadAdminUsers, setUserVerification, setUserSuspension, approveAdminUser, rejectAdminUser,
    loadAdminDeletionRequests, actionAdminDeletionRequest, rejectAdminDeletionRequest,
    loadAdminSocieties, addAdminSociety, editAdminSociety, deleteAdminSociety,
    loadAdminLocationRequests, approveAdminLocationRequest, rejectAdminLocationRequest,
    loadAdminFlaggedListings, removeFlaggedListing,
    loadAdminFlaggedUsers, resolveFlaggedUser,
    loadAdminExchanges, loadAdminCreditsLedger, submitAdminCreditCorrection, loadAdminReports, resolveAdminReport,
    loadAdminSettings, saveAdminSettings,
  ]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

function toListingPayload(draft, { partial } = {}) {
  const payload = {
    condition: draft.cond,
    conditionDescription: draft.condDesc || undefined,
    pickupInstructions: draft.pickup || undefined,
    photoUrls: draft.photos || undefined,
    book: {
      title: draft.title,
      author: draft.author,
      genre: draft.genre,
      languageCode: draft.lang,
      isbn13: draft.isbn || undefined,
      publicationYear: draft.year ? Number(draft.year) : undefined,
    },
  };
  if (partial && !draft.title) delete payload.book;
  return payload;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
