import { useEffect } from 'react';

export function Modal({ title, onClose, children, narrow }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        style={narrow ? { maxWidth: 400 } : undefined}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const ErrorText = ({ children }) => (children ? <div className="form-error" role="alert">{children}</div> : null);

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map(([key, label]) => (
      <button key={key} role="tab" aria-selected={value === key}
        className={`tab ${value === key ? 'active' : ''}`} onClick={() => onChange(key)}>{label}</button>
    ))}
  </div>
);

const STEPS = ['Sent', 'Preparing', 'Ready', 'On the way', 'Delivered'];
const STEP_INDEX = { placed: 0, preparing: 1, ready_for_pickup: 2, out_for_delivery: 3, delivered: 4 };

export function OrderSteps({ status }) {
  if (status === 'cancelled') return null;
  const at = STEP_INDEX[status] ?? 0;
  return (
    <div className="steps" aria-label={`Order progress: ${STEPS[at]}`}>
      {STEPS.map((s, i) => <div key={s} className={`step ${i <= at ? 'done' : ''}`}>{s}</div>)}
    </div>
  );
}

export const Loading = () => <p className="muted" style={{ padding: '20px 0' }}>Loading...</p>;
