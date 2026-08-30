import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Image, Images, List, Palette } from 'lucide-react';
import './editToolbar.css';

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial', fontFamily: 'Arial' },
  { label: 'Times', value: 'Times New Roman', fontFamily: 'Times New Roman' },
  { label: 'Courier', value: 'Courier New', fontFamily: 'Courier New' },
  { label: 'Georgia', value: 'Georgia', fontFamily: 'Georgia' },
  { label: 'Verdana', value: 'Verdana', fontFamily: 'Verdana' },
];

const THEME_OPTIONS = [
  { label: 'Classic', value: 'classic', swatch: 'classic' },
  { label: 'pixelCloud', value: 'pixelCloud', swatch: 'pixelCloud' },
  { label: 'pixelFlower', value: 'pixelFlower', swatch: 'pixelFlower' },
  { label: 'pixelCactus', value: 'pixelCactus', swatch: 'pixelCactus' },
];

const ThemeSwatch = ({ swatch }) => (
  <span
    className={`edit-toolbar-swatch edit-toolbar-swatch-${swatch}`}
    aria-hidden="true"
  />
);

const DropdownItem = ({ selected, accentColor, onClick, children }) => (
  <button type="button" className="edit-toolbar-dropdown-item" onClick={onClick}>
    {children}
    {selected ? (
      <span className="edit-toolbar-check" style={{ color: accentColor }}>
        ✓
      </span>
    ) : (
      <span className="edit-toolbar-check-placeholder" />
    )}
  </button>
);

const FontDropdown = ({ value, accentColor, open, onToggle, onSelect }) => {
  const selected = FONT_OPTIONS.find((opt) => opt.value === value) || FONT_OPTIONS[0];

  return (
    <div className={`edit-toolbar-dropdown-anchor${open ? ' is-open' : ''}`}>
      <button type="button" className="edit-toolbar-trigger" onClick={onToggle}>
        <span className="edit-toolbar-font-icon" style={{ color: accentColor }}>
          Aa
        </span>
        <span className="edit-toolbar-trigger-text">{selected.label}</span>
        {open ? <ChevronUp size={14} color="#6B7280" /> : <ChevronDown size={14} color="#6B7280" />}
      </button>
      {open ? (
        <div className="edit-toolbar-dropdown-menu">
          {FONT_OPTIONS.map((opt, index) => (
            <React.Fragment key={opt.value}>
              {index > 0 ? <div className="edit-toolbar-dropdown-divider" /> : null}
              <DropdownItem
                selected={value === opt.value}
                accentColor={accentColor}
                onClick={() => onSelect(opt.value)}
              >
                <span style={{ fontFamily: opt.fontFamily }}>{opt.label}</span>
              </DropdownItem>
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const ThemeDropdown = ({ value, accentColor, open, onToggle, onSelect }) => {
  const normalizedValue = value === 'pixelClouds' ? 'pixelCloud' : value;
  const selected =
    THEME_OPTIONS.find((opt) => opt.value === normalizedValue) || THEME_OPTIONS[0];

  return (
    <div className={`edit-toolbar-dropdown-anchor${open ? ' is-open' : ''}`}>
      <button type="button" className="edit-toolbar-trigger" onClick={onToggle}>
        <Palette size={16} color={accentColor} />
        <span className="edit-toolbar-trigger-text">{selected.label}</span>
        {open ? <ChevronUp size={14} color="#6B7280" /> : <ChevronDown size={14} color="#6B7280" />}
      </button>
      {open ? (
        <div className="edit-toolbar-dropdown-menu">
          {THEME_OPTIONS.map((opt, index) => (
            <React.Fragment key={opt.value}>
              {index > 0 ? <div className="edit-toolbar-dropdown-divider" /> : null}
              <DropdownItem
                selected={normalizedValue === opt.value}
                accentColor={accentColor}
                onClick={() => onSelect(opt.value)}
              >
                <ThemeSwatch swatch={opt.swatch} />
                <span>{opt.label}</span>
              </DropdownItem>
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const EditToolbar = ({
  formData,
  handleInputChange,
  editing = true,
  accentColor = '#ef4d73',
}) => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!openDropdown) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openDropdown]);

  if (!editing || !formData) return null;

  const update = (name, value) => {
    handleInputChange({ target: { name, value } });
  };

  const toggleDropdown = (key) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const layout = formData.imageLayout === 'grid' ? 'topRow' : formData.imageLayout;

  return (
    <div
      ref={rootRef}
      className={`edit-toolbar${openDropdown ? ' edit-toolbar-dropdown-open' : ''}`}
    >
      <div className="edit-toolbar-grid">
        <div className={`edit-toolbar-item${openDropdown === 'font' ? ' is-open' : ''}`}>
          <span className="edit-toolbar-label">Font</span>
          <FontDropdown
            value={formData.fontFamily}
            accentColor={accentColor}
            open={openDropdown === 'font'}
            onToggle={() => toggleDropdown('font')}
            onSelect={(v) => {
              update('fontFamily', v);
              setOpenDropdown(null);
            }}
          />
        </div>

        <div className={`edit-toolbar-item${openDropdown === 'theme' ? ' is-open' : ''}`}>
          <span className="edit-toolbar-label">Theme</span>
          <ThemeDropdown
            value={formData.profileStyle}
            accentColor={accentColor}
            open={openDropdown === 'theme'}
            onToggle={() => toggleDropdown('theme')}
            onSelect={(v) => {
              update('profileStyle', v);
              setOpenDropdown(null);
            }}
          />
        </div>

        <div className="edit-toolbar-item edit-toolbar-layout-item">
          <span className="edit-toolbar-label">Layout</span>
          <div className="edit-toolbar-layout-toggle">
            <button
              type="button"
              className={`edit-toolbar-layout-btn${layout === 'topRow' ? ' is-active' : ''}`}
              style={layout === 'topRow' ? { backgroundColor: accentColor } : undefined}
              onClick={() => update('imageLayout', 'topRow')}
              aria-label="Top row layout"
            >
              <Images size={18} color={layout === 'topRow' ? '#fff' : accentColor} />
            </button>
            <button
              type="button"
              className={`edit-toolbar-layout-btn${layout === 'vertical' ? ' is-active' : ''}`}
              style={layout === 'vertical' ? { backgroundColor: accentColor } : undefined}
              onClick={() => update('imageLayout', 'vertical')}
              aria-label="Vertical layout"
            >
              <List size={18} color={layout === 'vertical' ? '#fff' : accentColor} />
            </button>
            <button
              type="button"
              className={`edit-toolbar-layout-btn${layout === 'heroStack' ? ' is-active' : ''}`}
              style={layout === 'heroStack' ? { backgroundColor: accentColor } : undefined}
              onClick={() => update('imageLayout', 'heroStack')}
              aria-label="Hero stack layout"
            >
              <Image size={18} color={layout === 'heroStack' ? '#fff' : accentColor} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const editToolbar = (props) => <EditToolbar {...props} />;
