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
import FilterChips from '@/components/discovery/FilterChips';
import FacetSheet from '@/components/discovery/FacetSheet';
import SortSheet from '@/components/discovery/SortSheet';
import FilterSheet from '@/components/discovery/FilterSheet';
import BookGrid from '@/components/books/BookGrid';
import { SectionTitle } from '@/components/ui/NoteBox';
import { useBooks } from '@/hooks/useBooks';
import { useFacets } from '@/hooks/useFacets';
import { CONDITIONS } from '@/lib/mockData';
import { useLocation } from '@/hooks/useLocation';
import { useAppData } from '@/contexts/AppDataContext';
import { useAppSheets } from '@/hooks/useAppSheets';
import { useToast } from '@/components/ui/ToastProvider';
import { useDebounce } from '@/hooks/useDebounce';
import { discoveryService } from '@/services/discovery.service';

const FILTERS_KEY = 'kitabx.discoveryFilters';

// Saved from before these took several values at once: a single string
// ("Fiction", or "All" for none) becomes a one-item list.
const asList = (v) => (Array.isArray(v) ? v : v && v !== 'All' ? [v] : []);

const FACET_TITLES = { genre: 'Genre', language: 'Language', condition: 'Condition' };
const CONDITION_LABELS = CONDITIONS.map((c) => c.label);

function loadSavedFilters() {
  try {
    return JSON.parse(window.localStorage.getItem(FILTERS_KEY)) || {};
  } catch {
    return {};
  }
}

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
  // Filters/sort are restored from the last visit so a refresh keeps them
  // (the search text itself is deliberately not saved).
  const [saved] = useState(loadSavedFilters);
  const [genre, setGenre] = useState(() => asList(saved.genre));
  const [language, setLanguage] = useState(() => asList(saved.language));
  const [condition, setCondition] = useState(() => asList(saved.condition));
  const facets = useFacets();
  const [sort, setSort] = useState(saved.sort ?? 'newest');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    try {
      window.localStorage.setItem(FILTERS_KEY, JSON.stringify({ genre, language, condition, sort }));
    } catch {
      // Storage blocked — filters just won't persist.
    }
  }, [genre, language, condition, sort]);

  useEffect(() => {
    searchBooks({ radiusKm, genre, language, condition, q: debouncedQuery, sort }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm, genre, language, condition, debouncedQuery, sort]);

  useEffect(() => {
    discoveryService.stats().then(setStats).catch(() => {});
  }, []);

  const { books } = useBooks({ keys: discoveryKeys, sort });
  const setters = { genre: setGenre, language: setLanguage, condition: setCondition };
  const selected = { genre, language, condition };
  const optionsFor = { genre: facets.genres, language: facets.languages, condition: CONDITION_LABELS };

  const openFacet = (key) => {
    openSheet(FACET_TITLES[key], (
      <FacetSheet
        options={optionsFor[key]}
        selected={selected[key]}
        onApply={setters[key]}
        onClose={closeSheet}
      />
    ));
  };

  const clearAll = () => { setGenre([]); setLanguage([]); setCondition([]); };

  const openSort = () => {
    openSheet('Sort by', (
      <SortSheet
        value={sort}
        onSelect={(key) => { setSort(key); closeSheet(); }}
      />
    ));
  };

  const openFilters = () => {
    openSheet('Search & Filters', (
      <FilterSheet
        genre={genre}
        language={language}
        condition={condition}
        sort={sort}
        onApply={(next) => {
          setGenre(next.genre);
          setLanguage(next.language);
          setCondition(next.condition);
          setSort(next.sort || 'newest');
          showToast('Filters applied');
        }}
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
            placeholder="Search title, author, ISBN…"
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

        {/* Admin Settings → "Show Discover stats". Off until stats says otherwise,
            so nothing flashes in while it loads. */}
        {stats?.show && (
          <StatTiles
            tiles={[
              { icon: 'bookOpen', value: stats?.totalBooks ?? 0, label: 'Books listed' },
              { icon: 'users', value: stats?.totalMembers ?? 0, label: 'Members' },
              { icon: 'building', value: stats?.totalSocieties ?? 0, label: 'Societies' },
              { icon: 'heart', value: wishlist.length, label: 'My wishlist' },
            ]}
          />
        )}

        <div className="section-row">
          <SectionTitle>Available near you</SectionTitle>
        </div>

        <FilterChips
          selected={selected}
          sortActive={sort !== 'newest'}
          onClearAll={clearAll}
          onOpenFacet={openFacet}
          onOpenSort={openSort}
        />

        <BookGrid
          books={books}
          emptyTitle={query ? `No books match “${query}”.` : 'No books nearby yet.'}
          emptyHint={query ? 'Try a different title or widen your radius.' : 'Widen your discovery radius or list the first book.'}
        />
      </div>

      <button className="fab" onClick={() => router.push('/books/add')}>
        List Book
      </button>
      <BottomNav />
    </>
  );
}
