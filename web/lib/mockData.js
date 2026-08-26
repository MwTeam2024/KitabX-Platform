/**
 * Seed data for local/demo state. This stands in for what `services/*.service.js`
 * will eventually fetch from the NestJS API — see KitabX-Frontend architecture doc §3.
 * Nothing here is authoritative; credit/exchange rules are enforced by the backend in production.
 */

export const CURRENT_USER = {
  id: 'PS',
  name: 'Priya Sharma',
  initials: 'PS',
  email: 'priya.sharma@email.com',
  phone: '+91 98765 43210',
  address: 'A-402, Green Meadows, Powai',
  bio: 'Book lover · Lifelong learner · Coffee enthusiast',
  memberSince: 'Jan 2025',
  memberId: 'KBX-2025-0042',
  rating: 4.9,
  verified: true,
  society: 'Green Meadows, Powai',
};

export const SOCIETIES = ['Green Meadows, Powai', 'Silver Glades, Powai', 'Palm Meadows, Andheri'];

export const OWNERS = {
  RM: { name: 'Rohit Mehta', avgRating: 4.7, completed: 9, memberSince: 'Jan 2024', verified: true, completionRate: 95 },
  SS: { name: 'Sana Sheikh', avgRating: 4.5, completed: 6, memberSince: 'Mar 2024', verified: true, completionRate: 90 },
  MS: { name: 'Meera S.', avgRating: 4.3, completed: 4, memberSince: 'Jun 2024', verified: false, completionRate: 80 },
  AK: { name: 'Anjali K.', avgRating: 4.8, completed: 11, memberSince: 'Nov 2023', verified: true, completionRate: 97 },
  VP: { name: 'Vikram P.', avgRating: 3.2, completed: 3, memberSince: 'Feb 2025', verified: false, completionRate: 60 },
  NT: { name: 'Nikhil Thakur', avgRating: 4.1, completed: 2, memberSince: 'Jul 2025', verified: false, completionRate: 75 },
  PS: { name: 'Priya Sharma (you)', avgRating: 4.9, completed: 6, memberSince: 'Jan 2025', verified: true, completionRate: 96 },
};

export const INITIAL_BOOKS = {
  sapiens: { key: 'sapiens', title: 'Sapiens', author: 'Yuval Noah Harari', subtitle: 'A Brief History of Humankind', cov: 'cov-a', em: '🧬', cond: 'Good', genre: 'Non-fiction', lang: 'English', owner: 'RM', ownerName: 'Rohit Mehta', loc: 'B-204, Green Meadows', tags: ['Good', 'History'], distanceKm: 0.1, listedDaysAgo: 2, mine: false },
  malgudi: { key: 'malgudi', title: 'Malgudi Days', author: 'R.K. Narayan', subtitle: 'Stories from a Small Town', cov: 'cov-d', em: '🏘️', cond: 'Good', genre: 'Fiction', lang: 'English', owner: 'SS', ownerName: 'Sana Sheikh', loc: 'C-12, Green Meadows', tags: ['Good', 'Fiction'], distanceKm: 0.2, listedDaysAgo: 5, mine: false },
  discovery: { key: 'discovery', title: 'The Discovery of India', author: 'Jawaharlal Nehru', subtitle: 'A Journey Through History', cov: 'cov-g', em: '🌿', cond: 'Fair', genre: 'Non-fiction', lang: 'English', owner: 'MS', ownerName: 'Meera S.', loc: 'D-9, Green Meadows', tags: ['Fair', 'Non-fiction'], distanceKm: 0.3, listedDaysAgo: 6, mine: false },
  midnight: { key: 'midnight', title: "Midnight's Children", author: 'Salman Rushdie', subtitle: 'A Novel', cov: 'cov-c', em: '🌙', cond: 'Like New', genre: 'Fiction', lang: 'English', owner: 'AK', ownerName: 'Anjali K.', loc: 'A-104, Green Meadows', tags: ['Like New', 'Fiction'], distanceKm: 0.5, listedDaysAgo: 1, mine: false },
  richdad: { key: 'richdad', title: 'Rich Dad Poor Dad', author: 'Robert Kiyosaki', subtitle: 'What the Rich Teach Their Kids About Money', cov: 'cov-b', em: '💰', cond: 'Good', genre: 'Non-fiction', lang: 'English', owner: 'NT', ownerName: 'Nikhil Thakur', loc: 'C-77, Green Meadows', tags: ['Good', 'Non-fiction'], distanceKm: 0.6, listedDaysAgo: 9, mine: false },
  godofsmall: { key: 'godofsmall', title: 'The God of Small Things', author: 'Arundhati Roy', subtitle: 'A Novel', cov: 'cov-g', em: '🌾', cond: 'Good', genre: 'Fiction', lang: 'English', owner: 'PS', ownerName: 'Priya Sharma (you)', loc: 'A-402, Green Meadows', tags: ['Good', 'Fiction'], mine: true, status: 'Available' },
  atomichabits: { key: 'atomichabits', title: 'Atomic Habits', author: 'James Clear', subtitle: 'An Easy & Proven Way to Build Good Habits', cov: 'cov-b', em: '⚛️', cond: 'Good', genre: 'Non-fiction', lang: 'English', owner: 'PS', ownerName: 'Priya Sharma (you)', loc: 'A-402, Green Meadows', tags: ['Good', 'Non-fiction'], mine: true, status: 'Requested' },
  wingsoffire: { key: 'wingsoffire', title: 'Wings of Fire', author: 'A.P.J. Abdul Kalam', subtitle: 'An Autobiography', cov: 'cov-e', em: '🔥', cond: 'Good', genre: 'Non-fiction', lang: 'English', owner: 'PS', ownerName: 'Priya Sharma (you)', loc: 'A-402, Green Meadows', tags: ['Good', 'Non-fiction'], mine: true, status: 'Given away' },
  ikigai: { key: 'ikigai', title: 'Ikigai', author: 'Héctor García', subtitle: 'The Japanese Secret to a Long and Happy Life', cov: 'cov-g', em: '🌱', cond: 'Like New', genre: 'Non-fiction', lang: 'English', owner: 'PS', ownerName: 'Priya Sharma (you)', loc: 'A-402, Green Meadows', tags: ['Like New', 'Non-fiction'], mine: true, status: 'Given away' },
  whitetiger: { key: 'whitetiger', title: 'The White Tiger', author: 'Aravind Adiga', subtitle: 'A Novel', cov: 'cov-h', em: '🐯', cond: 'Good', genre: 'Fiction', lang: 'English', owner: 'VP', ownerName: 'Vikram P.', loc: 'B-12, Green Meadows', tags: ['Good', 'Fiction'], mine: true, status: 'Received' },
  midnightreceived: { key: 'midnightreceived', title: "Midnight's Children", author: 'Salman Rushdie', subtitle: 'A Novel', cov: 'cov-c', em: '🌙', cond: 'Like New', genre: 'Fiction', lang: 'English', owner: 'AK', ownerName: 'Anjali K.', loc: 'A-104, Green Meadows', tags: ['Like New', 'Fiction'], mine: true, status: 'Received' },
};

export const DISCOVER_BOOK_KEYS = ['sapiens', 'malgudi', 'discovery', 'midnight'];
export const MY_SHELF_KEYS = ['godofsmall', 'atomichabits'];
export const GIVEN_KEYS = ['wingsoffire', 'ikigai'];
export const RECEIVED_KEYS = ['whitetiger', 'midnightreceived'];

export const INITIAL_WISHLIST = ['sapiens', 'midnight', 'richdad', 'malgudi'];

export const INITIAL_CREDITS = { available: 2, pending: 1, reserved: 1 };

export const INITIAL_CREDIT_HISTORY = [
  { id: 'ch4', desc: 'Reserved for request to Anjali K. — "Midnight\'s Children"', status: 'Reserved', time: 'Today, 9:14 AM' },
  { id: 'ch3', desc: 'Listed "The God of Small Things"', status: 'Pending', time: '2 days ago' },
  { id: 'ch2', desc: 'Gave "Wings of Fire" to a neighbour', status: 'Available', time: '2 weeks ago' },
  { id: 'ch1', desc: 'Gave "Ikigai" to a neighbour', status: 'Available', time: '3 weeks ago' },
];

export const INITIAL_EXCHANGES = [
  { id: 'ex-atomic', status: 'forme', initials: 'MS', name: 'Meera S.', bookKey: 'atomichabits', bookTitle: 'Atomic Habits', bookAuthor: 'James Clear', cov: 'cov-b', loc: 'B-502, Green Meadows', when: '2 hrs ago', isNew: true },
  { id: 'ex-godofsmall', status: 'forme', initials: 'VP', name: 'Vikram P.', bookKey: 'godofsmall', bookTitle: 'The God of Small Things', bookAuthor: 'Arundhati Roy', cov: 'cov-g', loc: 'C-108, Green Meadows', when: '1 day ago', isNew: true },
  { id: 'ex-midnight', status: 'mine', initials: 'AK', name: 'Anjali K.', bookKey: 'midnight', bookTitle: "Midnight's Children", bookAuthor: 'Salman Rushdie', cov: 'cov-c', role: 'receiver', stage: 'requested' },
  { id: 'ex-whitetiger', status: 'done', initials: 'VP', name: 'Vikram P.', bookKey: 'whitetiger', bookTitle: 'The White Tiger', bookAuthor: 'Aravind Adiga', cov: 'cov-h', when: 'Completed 3 days ago', rating: 5 },
  { id: 'ex-sapiens', status: 'done', initials: 'RM', name: 'Rohit Mehta', bookKey: 'sapiens', bookTitle: 'Sapiens', bookAuthor: 'Yuval Noah Harari', cov: 'cov-a', when: 'Completed 1 week ago', rating: 4 },
];

export const INITIAL_CHAT_THREADS = [
  { id: 'AK', initials: 'AK', name: 'Anjali K.', bookTitle: "Midnight's Children", time: 'Just now', unread: 1, online: true, messages: [
    { from: 'me', text: "Hi! I'm interested in Midnight's Children — is it still available for exchange?", time: '11:40 AM', read: true },
    { from: 'them', text: 'Yes, it\'s all yours! When would you like to pick it up?' },
    { from: 'me', text: 'How about tomorrow evening at the gate?' },
    { from: 'them', text: 'Perfect — see you then, come pick it up!' },
  ]},
  { id: 'RM', initials: 'RM', name: 'Rohit M.', bookTitle: 'Sapiens', time: '2h ago', unread: 1, online: false, messages: [
    { from: 'them', text: 'Re: Sapiens — sounds good, I can drop it off tomorrow.' },
  ]},
  { id: 'MS', initials: 'MS', name: 'Meera S.', bookTitle: 'Atomic Habits', time: '1d ago', unread: 0, online: false, messages: [
    { from: 'them', text: 'Re: Atomic Habits — is it still available?' },
  ]},
  { id: 'VP', initials: 'VP', name: 'Vikram P.', bookTitle: 'The White Tiger', time: '2d ago', unread: 0, online: false, faded: true, messages: [
    { from: 'them', text: 'Re: The White Tiger — glad it went smoothly!' },
  ]},
];

export const INITIAL_NOTIFICATIONS = [
  { id: 'n1', emoji: '📚', title: 'Meera S. requested Atomic Habits', time: '2 hours ago', href: '/exchanges' },
  { id: 'n2', emoji: '💛', title: "Midnight's Children is now available!", time: 'Yesterday', gold: true, href: '/wishlist' },
  { id: 'n3', emoji: '✅', title: 'White Tiger exchange with Vikram P. completed', time: '2 days ago', href: '/chat' },
];

export const SHEET_CONTENT = {
  faqs: { title: 'FAQs' },
  privacy: { title: 'Privacy Policy', body: 'KitabX only shares your tower/block and pickup point with a member once a request is accepted. Your exact flat number is never shown on your public profile.' },
  terms: { title: 'Terms & Conditions', body: 'KitabX is a community book gifting platform. Books listed are permanent gifts and will not be returned.' },
};

export const ADMIN_USERS = [
  { name: 'Priya Sharma', memberId: 'KBX-2025-0042', society: 'Green Meadows', rating: '4.9★', verified: true, status: 'active' },
  { name: 'Rohit Mehta', memberId: 'KBX-2025-0087', society: 'Green Meadows', rating: '4.7★', verified: true, status: 'active' },
  { name: 'Vikram P.', memberId: 'KBX-2025-1042', society: 'Silver Glades', rating: '3.2★', verified: false, status: 'active' },
  { name: 'Amit Verma', memberId: 'KBX-2025-1103', society: 'Green Meadows', rating: '—', verified: false, status: 'pending' },
];

export const ADMIN_SOCIETIES = [
  { name: 'Green Meadows, Powai', city: 'Mumbai', members: 38, listings: 12 },
  { name: 'Silver Glades', city: 'Mumbai', members: 156, listings: 84 },
  { name: 'Palm Meadows', city: 'Bengaluru', members: 301, listings: 140 },
];

export const ADMIN_FLAGGED_BOOKS = [
  { title: 'Rich Dad Poor Dad', owner: 'Vikram P.', reason: 'Duplicate listing' },
  { title: 'Untitled ISBN 000...', owner: 'Guest_2291', reason: 'Fake listing' },
];

export const ADMIN_EXCHANGES = [
  { book: 'Atomic Habits', from: 'Priya Sharma', to: 'Meera S.', status: 'Requested', when: '10 min ago' },
  { book: 'Sapiens', from: 'Rohit Mehta', to: 'Priya Sharma', status: 'Completed', when: '2 hr ago' },
  { book: 'The White Tiger', from: 'Priya Sharma', to: 'Vikram P.', status: 'Completed', when: '3 days ago' },
];

export const ADMIN_CREDITS_LEDGER = [
  { user: 'Priya Sharma', change: '+1', positive: true, reason: 'Handover verified — Wings of Fire', note: '—' },
  { user: 'Vikram P.', change: 'Manual −1', positive: false, reason: 'Duplicate credit correction', note: 'Support ticket #442' },
];

export const ADMIN_REPORTS = [
  { type: 'User', reported: 'Vikram P.', by: 'Meera S.', item: 'Atomic Habits', reason: 'No-show at pickup', status: 'Open' },
  { type: 'User', reported: 'Vikram P.', by: 'Rohit Mehta', item: 'Rich Dad Poor Dad', reason: 'Wrong condition', status: 'Resolved' },
];

export const NEW_BOOK_COVERS = ['cov-a', 'cov-b', 'cov-c', 'cov-d', 'cov-e', 'cov-f', 'cov-g', 'cov-h'];
export const NEW_BOOK_EMBLEMS = { Fiction: '📖', 'Non-fiction': '📘', School: '🎒', College: '🎓' };
export const CONDITIONS = [
  { label: 'Brand New', em: '🆕' },
  { label: 'Like New', em: '✨' },
  { label: 'Good', em: '👍' },
  { label: 'Well Read', em: '📖' },
];
export const GENRES = ['Fiction', 'Non-fiction', 'School', 'College'];
export const LANGUAGES = ['English', 'Hindi'];
