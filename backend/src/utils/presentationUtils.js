/**
 * Presentation utility functions matching FastAPI utils/ppt_utils.py
 */

/**
 * Get presentation title from outlines
 * Matches FastAPI get_presentation_title_from_outlines()
 */
export function getPresentationTitleFromOutlines(presentationOutlines) {
  if (!presentationOutlines || !presentationOutlines.slides || presentationOutlines.slides.length === 0) {
    return 'Untitled Presentation';
  }

  let firstContent = presentationOutlines.slides[0].content || '';

  // Remove page number patterns like "# Page 1" or "## Page 1"
  firstContent = firstContent.replace(/^\s*#{1,6}\s*Page\s+\d+\b[\s,:\-]*/i, '');

  // Clean up and limit to 100 characters
  return firstContent
    .substring(0, 100)
    .replace(/#/g, '')
    .replace(/\//g, '')
    .replace(/\\/g, '')
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Find slide layout index by regex patterns
 * Matches FastAPI find_slide_layout_index_by_regex()
 */
export function findSlideLayoutIndexByRegex(layout, patterns) {
  function findIndex(pattern) {
    const regex = new RegExp(pattern, 'i');
    for (let index = 0; index < layout.slides.length; index++) {
      const slideLayout = layout.slides[index];
      const candidates = [
        slideLayout.id || '',
        slideLayout.name || '',
        slideLayout.description || '',
        slideLayout.json_schema?.title || ''
      ];
      
      for (const text of candidates) {
        if (text && regex.test(text)) {
          return index;
        }
      }
    }
    return -1;
  }

  for (const pattern of patterns) {
    const matchIndex = findIndex(pattern);
    if (matchIndex !== -1) {
      return matchIndex;
    }
  }

  return -1;
}

/**
 * Select table of contents or list slide layout index
 * Matches FastAPI select_toc_or_list_slide_layout_index()
 */
export function selectTocOrListSlideLayoutIndex(layout) {
  const tocPatterns = [
    '\\btable\\s*of\\s*contents\\b',
    '\\btable[- ]?of[- ]?contents\\b',
    '\\bagenda\\b',
    '\\bcontents\\b',
    '\\boutline\\b',
    '\\bindex\\b',
    '\\btoc\\b'
  ];

  const listPatterns = [
    '\\b(bullet(ed)?\\s*list|bullets?)\\b',
    '\\b(numbered\\s*list|ordered\\s*list|unordered\\s*list)\\b',
    '\\blist\\b'
  ];

  const tocIndex = findSlideLayoutIndexByRegex(layout, tocPatterns);
  if (tocIndex !== -1) {
    return tocIndex;
  }

  return findSlideLayoutIndexByRegex(layout, listPatterns);
}

