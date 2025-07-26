export default function getCroppedImg(imageSrc, croppedAreaPixels, rotation = 0) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      const radians = rotation * Math.PI / 180;

      const imageWidth = image.width;
      const imageHeight = image.height;

      // Calculate bounding box of the rotated image
      const sin = Math.abs(Math.sin(radians));
      const cos = Math.abs(Math.cos(radians));
      const boundingBoxWidth = imageWidth * cos + imageHeight * sin;
      const boundingBoxHeight = imageWidth * sin + imageHeight * cos;

      // Create a temp canvas to draw the rotated image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = boundingBoxWidth;
      tempCanvas.height = boundingBoxHeight;

      // Move origin to center and rotate image
      tempCtx.translate(boundingBoxWidth / 2, boundingBoxHeight / 2);
      tempCtx.rotate(radians);
      tempCtx.drawImage(image, -imageWidth / 2, -imageHeight / 2);

      // Now crop from this rotated canvas
      const cropCanvas = document.createElement('canvas');
      const cropCtx = cropCanvas.getContext('2d');
      cropCanvas.width = croppedAreaPixels.width;
      cropCanvas.height = croppedAreaPixels.height;

      cropCtx.drawImage(
        tempCanvas,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      cropCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg');
    };

    image.onerror = (error) => reject(error);
  });
}
