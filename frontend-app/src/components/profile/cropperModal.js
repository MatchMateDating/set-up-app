import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from './cropImage';
import './cropperModal.css';

const CropperModal = ({ imageSrc, onClose, onCropComplete }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const handleCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropAndSave = async () => {
    if (!croppedAreaPixels) return;
    const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
    onCropComplete(croppedImage);  // send back to parent
  };

  function pointWithinRange(degrees) {
    return (degrees + 360) % 360;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="cropper-container">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>
        <div className="controls">
          <div className="control-group">
            <label>Zoom</label>
            <input
              type="range"
              min={1}
              max={5}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Rotate</label>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotation}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const snapPoints = [0, 90, 180, 270, 360];
                const snapThreshold = 5;
                const snappedVal = snapPoints.find((point) => Math.abs(val - point) <= snapThreshold);
                setRotation(snappedVal !== undefined ? pointWithinRange(snappedVal) : val);
              }}
            />
          </div>

          <div className="buttons">
            <button onClick={onClose}>Cancel</button>
            <button onClick={handleCropAndSave}>Crop & Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CropperModal;

