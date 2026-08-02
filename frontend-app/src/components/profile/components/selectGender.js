import React from 'react';
import './selectGender.css';

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'nonbinary', label: 'Non-Binary' },
];

const SelectGender = ({
  selected,
  onChange,
  accentColor = '#6c5ce7',
  surfaceColor,
}) => {
  const handleSelect = (value) => {
    onChange(selected === value ? '' : value);
  };

  return (
    <div className="select-gender">
      {GENDER_OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`select-gender-option${isSelected ? ' selected' : ''}`}
            style={
              isSelected
                ? { backgroundColor: accentColor, borderColor: accentColor }
                : surfaceColor
                  ? { backgroundColor: surfaceColor }
                  : undefined
            }
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SelectGender;
