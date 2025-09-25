import React from 'react';
import './images.css'; // Make sure you have styles for both grid and full-width

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;


const ImageGallery = ({ images = [], editing, onDeleteImage, onPlaceholderClick, layout = "grid" }) => {
  return (
    <div className={`image-gallery ${layout === "grid" ? "image-grid" : "image-full"}`}>
      {images.map((img, index) => (
        <div key={index} className="image-wrapper">
          <img
            src={`${API_BASE_URL}${img.image_url}`}
            alt={`Profile ${index}`}
            className={layout === "grid" ? "grid-image" : "full-image"}
          />
          {editing && (
            <button
              type="button"
              className="delete-button"
              onClick={(e) => { e.preventDefault(); onDeleteImage(img.id); }}
            >
              x
            </button>
          )}
        </div>
      ))}

      {editing &&
        [...Array(9 - images.length)].map((_, index) => (
          <div key={index} className="image-placeholder" onClick={onPlaceholderClick}>
            <span className="plus-icon">+</span>
          </div>
        ))}
    </div>
  );
};

export default ImageGallery;