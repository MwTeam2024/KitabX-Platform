'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import BottomNav from '@/components/layout/BottomNav';
import RadiusStepper from '@/components/discovery/RadiusStepper';
import StatTiles from '@/components/discovery/StatTiles';
import GenreChips from '@/components/discovery/GenreChips';
import FilterSheet from '@/components/discovery/FilterSheet';
import SortSheet, { SORT_OPTIONS } from '@/components/discovery/SortSheet';
import BookGrid from '@/components/books/BookGrid';
import { SectionTitle } from '@/components/ui/NoteBox';
import { useBooks } from '@/hooks/useBooks';
import { useLocation } from '@/hooks/useLocation';
import { useAppData } from '@/contexts/AppDataContext';
import { useAppSheets } from '@/hooks/useAppSheets';
import { useToast } from '@/components/ui/ToastProvider';
import { useDebounce } from '@/hooks/useDebounce';
import { discoveryService } from '@/services/discovery.service';

/**
 * Screen 04 — society-first discovery (§8). Radius, search and sort criteria are
 * collected here and sent to NestJS; the authoritative geo query runs there.
 */
export default function HomePage() {
  const router = useRouter();
  const showToast = useToast();
  const user = useSelector((s) => s.auth.user);
  const { radiusKm } = useLocation();
  const { wishlist, discoveryKeys, searchBooks } = useAppData();
  const { openSheet, closeSheet } = useAppSheets();
  const [stats, setStats] = useState(null);

  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('All');
  const [sort, setSort] = useState('newest');
  const [includeNearby, setIncludeNearby] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    searchBooks({ radiusKm, genre, q: debouncedQuery, sort, includeNearby }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm, genre, debouncedQuery, sort, includeNearby]);

  useEffect(() => {
    discoveryService.stats().then(setStats).catch(() => {});
  }, []);

  const { books } = useBooks({ keys: discoveryKeys, query, genre, sort });
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Newest';

  const openSort = () => {
    openSheet('Sort by', (
      <SortSheet
        value={sort}
        onSelect={(key) => {
          setSort(key);
          showToast(`Sorted by ${SORT_OPTIONS.find((o) => o.key === key).label.toLowerCase()}`);
          closeSheet();
        }}
      />
    ));
  };

  const openFilters = () => {
    openSheet('Search & Filters', (
      <FilterSheet
        totalBooks={books.length}
        onApply={({ resultCount }) => showToast(`Showing ${resultCount} books`)}
        onClose={closeSheet}
      />
    ));
  };

  return (
    <>
      <ScreenHeader right={<HeaderActions />}>
        <div className="loc-pill" style={{ cursor: 'default' }}>
          <Icon name="mapPin" />
          <span>{user?.society?.name || 'Your society'}</span>
        </div>
        <div className="search-wrap">
          <Icon name="search" className="ic search-ic" />
          <input
            className="search-input"
            placeholder="Search title, author, genre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search books"
          />
          <button className="search-filt-btn" onClick={openFilters} aria-label="Search and filter">
            <Icon name="sliders" />
          </button>
        </div>
      </ScreenHeader>

      <div className="app-scroll">
        <RadiusStepper />

        <StatTiles
          tiles={[
            { icon: 'bookOpen', value: stats?.totalBooks ?? 0, label: 'Books listed', href: '/books' },
            { icon: 'users', value: stats?.totalMembers ?? 0, label: 'Members' },
            { icon: 'building', value: stats?.totalSocieties ?? 0, label: 'Societies' },
            { icon: 'heart', value: wishlist.length, label: 'My wishlist', href: '/wishlist' },
          ]}
        />

        <div className="section-row">
          <SectionTitle>Available near you</SectionTitle>
          <button
            className="link-green"
            onClick={() => {
              setIncludeNearby((v) => !v);
              showToast(includeNearby ? 'Showing your society only' : 'Now showing nearby societies too');
            }}
          >
            {includeNearby ? 'This society' : 'Nearby'}
            <Icon name="mapPin" style={{ width: 12, height: 12 }} />
          </button>
        </div>

        <GenreChips
          genre={genre}
          onGenre={setGenre}
          sortLabel={sortLabel}
          onSort={openSort}
          onFilters={openFilters}
        />

        <BookGrid
          books={books}
          emptyTitle={query ? `No books match “${query}”.` : 'No books nearby yet.'}
          emptyHint={query ? 'Try a different title or widen your radius.' : 'Widen your discovery radius or list the first book.'}
        />
      </div>

      <button className="fab" onClick={() => router.push('/books/add')} aria-label="List a book">
        <Icon name="plus" />
      </button>
      <BottomNav />
    </>
  );
}
