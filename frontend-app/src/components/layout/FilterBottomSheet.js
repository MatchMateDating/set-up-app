import React from 'react';
import { X } from 'lucide-react';
import './filterBottomSheet.css';

/**
 * Mobile-parity filter sheet: backdrop + bottom panel with Save footer.
 */
const FilterBottomSheet = ({
  open,
  title = 'Filter',
  accentColor = '#6c5ce7',
  onClose,
  onSave,
  children,
}) => {
  if (!open) return null;

  return (
    <div className="filter-sheet-root" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="filter-sheet-backdrop"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div className="filter-sheet-panel">
        <div className="filter-sheet-header">
          <h3 className="filter-sheet-title">{title}</h3>
          <button
            type="button"
            className="filter-sheet-close"
            aria-label="Close filter"
            onClick={onClose}
          >
            <X size={22} color="#9ca3af" />
          </button>
        </div>
        <div className="filter-sheet-body">{children}</div>
        <div className="filter-sheet-footer">
          <button
            type="button"
            className="filter-sheet-save"
            style={{ backgroundColor: accentColor }}
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBottomSheet;
