'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import LocationMapPicker from '@/components/location/LocationMapPicker';
import { useSocieties } from '@/hooks/useSocieties';

/**
 * Address -> City -> Society selection, shared by signup, the post-OTP
 * onboarding step and Profile Settings' location change (§5).
 *
 * The home address is a single field (LocationMapPicker owns it) — tapping
 * in reveals a collapsed-by-default map below; typing there (debounced) or
 * panning the map both move the pin and fill this same field via reverse
 * geocoding, no separate always-on map or search box. City stays free text, not a picker —
 * the society list below it re-filters live to whatever's typed
 * (case-insensitive, matched against the cities that actually have a
 * society listed). Block/Tower and Flat/Unit are on hold for now (commented
 * out below, not removed) per the current design.
 *
 * Not every city/society is listed yet — "Request to add it" opens a popup
 * collecting the new society's own name/address/city (address via its own
 * map pin), submitted alongside whichever call `onChange`'s owner makes
 * (signup, onboarding finish, or a location-change save) as
 * `values.locationRequest`. The backend creates a pending `LocationRequest`
 * row for an admin to approve/reject (see the Societies section of the
 * admin console) rather than a real society right away.
 */
export default function SocietyFields({ values, onChange }) {
  const { societies, loading } = useSocieties();
  // A LOCAL overlay, not the shared `useSheet()` — Profile Settings' own
  // "Change Location" flow already renders SocietyFields *inside* a sheet,
  // and that provider only ever holds ONE sheet at a time (not a stack):
  // opening this popup via openSheet() there replaced the outer sheet
  // instead of layering over it, so closeSheet() on submit closed
  // everything and lost the whole location-change flow. Confirmed live.
  // Rendering our own independent overlay works the same inline (signup,
  // onboarding) and nested-in-a-sheet (Profile Settings) without depending
  // on which one the caller happens to be.
  const [requestOpen, setRequestOpen] = useState(false);

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

  const cancelRequest = () => onChange({ locationRequest: null });

  return (
    <>
      {requestOpen && (
        <div className="sheet-overlay">
          <div className="sheet-backdrop" onClick={() => setRequestOpen(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-head">
              <h3>Request a new society</h3>
              <button className="sheet-x" onClick={() => setRequestOpen(false)} aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
            <RequestSocietyForm
              initialCityName={cityText}
              onSubmit={(req) => {
                onChange({ societyId: '', blockId: '', locationRequest: req });
                setRequestOpen(false);
              }}
              onCancel={() => setRequestOpen(false)}
            />
          </div>
        </div>
      )}

      <LocationMapPicker
        address={values.address}
        lat={values.latitude}
        lng={values.longitude}
        onChange={({ lat, lng, address }) => onChange({ latitude: lat, longitude: lng, address })}
      />

      {values.locationRequest ? (
        <div className="field">
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '10px 12px', borderRadius: 10, background: 'var(--surface-muted, #f3f3ee)', fontSize: 12.5,
            }}
          >
            <span>
              Requesting <b>{values.locationRequest.societyName}</b>, {values.locationRequest.cityName}
              — pending admin approval.
            </span>
            <button type="button" className="link-green" onClick={cancelRequest}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
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

          <button type="button" className="link-green" style={{ margin: '2px 0 16px' }} onClick={() => setRequestOpen(true)}>
            Don&apos;t see your city or society? Request to add it
          </button>
        </>
      )}
    </>
  );
}

/** The popup body for "Request a new society" — 3 fields only: name,
 * address (via its own map pin), city (plain text, matching the city field
 * everywhere else in this form). */
function RequestSocietyForm({ initialCityName, onSubmit, onCancel }) {
  const [societyName, setSocietyName] = useState('');
  const [cityName, setCityName] = useState(initialCityName || '');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState({ lat: null, lng: null });

  const canSubmit = societyName.trim() && cityName.trim() && address.trim();

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      societyName: societyName.trim(),
      cityName: cityName.trim(),
      address: address.trim(),
      latitude: coords.lat,
      longitude: coords.lng,
    });
  };

  return (
    <>
      <div className="field">
        <label htmlFor="req-soc-name">Society Name</label>
        <div className="input-wrap">
          <span className="input-ic-badge"><Icon name="building" style={{ width: 14, height: 14 }} /></span>
          <input
            id="req-soc-name"
            className="has-badge"
            placeholder="e.g. Lakeview Residency"
            value={societyName}
            onChange={(e) => setSocietyName(e.target.value)}
          />
        </div>
      </div>

      <LocationMapPicker
        label="Society Address"
        address={address}
        lat={coords.lat}
        lng={coords.lng}
        onChange={({ lat, lng, address: a }) => { setCoords({ lat, lng }); setAddress(a); }}
      />

      <div className="field">
        <label htmlFor="req-soc-city">City</label>
        <div className="input-wrap">
          <span className="input-ic-badge"><Icon name="mapPin" style={{ width: 14, height: 14 }} /></span>
          <input
            id="req-soc-city"
            className="has-badge"
            placeholder="e.g. Nagpur"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={!canSubmit} onClick={submit}>
          Submit request
        </button>
      </div>
    </>
  );
}
