'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useSocieties } from '@/hooks/useSocieties';
import { societiesService } from '@/services/societies.service';

/**
 * City -> Society -> Block/Tower -> Flat/Unit selection, shared by signup,
 * the post-OTP onboarding step and Profile Settings' location change (§5).
 * The flat number is collected but never shown publicly — the block is what's
 * shown instead, which is why it has to be a real `SocietyBlock` id rather
 * than free text: the privacy redaction server-side (`toListingLocation`)
 * only has a block name to fall back on when it's a real relation, not a
 * string a member typed in.
 *
 * Not every city/society is listed yet — "Request to add it" switches to a
 * free-text city+society name instead, submitted alongside whichever call
 * `onChange`'s owner makes (signup, onboarding finish, or a location-change
 * save) as `values.locationRequest`. The backend creates a pending
 * `LocationRequest` row for an admin to approve/reject (see the Societies
 * section of the admin console) rather than a real society right away.
 */
export default function SocietyFields({ values, onChange }) {
  const { societies, loading } = useSocieties();
  const [blocks, setBlocks] = useState([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const cities = useMemo(() => {
    const seen = new Map();
    societies.forEach((s) => { if (s.city && !seen.has(s.city.id)) seen.set(s.city.id, s.city); });
    return [...seen.values()];
  }, [societies]);

  const selectedSociety = societies.find((s) => s.id === values.societyId);
  const [cityId, setCityId] = useState('');

  useEffect(() => {
    if (!cityId && selectedSociety?.city) setCityId(selectedSociety.city.id);
  }, [selectedSociety, cityId]);

  const societiesInCity = cityId ? societies.filter((s) => s.city?.id === cityId) : societies;

  useEffect(() => {
    if (!values.societyId) return setBlocks([]);
    setBlocksLoading(true);
    societiesService.listBlocks(values.societyId)
      .then(setBlocks)
      .catch(() => setBlocks([]))
      .finally(() => setBlocksLoading(false));
  }, [values.societyId]);

  const startRequest = () => {
    setRequesting(true);
    onChange({ societyId: '', blockId: '', locationRequest: { cityName: '', societyName: '' } });
  };

  const cancelRequest = () => {
    setRequesting(false);
    onChange({ locationRequest: null });
  };

  const patchRequest = (patch) => {
    onChange({ locationRequest: { ...values.locationRequest, ...patch } });
  };

  if (requesting || values.locationRequest) {
    return (
      <>
        <div className="field">
          <label htmlFor="ob-req-city">City</label>
          <div className="input-wrap">
            <span className="input-ic-badge"><Icon name="mapPin" style={{ width: 14, height: 14 }} /></span>
            <input
              id="ob-req-city"
              className="has-badge"
              placeholder="e.g. Nagpur"
              value={values.locationRequest?.cityName || ''}
              onChange={(e) => patchRequest({ cityName: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ob-req-society">Your Society</label>
          <div className="input-wrap">
            <span className="input-ic-badge"><Icon name="building" style={{ width: 14, height: 14 }} /></span>
            <input
              id="ob-req-society"
              className="has-badge"
              placeholder="e.g. Lakeview Residency"
              value={values.locationRequest?.societyName || ''}
              onChange={(e) => patchRequest({ societyName: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ob-flat">Flat / Villa / Plot No. <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
          <div className="input-wrap">
            <span className="input-ic-badge"><Icon name="home" style={{ width: 14, height: 14 }} /></span>
            <input
              id="ob-flat"
              className="has-badge"
              placeholder="e.g. 402"
              value={values.flatUnit || ''}
              onChange={(e) => onChange({ flatUnit: e.target.value })}
            />
          </div>
        </div>

        <button type="button" className="link-green" style={{ margin: '2px 0 16px' }} onClick={cancelRequest}>
          ← Pick from the list instead
        </button>
      </>
    );
  }

  return (
    <>
      <div className="field">
        <label htmlFor="ob-city">City</label>
        <div className="input-wrap">
          <span className="input-ic-badge"><Icon name="mapPin" style={{ width: 14, height: 14 }} /></span>
          <select
            id="ob-city"
            className="has-badge"
            value={cityId}
            onChange={(e) => { setCityId(e.target.value); onChange({ societyId: '', blockId: '' }); }}
            disabled={loading}
          >
            <option value="">{loading ? 'Loading cities…' : 'All cities'}</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="ob-society">Your Society</label>
        <div className="input-wrap">
          <span className="input-ic-badge"><Icon name="building" style={{ width: 14, height: 14 }} /></span>
          <select
            id="ob-society"
            className="has-badge"
            value={values.societyId}
            onChange={(e) => onChange({ societyId: e.target.value, blockId: '' })}
            disabled={loading}
          >
            <option value="">{loading ? 'Loading societies…' : 'Select your society'}</option>
            {societiesInCity.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="ob-block">
            Block / Tower <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>
          </label>
          <div className="input-wrap">
            <span className="input-ic-badge"><Icon name="mapPin" style={{ width: 14, height: 14 }} /></span>
            <select
              id="ob-block"
              className="has-badge"
              value={values.blockId || ''}
              onChange={(e) => onChange({ blockId: e.target.value })}
              disabled={!values.societyId || blocksLoading}
            >
              <option value="">
                {!values.societyId ? 'Select a society first' : blocksLoading ? 'Loading…' : blocks.length ? 'Select a block' : 'No blocks listed'}
              </option>
              {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="ob-flat">Flat / Villa / Plot No.</label>
          <div className="input-wrap">
            <span className="input-ic-badge"><Icon name="home" style={{ width: 14, height: 14 }} /></span>
            <input
              id="ob-flat"
              className="has-badge"
              placeholder="e.g. 402"
              value={values.flatUnit || ''}
              onChange={(e) => onChange({ flatUnit: e.target.value })}
            />
          </div>
        </div>
      </div>

      <button type="button" className="link-green" style={{ margin: '2px 0 16px' }} onClick={startRequest}>
        Don&apos;t see your city or society? Request to add it
      </button>
    </>
  );
}
