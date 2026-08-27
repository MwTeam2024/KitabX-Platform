'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useSocieties } from '@/hooks/useSocieties';

/**
 * Address -> City -> Society selection, shared by signup, the post-OTP
 * onboarding step and Profile Settings' location change (§5).
 *
 * City is free text, not a picker — the society list below it re-filters
 * live to whatever's typed (case-insensitive, matched against the cities
 * that actually have a society listed). Block/Tower and Flat/Unit are on
 * hold for now (commented out below, not removed) per the current design.
 *
 * Not every city/society is listed yet — "Request to add it" switches City
 * and Society to free text instead, submitted alongside whichever call
 * `onChange`'s owner makes (signup, onboarding finish, or a location-change
 * save) as `values.locationRequest`. The backend creates a pending
 * `LocationRequest` row for an admin to approve/reject (see the Societies
 * section of the admin console) rather than a real society right away.
 */
export default function SocietyFields({ values, onChange }) {
  const { societies, loading } = useSocieties();
  const [requesting, setRequesting] = useState(false);

  const selectedSociety = societies.find((s) => s.id === values.societyId);

  // Seed the typed city from whichever society this form already has
  // selected (editing an existing location) — only once, so it doesn't
  // fight with the member's own typing afterward.
  useEffect(() => {
    if (values.cityText === undefined && selectedSociety?.city) {
      onChange({ cityText: selectedSociety.city.name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSociety]);

  const cityText = values.cityText || '';

  const matchedCity = cityText.trim()
    ? societies.find((s) => s.city?.name.toLowerCase() === cityText.trim().toLowerCase())?.city
    : null;
  const societiesInCity = matchedCity ? societies.filter((s) => s.city?.id === matchedCity.id) : [];

  const onCityInput = (text) => {
    // Typing a different city invalidates whatever society was picked for
    // the old one — re-select is required rather than silently keeping a
    // society that's no longer even shown.
    onChange({ cityText: text, societyId: '', blockId: '' });
  };

  const startRequest = () => {
    setRequesting(true);
    onChange({ societyId: '', blockId: '', locationRequest: { cityName: cityText, societyName: '' } });
  };

  const cancelRequest = () => {
    setRequesting(false);
    onChange({ locationRequest: null });
  };

  const patchRequest = (patch) => {
    onChange({ locationRequest: { ...values.locationRequest, ...patch } });
  };

  const addressField = (
    <div className="field">
      <label htmlFor="ob-address">Address</label>
      <div className="input-wrap">
        <span className="input-ic-badge"><Icon name="home" style={{ width: 14, height: 14 }} /></span>
        <input
          id="ob-address"
          className="has-badge"
          placeholder="e.g. B-402, near XYZ mall"
          value={values.address || ''}
          onChange={(e) => onChange({ address: e.target.value })}
        />
      </div>
    </div>
  );

  if (requesting || values.locationRequest) {
    return (
      <>
        {addressField}

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

        {/* Block/Tower + Flat/Villa/Plot No. — on hold for now, not removed.
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
        */}

        <button type="button" className="link-green" style={{ margin: '2px 0 16px' }} onClick={cancelRequest}>
          ← Pick from the list instead
        </button>
      </>
    );
  }

  return (
    <>
      {addressField}

      <div className="field">
        <label htmlFor="ob-city">City</label>
        <div className="input-wrap">
          <span className="input-ic-badge"><Icon name="mapPin" style={{ width: 14, height: 14 }} /></span>
          <input
            id="ob-city"
            className="has-badge"
            placeholder={loading ? 'Loading cities…' : 'Start typing your city'}
            value={cityText}
            onChange={(e) => onCityInput(e.target.value)}
            disabled={loading}
          />
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
            disabled={loading || !matchedCity}
          >
            <option value="">
              {loading ? 'Loading societies…'
                : !cityText.trim() ? 'Type your city first'
                : !matchedCity ? "We don't have society yet"
                : societiesInCity.length ? 'Select your society' : 'No societies listed in this city yet'}
            </option>
            {societiesInCity.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Block/Tower + Flat/Villa/Plot No. — on hold for now, not removed.
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
      */}

      <button type="button" className="link-green" style={{ margin: '2px 0 16px' }} onClick={startRequest}>
        Don&apos;t see your city or society? Request to add it
      </button>
    </>
  );
}
