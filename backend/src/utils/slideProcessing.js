/**
 * Slide processing utilities matching FastAPI utils/process_slides.py
 */

/**
 * Get all paths in a nested object that contain a specific key
 */
export function getDictPathsWithKey(obj, key) {
  const paths = [];
  
  function traverse(current, path = []) {
    if (typeof current !== 'object' || current === null) {
      return;
    }
    
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        traverse(item, [...path, index]);
      });
    } else {
      if (key in current) {
        paths.push(path);
      }
      
      Object.keys(current).forEach(k => {
        traverse(current[k], [...path, k]);
      });
    }
  }
  
  traverse(obj);
  return paths;
}

/**
 * Get value at a specific path in nested object
 */
export function getDictAtPath(obj, path) {
  let current = obj;
  for (const key of path) {
    if (current === null || current === undefined) {
      return null;
    }
    current = current[key];
  }
  return current;
}

/**
 * Set value at a specific path in nested object
 */
export function setDictAtPath(obj, path, value) {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (current[key] === null || current[key] === undefined) {
      current[key] = typeof path[i + 1] === 'number' ? [] : {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
}

/**
 * Add placeholder assets to slide content
 * Matches FastAPI process_slide_add_placeholder_assets()
 */
export function processSlideAddPlaceholderAssets(slide) {
  const imagePaths = getDictPathsWithKey(slide.content, '__image_prompt__');
  const iconPaths = getDictPathsWithKey(slide.content, '__icon_query__');

  for (const imagePath of imagePaths) {
    const imageDict = getDictAtPath(slide.content, imagePath);
    if (imageDict) {
      imageDict.__image_url__ = '/static/images/placeholder.jpg';
      setDictAtPath(slide.content, imagePath, imageDict);
    }
  }

  for (const iconPath of iconPaths) {
    const iconDict = getDictAtPath(slide.content, iconPath);
    if (iconDict) {
      iconDict.__icon_url__ = '/static/icons/placeholder.svg';
      setDictAtPath(slide.content, iconPath, iconDict);
    }
  }
}

/**
 * Process slide and fetch assets (simplified version)
 * In production, this would call image generation and icon services
 * Matches FastAPI process_slide_and_fetch_assets()
 */
export async function processSlideAndFetchAssets(slide) {
  // For now, return empty array - image/icon generation can be added later
  // This matches the structure but doesn't actually generate images yet
  const imagePaths = getDictPathsWithKey(slide.content, '__image_prompt__');
  const iconPaths = getDictPathsWithKey(slide.content, '__icon_query__');

  // Placeholder: In production, you'd generate images and fetch icons here
  // For now, we'll just ensure URLs are set (they're already placeholders from processSlideAddPlaceholderAssets)
  
  return []; // Return empty assets array for now
}

