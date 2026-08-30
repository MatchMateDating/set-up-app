import React from 'react';
import { Plus } from 'lucide-react';
import './images.css';
import { getImageUrl, normalizeImageLayout } from './utils/profileUtils';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const MAX_IMAGES = 9;

const ImageGallery = ({
  images = [],
  editing,
  onDeleteImage,
  onPlaceholderClick,
  layout = 'topRow',
  accentColor = '#ef4d73',
}) => {
  const resolvedLayout = normalizeImageLayout(layout);
  const isTopRow = resolvedLayout === 'topRow';
  const isHeroStack = resolvedLayout === 'heroStack';
  const isVertical = !isTopRow && !isHeroStack;

  const renderDeleteButton = (imageId) =>
    editing ? (
      <button
        type="button"
        className="delete-button"
        onClick={(e) => {
          e.preventDefault();
          onDeleteImage(imageId);
        }}
        aria-label="Remove photo"
      >
        ×
      </button>
    ) : null;

  const renderImage = (img, index) => {
    const src = getImageUrl(img.image_url, API_BASE_URL);
    const isHeroMain = isHeroStack && index === 0;

    return (
      <div
        key={img.id || index}
        className={[
          'image-wrapper',
          isTopRow ? 'top-row-item' : '',
          isHeroStack ? (isHeroMain ? 'hero-main-wrapper' : 'hero-thumb-wrapper') : '',
          isVertical ? 'vertical-item' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <img
          src={src}
          alt={`Profile ${index + 1}`}
          className={[
            isTopRow ? 'top-row-image' : '',
            isHeroStack ? 'hero-image' : '',
            isVertical ? 'vertical-image' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {renderDeleteButton(img.id)}
      </div>
    );
  };

  const renderPlaceholder = (className) => {
    if (!editing || images.length >= MAX_IMAGES) return null;

    return (
      <button
        type="button"
        className={className}
        onClick={onPlaceholderClick}
        aria-label="Add photo"
      >
        <Plus size={32} color="#bbb" />
      </button>
    );
  };

  if (isTopRow) {
    return (
      <div className="image-gallery top-row-gallery">
        <div className="top-row-scroll">
          {images.map(renderImage)}
          {renderPlaceholder('image-placeholder top-row-placeholder')}
        </div>
        {editing ? (
          <p className="image-scroll-hint" style={{ color: accentColor }}>
            scroll to add →
          </p>
        ) : null}
      </div>
    );
  }

  if (isHeroStack) {
    return (
      <div className="image-gallery hero-stack-gallery">
        {images.map(renderImage)}
        {renderPlaceholder(
          images.length === 0 ? 'image-placeholder hero-main-placeholder' : 'image-placeholder hero-thumb-placeholder'
        )}
      </div>
    );
  }

  return (
    <div className="image-gallery vertical-gallery">
      {images.map(renderImage)}
      {renderPlaceholder('image-placeholder vertical-placeholder')}
    </div>
  );
};

export default ImageGallery;
