'use client';

import { useEffect, useState } from 'react';
import { AdminTopline } from '@/components/admin/AdminShell';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { useSheet } from '@/components/ui/SheetProvider';
import { timeAgo } from '@/lib/dates';

/** Add/edit/delete cities and societies, plus review members' requests to
 * add a city/society that wasn't in the picker yet. */
export default function AdminSocietiesPage() {
  const showToast = useToast();
  const { openSheet, closeSheet } = useSheet();
  const {
    admin, loadAdminSocieties, addAdminSociety, editAdminSociety, deleteAdminSociety,
    loadAdminLocationRequests, approveAdminLocationRequest, rejectAdminLocationRequest,
  } = useAppData();

  useEffect(() => { loadAdminSocieties(); loadAdminLocationRequests(); }, [loadAdminSocieties, loadAdminLocationRequests]);

  const [tab, setTab] = useState('societies'); // 'societies' | 'requests'
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', city: '' });
  const [editing, setEditing] = useState(null); // { id, name, city }

  const approve = async (r) => {
    try {
      await approveAdminLocationRequest(r.id);
      showToast(`${r.societyName}, ${r.cityName} added — ${r.requestedBy} moved in`);
    } catch (err) {
      showToast(err.message || 'Could not approve this request');
    }
  };

  const reject = async (r) => {
    try {
      await rejectAdminLocationRequest(r.id);
      showToast('Request declined');
    } catch (err) {
      showToast(err.message || 'Could not decline this request');
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.city.trim()) return showToast('Please fill in both fields');
    try {
      await addAdminSociety(form.name.trim(), form.city.trim());
      setForm({ name: '', city: '' });
      setShowForm(false);
      showToast(`${form.name.trim()} added`);
    } catch (err) {
      showToast(err.message || 'Could not add this society');
    }
  };

  const commitEdit = async () => {
    const { id, name, city } = editing;
    try {
      await editAdminSociety(id, { name: name.trim(), cityName: city.trim() });
      setEditing(null);
      showToast('Society updated');
    } catch (err) {
      showToast(err.message || 'Could not update this society');
    }
  };

  const confirmDelete = (society) => {
    openSheet('Delete society', (
      <>
        <p style={{ fontSize: 13, color: 'var(--outer-muted)', lineHeight: 1.7, marginBottom: 14 }}>
          This removes <b>{society.name}</b> from every society picker (signup, discovery, admin lists).
          Its {society.memberCount} member{society.memberCount === 1 ? '' : 's'} and{' '}
          {society.activeListingCount} active listing{society.activeListingCount === 1 ? '' : 's'} are kept as-is —
          this can be undone by an admin later if needed.
        </p>
        <button
          className="btn btn-outline danger"
          onClick={async () => {
            try {
              await deleteAdminSociety(society.id);
              showToast(`${society.name} removed`);
            } catch (err) {
              showToast(err.message || 'Could not remove this society');
            }
            closeSheet();
          }}
        >
          Delete society
        </button>
      </>
    ));
  };

  return (
    <>
      <AdminTopline title="Societies">
        {tab === 'societies' && (
          <button className="ghost-btn" onClick={() => setShowForm((v) => !v)}>+ Add Society</button>
        )}
      </AdminTopline>

      <div className="admin-tabs" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          className={tab === 'societies' ? 'ghost-btn sm active' : 'ghost-btn sm'}
          onClick={() => setTab('societies')}
        >
          Societies ({admin.societies.length})
        </button>
        <button
          className={tab === 'requests' ? 'ghost-btn sm active' : 'ghost-btn sm'}
          onClick={() => setTab('requests')}
        >
          Requests ({admin.locationRequests.length})
        </button>
      </div>

      {tab === 'requests' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Requested By</th><th>Society</th><th>City</th><th>When</th><th /></tr>
            </thead>
            <tbody>
              {admin.locationRequests.map((r) => (
                <tr key={r.id}>
                  <td>{r.requestedBy}</td>
                  <td>{r.societyName}</td>
                  <td>{r.cityName}</td>
                  <td>{timeAgo(r.createdAt)}</td>
                  <td>
                    <div className="admin-actions">
                      <button className="ghost-btn sm" onClick={() => approve(r)}>Approve</button>
                      <button className="ghost-btn sm" onClick={() => reject(r)}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!admin.locationRequests.length && (
                <tr><td colSpan={5} style={{ color: 'var(--outer-muted)' }}>No pending city/society requests. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'societies' && showForm && (
        <div className="admin-panel" style={{ marginBottom: 16, maxWidth: 480 }}>
          <h4>Add Society</h4>
          <div className="field-row">
            <div className="field">
              <label htmlFor="soc-name">Society Name</label>
              <input
                id="soc-name" placeholder="e.g. Lakeview Residency"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="soc-city">City</label>
              <input
                id="soc-city" placeholder="e.g. Pune"
                value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 22px' }} onClick={save}>
            Save Society
          </button>
        </div>
      )}

      {tab === 'societies' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Society</th><th>City</th><th>Members</th><th>Active Listings</th><th /></tr>
            </thead>
            <tbody>
              {admin.societies.map((s) => {
                const isEditing = editing?.id === s.id;
                return (
                  <tr key={s.id}>
                    <td>
                      {isEditing ? (
                        <input
                          value={editing.name}
                          onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))}
                          style={{ width: '100%', padding: '5px 8px', fontSize: 12.5 }}
                        />
                      ) : s.name}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={editing.city}
                          onChange={(e) => setEditing((x) => ({ ...x, city: e.target.value }))}
                          style={{ width: '100%', padding: '5px 8px', fontSize: 12.5 }}
                        />
                      ) : (s.city?.name || '—')}
                    </td>
                    <td>{s.memberCount}</td>
                    <td>{s.activeListingCount}</td>
                    <td>
                      {isEditing ? (
                        <div className="admin-actions">
                          <button className="ghost-btn sm" onClick={commitEdit}>Save</button>
                          <button className="ghost-btn sm" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="admin-actions">
                          <button
                            className="ghost-btn sm"
                            onClick={() => setEditing({ id: s.id, name: s.name, city: s.city?.name || '' })}
                          >Edit</button>
                          <button className="ghost-btn sm" onClick={() => confirmDelete(s)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
