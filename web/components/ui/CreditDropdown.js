'use client';

import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import Icon from './Icon';
import { useAppData } from '@/contexts/AppDataContext';
import { closePanels } from '@/store/slices/uiSlice';

export default function CreditDropdown() {
  const dispatch = useDispatch();
  const router = useRouter();
  const isOpen = useSelector((s) => s.ui.isCreditOpen);
  const { credits } = useAppData();

  if (!isOpen) return null;

  return (
    <div className="notif-dropdown open">
      <div className="notif-backdrop" onClick={() => dispatch(closePanels())} />
      <div className="notif-panel">
        <div className="notif-panel-head">
          <h3>Your Credits</h3>
          <button className="sheet-x" onClick={() => dispatch(closePanels())} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex px-[18px] pb-4 gap-2">
          <div className="flex-1 text-center">
            <div className="font-display text-[21px] font-bold text-[var(--brand-2)]">{credits.available}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Available</div>
          </div>
          <div className="flex-1 text-center">
            <div className="font-display text-[21px] font-bold text-[var(--gold-deep)]">{credits.pending}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Pending</div>
          </div>
          <div className="flex-1 text-center">
            <div className="font-display text-[21px] font-bold text-[var(--sindoor)]">{credits.reserved}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Reserved</div>
          </div>
        </div>
        <button
          className="notif-item"
          style={{ borderTop: '1px solid var(--line)' }}
          onClick={() => { dispatch(closePanels()); router.push('/credits'); }}
        >
          <span className="nem">🪙</span>
          <div>
            <b>View full credit history</b>
            <span>Rules, transactions &amp; balances ›</span>
          </div>
        </button>
      </div>
    </div>
  );
}
