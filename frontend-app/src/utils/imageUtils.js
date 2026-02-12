/**
 * Get the full image URL, handling both Cloudflare R2 full URLs and local relative paths
 * @param {string} imageUrl - The image URL from the database (can be full URL or relative path)
 * @param {string} apiBaseUrl - The API base URL (for relative paths)
 * @returns {string} - The complete image URL
 */
export const getImageUrl = (imageUrl, apiBaseUrl) => {
  if (!imageUrl) return '';
  
  // If it's already a full URL (starts with http:// or https://), use it directly
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Otherwise, it's a relative path, prepend the API base URL
  return `${apiBaseUrl}${imageUrl}`;
};
