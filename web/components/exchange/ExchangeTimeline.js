import Icon from '@/components/ui/Icon';

/** The vertical request → accepted → pickup → handover → rated timeline (§11). */
export default function ExchangeTimeline({ steps }) {
  return (
    <div className="tl">
      {steps.map((s) => (
        <div className={`tl-item${s.done ? ' done' : ''}${s.current ? ' current' : ''}`} key={s.label}>
          <div className="tl-dot">
            {s.done ? <Icon name="check" style={{ width: 11, height: 11 }} /> : s.current ? '●' : ''}
          </div>
          <div className="tl-txt">
            <b>{s.label}</b>
            <span>{s.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
