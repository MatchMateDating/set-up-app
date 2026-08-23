import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import './imageLightboxModal.css';

const ImageLightboxModal = ({ uris = [], index, onIndexChange, onClose }) => {
  const visible = index != null && uris.length > 0;

  const goNext = useCallback(() => {
    onIndexChange((i) => {
      if (i == null) return i;
      const last = uris.length - 1;
      if (last < 0) return null;
      return i < last ? i + 1 : i;
    });
  }, [uris.length, onIndexChange]);

  const goPrev = useCallback(() => {
    onIndexChange((i) => {
      if (i == null) return i;
      return i > 0 ? i - 1 : i;
    });
  }, [onIndexChange]);

  useEffect(() => {
    if (!visible) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose, goNext, goPrev]);

  if (!visible) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose} role="presentation">
      <button
        type="button"
        className="lightbox-close"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={24} color="#fff" />
      </button>

      {uris.length > 1 && (
        <button
          type="button"
          className="lightbox-nav lightbox-nav-prev"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous photo"
          disabled={index <= 0}
        >
          <ChevronLeft size={28} color="#fff" />
        </button>
      )}

      <img
        src={uris[index]}
        alt=""
        className="lightbox-image"
        onClick={(e) => e.stopPropagation()}
      />

      {uris.length > 1 && (
        <button
          type="button"
          className="lightbox-nav lightbox-nav-next"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next photo"
          disabled={index >= uris.length - 1}
        >
          <ChevronRight size={28} color="#fff" />
        </button>
      )}
    </div>
  );
};

export default ImageLightboxModal;
