import React, { useEffect, useMemo, useRef, useState } from 'react';
import './BirthdatePickerModal.css';

const MONTHS_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WHEEL_ROW_HEIGHT = 40;
const WHEEL_VIEWPORT_HEIGHT = 200;

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampBirthdate(date, minDate, maxDate) {
  const t = date.getTime();
  if (t < minDate.getTime()) return new Date(minDate);
  if (t > maxDate.getTime()) return new Date(maxDate);
  return new Date(date);
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function BirthdateWheelColumn({ items, value, onChange }) {
  const scrollRef = useRef(null);
  const syncingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const pad = (WHEEL_VIEWPORT_HEIGHT - WHEEL_ROW_HEIGHT) / 2;
  const valueKey = String(value);
  const selectedIndex = Math.max(
    0,
    items.findIndex((it) => String(it.value) === valueKey)
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const y = selectedIndex * WHEEL_ROW_HEIGHT;
    syncingRef.current = true;
    const id = requestAnimationFrame(() => {
      el.scrollTop = y;
      setTimeout(() => {
        syncingRef.current = false;
      }, 120);
    });
    return () => cancelAnimationFrame(id);
  }, [selectedIndex, items.length, valueKey]);

  useEffect(
    () => () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    },
    []
  );

  const handleScrollEnd = () => {
    const el = scrollRef.current;
    if (!el || syncingRef.current) return;
    let i = Math.round(el.scrollTop / WHEEL_ROW_HEIGHT);
    i = Math.max(0, Math.min(items.length - 1, i));
    const snappedY = i * WHEEL_ROW_HEIGHT;
    if (Math.abs(el.scrollTop - snappedY) > 1) {
      el.scrollTo({ top: snappedY, behavior: 'smooth' });
    }
    const next = items[i];
    if (next && String(next.value) !== valueKey) {
      onChange(next.value);
    }
  };

  return (
    <div
      className="birth-wheel-scroll"
      ref={scrollRef}
      style={{
        height: WHEEL_VIEWPORT_HEIGHT,
        scrollSnapType: 'y mandatory',
      }}
      onScroll={() => {
        if (syncingRef.current) return;
        window.clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = window.setTimeout(handleScrollEnd, 80);
      }}
    >
      <div style={{ height: pad }} />
      {items.map((it) => (
        <div
          key={String(it.value)}
          className="birth-wheel-row"
          style={{
            height: WHEEL_ROW_HEIGHT,
            scrollSnapAlign: 'center',
          }}
        >
          <span className="birth-wheel-row-text">{it.label}</span>
        </div>
      ))}
      <div style={{ height: pad }} />
    </div>
  );
}

export default function BirthdatePickerModal({
  visible,
  birthdateIso = '',
  onRequestClose,
  onSave,
  accentColor = '#ef4d73',
}) {
  const [tempBirthdate, setTempBirthdate] = useState(null);

  const maxBirthDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const minBirthDate = useMemo(() => {
    const d = new Date(maxBirthDate);
    d.setFullYear(d.getFullYear() - 100);
    return d;
  }, [maxBirthDate]);

  useEffect(() => {
    if (!visible) return;
    if (birthdateIso && /^\d{4}-\d{2}-\d{2}$/.test(birthdateIso)) {
      const [y, m, d] = birthdateIso.split('-').map(Number);
      setTempBirthdate(
        clampBirthdate(new Date(y, m - 1, d), minBirthDate, maxBirthDate)
      );
    } else {
      setTempBirthdate(new Date(maxBirthDate.getTime()));
    }
  }, [visible, birthdateIso, minBirthDate, maxBirthDate]);

  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onRequestClose]);

  const yearOptions = useMemo(() => {
    const minY = minBirthDate.getFullYear();
    const maxY = maxBirthDate.getFullYear();
    const years = [];
    for (let y = minY; y <= maxY; y += 1) years.push(y);
    return years;
  }, [minBirthDate, maxBirthDate]);

  const applyBirthWheel = (year, monthIndex, day) => {
    const maxD = daysInMonth(year, monthIndex);
    const d = Math.min(Math.max(1, day), maxD);
    let next = new Date(year, monthIndex, d);
    next = clampBirthdate(next, minBirthDate, maxBirthDate);
    setTempBirthdate(next);
  };

  const handleSave = () => {
    const dateObj = tempBirthdate || maxBirthDate;
    const normalized = clampBirthdate(dateObj, minBirthDate, maxBirthDate);
    onSave(toIsoDate(normalized));
  };

  if (!visible) return null;

  const cur = tempBirthdate || maxBirthDate;
  const y = cur.getFullYear();
  const m = cur.getMonth();
  const dim = daysInMonth(y, m);
  const safeDay = Math.min(cur.getDate(), dim);
  const monthItems = MONTHS_ABBR.map((label, idx) => ({ value: idx, label }));
  const dayItems = Array.from({ length: dim }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));
  const yearItems = yearOptions.map((yr) => ({
    value: yr,
    label: String(yr),
  }));

  return (
    <div className="birthdate-modal-root" role="presentation">
      <button
        type="button"
        className="birthdate-modal-backdrop"
        aria-label="Close"
        onClick={onRequestClose}
      />
      <div className="birthdate-modal-content" role="dialog" aria-label="Birthday">
        <div className="birthdate-modal-card">
          <div className="birthdate-fake-input">
            <span className="birthdate-fake-input-filled">
              {`${MONTHS_ABBR[m]} ${safeDay} ${y}`}
            </span>
          </div>

          <div
            className="birthdate-wheel-section"
            style={{ height: WHEEL_VIEWPORT_HEIGHT }}
          >
            <div className="birthdate-wheel-overlay" aria-hidden="true" />
            <div className="birthdate-wheel-row">
              <div className="birthdate-wheel-col">
                <BirthdateWheelColumn
                  items={monthItems}
                  value={m}
                  onChange={(monthIndex) => applyBirthWheel(y, monthIndex, safeDay)}
                />
              </div>
              <div className="birthdate-wheel-col">
                <BirthdateWheelColumn
                  items={dayItems}
                  value={safeDay}
                  onChange={(d) => applyBirthWheel(y, m, d)}
                />
              </div>
              <div className="birthdate-wheel-col">
                <BirthdateWheelColumn
                  items={yearItems}
                  value={y}
                  onChange={(yr) => applyBirthWheel(yr, m, safeDay)}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="birthdate-save-btn"
            style={{ backgroundColor: accentColor }}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
