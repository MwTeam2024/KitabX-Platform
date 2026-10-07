'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader, { StepProgress } from '@/components/ui/ScreenHeader';
import PhotoUploader from '@/components/books/PhotoUploader';
import { ConditionGrid } from '@/components/ui/PillSelect';
import { useBookDraft } from '@/contexts/BookDraftContext';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import ListSelect from '@/components/ui/ListSelect';
import { useFacets } from '@/hooks/useFacets';
import { CONDITIONS } from '@/lib/mockData';

/**
 * Screen 09 — every field the source plan requires for a listing: title, author,
 * genre, language, ISBN, edition year, condition + description, cover photo and
 * optional pickup instructions.
 */
export default function BookDetailsForm({ editKey }) {
  const router = useRouter();
  const showToast = useToast();
  const { books } = useAppData();
  const { draft, patchDraft, loadForEdit } = useBookDraft();
  const facets = useFacets();
  // A saved/scanned value is always selectable even if it isn't in the list
  // yet — and one that only differs by case/hyphens ("non fiction") selects
  // the list's own spelling instead of adding a near-duplicate option.
  const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const resolve = (options, current) => options.find((o) => norm(o) === norm(current)) ?? current;
  const withCurrent = (options, current) => (current && !options.some((o) => norm(o) === norm(current)) ? [current, ...options] : options);

  useEffect(() => {
    if (editKey && books[editKey] && draft.editKey !== editKey) loadForEdit(books[editKey]);
  }, [editKey, books, draft.editKey, loadForEdit]);

  const editing = !!draft.editKey;

  const toPreview = () => {
    if (!draft.title.trim()) return showToast('Please add the book title');
    if (!draft.author.trim()) return showToast('Please add the author');
    if (!draft.genre) return showToast('Please choose a genre');
    if (!draft.photos.length) return showToast('Add at least one photo of your copy');
    router.push('/books/add/preview');
  };

  return (
    <>
      <ScreenHeader back backHref={editing ? `/books/${draft.editKey}` : '/books/add'}>
        <StepProgress
          label={editing ? 'Edit listing — book details' : 'Step 2 of 3 — Book details'}
          percent={88}
        />
      </ScreenHeader>

      <div className="app-scroll pad-nav" style={{ padding: '20px 16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, marginBottom: 4 }}>
          Book details
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Just the basics — we keep it quick.
        </div>

        <div className="field">
          <label htmlFor="nb-title">Book Title</label>
          <input
            id="nb-title" placeholder="e.g. The Alchemist"
            value={draft.title} onChange={(e) => patchDraft({ title: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="nb-author">Author</label>
          <input
            id="nb-author" placeholder="e.g. Paulo Coelho"
            value={draft.author} onChange={(e) => patchDraft({ author: e.target.value })}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="nb-genre">Genre</label>
            <ListSelect
              id="nb-genre"
              value={resolve(facets.genres, draft.genre)}
              options={withCurrent(facets.genres, draft.genre)}
              placeholder="Select genre"
              wide
              onChange={(g) => patchDraft({ genre: g })}
            />
          </div>
          <div className="field">
            <label htmlFor="nb-lang">Language</label>
            <ListSelect
              id="nb-lang"
              value={resolve(facets.languages, draft.lang)}
              options={withCurrent(facets.languages, draft.lang)}
              placeholder="Select language"
              wide
              align="right"
              onChange={(l) => patchDraft({ lang: l })}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="nb-isbn">
              ISBN Number <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="nb-isbn" placeholder="e.g. 978-0062315007" inputMode="numeric"
              value={draft.isbn} onChange={(e) => patchDraft({ isbn: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="nb-year">
              Publication / Edition Year <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="nb-year" placeholder="e.g. 2014" inputMode="numeric" maxLength={4}
              value={draft.year} onChange={(e) => patchDraft({ year: e.target.value.replace(/\D/g, '') })}
            />
          </div>
        </div>

        <div className="field">
          <label>Condition — of your physical copy</label>
          <ConditionGrid options={CONDITIONS} value={draft.cond} onChange={(cond) => patchDraft({ cond })} />
        </div>

        <div className="field">
          <label htmlFor="nb-cond-desc">
            Condition description <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            id="nb-cond-desc"
            placeholder="e.g. Spine is intact, a few pencil notes in chapter 3"
            value={draft.condDesc || ''}
            onChange={(e) => patchDraft({ condDesc: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="nb-pickup">
            Pickup Instructions <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            id="nb-pickup"
            placeholder="e.g. Available after 6 PM on weekdays, ring the doorbell twice"
            value={draft.pickup} onChange={(e) => patchDraft({ pickup: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Photos <span style={{ color: 'var(--sindoor)' }}>*</span></label>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>
            Up to 3 real photos of your copy — helps the community trust your listing
          </div>
          <PhotoUploader photos={draft.photos} onChange={(photos) => patchDraft({ photos })} />
        </div>
      </div>

      <div className="sticky-cta" style={{ flexDirection: 'column', gap: 8 }}>
        <button className="btn btn-primary" onClick={toPreview}>
          Preview listing<Icon name="arrowRight" style={{ width: 14, height: 14 }} />
        </button>
        <button
          className="btn btn-outline"
          onClick={() => router.push(editing ? `/books/${draft.editKey}` : '/books/add')}
        >
          <Icon name="arrowLeft" style={{ width: 14, height: 14 }} />Back
        </button>
      </div>
    </>
  );
}
