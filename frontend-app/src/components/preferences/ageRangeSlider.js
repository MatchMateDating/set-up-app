import React, { useCallback, useMemo } from 'react';
import './ageRangeSlider.css';

/**
 * Dual-thumb age range slider (matches mobile MultiSlider UX).
 */
function AgeRangeSlider({
  minValue = 18,
  maxValue = 50,
  min = 18,
  max = 100,
  step = 1,
  onChange,
  accentColor = '#ef4d73',
  disabled = false,
  className = '',
}) {
  const low = Math.min(Number(minValue) || min, Number(maxValue) || max);
  const high = Math.max(Number(minValue) || min, Number(maxValue) || max);

  const rangePercent = useMemo(() => {
    const span = max - min || 1;
    const left = ((low - min) / span) * 100;
    const right = ((high - min) / span) * 100;
    return { left, right };
  }, [low, high, min, max]);

  const emit = useCallback(
    (nextMin, nextMax) => {
      if (!onChange) return;
      const clampedMin = Math.max(min, Math.min(nextMin, nextMax));
      const clampedMax = Math.min(max, Math.max(nextMax, nextMin));
      onChange(clampedMin, clampedMax);
    },
    [onChange, min, max]
  );

  const handleMinChange = (e) => {
    const next = Number(e.target.value);
    emit(Math.min(next, high), high);
  };

  const handleMaxChange = (e) => {
    const next = Number(e.target.value);
    emit(low, Math.max(next, low));
  };

  const style = {
    '--age-slider-accent': accentColor,
    '--age-slider-left': `${rangePercent.left}%`,
    '--age-slider-right': `${rangePercent.right}%`,
  };

  // When thumbs overlap, raise the one with more room to move so it stays draggable.
  const mid = (min + max) / 2;
  const minOnTop = low === high && low > mid;

  return (
    <div
      className={`age-range-slider ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
      style={style}
    >
      <div className="age-range-slider-track" aria-hidden="true">
        <div className="age-range-slider-fill" />
      </div>
      <input
        type="range"
        className="age-range-slider-thumb age-range-slider-thumb-min"
        style={{ zIndex: minOnTop ? 5 : 3 }}
        min={min}
        max={max}
        step={step}
        value={low}
        onChange={handleMinChange}
        disabled={disabled}
        aria-label="Minimum preferred age"
      />
      <input
        type="range"
        className="age-range-slider-thumb age-range-slider-thumb-max"
        style={{ zIndex: minOnTop ? 4 : 5 }}
        min={min}
        max={max}
        step={step}
        value={high}
        onChange={handleMaxChange}
        disabled={disabled}
        aria-label="Maximum preferred age"
      />
    </div>
  );
}

export default AgeRangeSlider;
