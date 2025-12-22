/**
 * Generate HTML content from slide content and layout
 * Matches FastAPI behavior of rendering React components with slide data
 * 
 * This service generates HTML by:
 * 1. Taking slide content (JSON) and layout React component code
 * 2. Rendering the component with the content data
 * 3. Returning the HTML string
 */

/**
 * Generate HTML from slide content and layout
 * For custom templates, we have React component code that needs to be rendered
 * For default templates, we generate HTML directly from content structure
 * 
 * @param {Object} slideContent - The slide content JSON
 * @param {Object} slideLayout - The slide layout object with React component code
 * @param {Object} layoutModel - The full layout model (for context)
 * @returns {Promise<string>} - Generated HTML content
 */
export async function generateHtmlFromSlideContent(slideContent, slideLayout, layoutModel) {
  try {
    // If we have React component code (custom template), we need to render it
    // For now, we'll generate HTML directly from content structure
    // In production, you might want to use a React renderer (Puppeteer, etc.)
    
    if (slideLayout.react_component || slideLayout.layout_code) {
      // Custom template with React component
      return generateHtmlFromReactComponent(slideContent, slideLayout);
    } else {
      // Default template - generate HTML from content structure
      return generateHtmlFromContentStructure(slideContent, slideLayout);
    }
  } catch (error) {
    console.error('Error generating HTML from slide content:', error);
    // Return a basic HTML structure as fallback
    return generateFallbackHtml(slideContent);
  }
}

/**
 * Generate HTML from React component code
 * This is a simplified version - in production, you'd use a React renderer
 */
function generateHtmlFromReactComponent(slideContent, slideLayout) {
  const reactCode = slideLayout.react_component || slideLayout.layout_code;
  
  if (!reactCode) {
    // Fallback to content structure if no React code
    return generateHtmlFromContentStructure(slideContent, slideLayout);
  }
  
  // For now, we'll extract the HTML structure from the React component
  // and populate it with slide content
  // In production, you'd use a React renderer like Puppeteer or ReactDOMServer
  
  // Extract HTML structure from React component (simplified parsing)
  const htmlStructure = extractHtmlFromReactComponent(reactCode);
  
  if (!htmlStructure || htmlStructure.trim() === '<div></div>') {
    // If extraction failed, fallback to content structure
    return generateHtmlFromContentStructure(slideContent, slideLayout);
  }
  
  // Populate HTML with slide content
  return populateHtmlWithContent(htmlStructure, slideContent);
}

/**
 * Extract HTML structure from React component code
 * This is a simplified parser - in production, use a proper React renderer
 */
function extractHtmlFromReactComponent(reactCode) {
  // Try to find the return statement with JSX
  const returnMatch = reactCode.match(/return\s*\(([\s\S]*?)\)\s*;?\s*}/);
  if (returnMatch) {
    return returnMatch[1];
  }
  
  // Fallback: try to find JSX structure
  const jsxMatch = reactCode.match(/(<div[^>]*>[\s\S]*<\/div>)/);
  if (jsxMatch) {
    return jsxMatch[1];
  }
  
  // If no structure found, return empty
  return '<div></div>';
}

/**
 * Populate HTML structure with slide content
 */
function populateHtmlWithContent(htmlStructure, content) {
  let html = htmlStructure;
  
  // Replace common content fields
  if (content.title) {
    html = html.replace(/\{slideData\.title\}/g, escapeHtml(content.title));
    html = html.replace(/\{slideData\?\.title\}/g, escapeHtml(content.title));
  }
  
  if (content.subtitle) {
    html = html.replace(/\{slideData\.subtitle\}/g, escapeHtml(content.subtitle));
    html = html.replace(/\{slideData\?\.subtitle\}/g, escapeHtml(content.subtitle));
  }
  
  if (content.content) {
    const contentHtml = typeof content.content === 'string' 
      ? content.content 
      : JSON.stringify(content.content);
    html = html.replace(/\{slideData\.content\}/g, contentHtml);
    html = html.replace(/\{slideData\?\.content\}/g, contentHtml);
  }
  
  // Handle arrays (bullet points, etc.)
  if (Array.isArray(content.items)) {
    const itemsHtml = content.items.map(item => 
      `<li>${escapeHtml(typeof item === 'string' ? item : JSON.stringify(item))}</li>`
    ).join('');
    html = html.replace(/\{slideData\.items\}/g, itemsHtml);
    html = html.replace(/\{slideData\?\.items\}/g, itemsHtml);
  }
  
  // Handle images
  if (content.image && content.image.__image_url__) {
    html = html.replace(/\{slideData\.image\.__image_url__\}/g, content.image.__image_url__);
  }
  
  // Remove remaining React expressions (simplified)
  html = html.replace(/\{[\s\S]*?\}/g, '');
  
  return html;
}

/**
 * Generate HTML from content structure (for default templates)
 */
function generateHtmlFromContentStructure(slideContent, slideLayout) {
  const wrapperClasses = 'relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-white relative z-20 mx-auto overflow-hidden';
  
  let html = `<div class="${wrapperClasses}">`;
  
  // Add title if present
  if (slideContent.title) {
    html += `<h1 class="text-4xl font-bold mb-4">${escapeHtml(slideContent.title)}</h1>`;
  }
  
  // Add subtitle if present
  if (slideContent.subtitle) {
    html += `<h2 class="text-2xl text-gray-600 mb-6">${escapeHtml(slideContent.subtitle)}</h2>`;
  }
  
  // Add main content
  if (slideContent.content) {
    const contentHtml = typeof slideContent.content === 'string'
      ? slideContent.content
      : JSON.stringify(slideContent.content);
    html += `<div class="text-lg">${contentHtml}</div>`;
  }
  
  // Add items/bullet points if present
  if (Array.isArray(slideContent.items)) {
    html += '<ul class="list-disc list-inside space-y-2">';
    slideContent.items.forEach(item => {
      const itemText = typeof item === 'string' ? item : JSON.stringify(item);
      html += `<li>${escapeHtml(itemText)}</li>`;
    });
    html += '</ul>';
  }
  
  // Add image if present
  if (slideContent.image && slideContent.image.__image_url__) {
    html += `<img src="${escapeHtml(slideContent.image.__image_url__)}" alt="Slide image" class="max-w-full h-auto" />`;
  }
  
  html += '</div>';
  
  return html;
}

/**
 * Generate fallback HTML when generation fails
 */
function generateFallbackHtml(slideContent) {
  const wrapperClasses = 'relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-white relative z-20 mx-auto overflow-hidden p-8';
  
  let html = `<div class="${wrapperClasses}">`;
  
  if (slideContent.title) {
    html += `<h1>${escapeHtml(slideContent.title)}</h1>`;
  }
  
  if (slideContent.content) {
    const content = typeof slideContent.content === 'string' 
      ? slideContent.content 
      : JSON.stringify(slideContent.content);
    html += `<div>${escapeHtml(content)}</div>`;
  }
  
  html += '</div>';
  
  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    text = String(text);
  }
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Generate HTML for a slide using layout React component
 * This is the main entry point that should be called during slide generation
 * 
 * @param {Object} slide - Slide object with content
 * @param {Object} slideLayout - Layout object with React component code
 * @param {Object} layoutModel - Full layout model
 * @returns {Promise<string>} - Generated HTML
 */
export async function generateSlideHtml(slide, slideLayout, layoutModel) {
  // Get the React component code from layout
  // For custom templates, this comes from PresentationLayoutCode
  // For default templates, we generate HTML directly
  
  let reactComponentCode = null;
  
  // If layout has React component code stored
  if (slideLayout.react_component) {
    reactComponentCode = slideLayout.react_component;
  } else if (slideLayout.layout_code) {
    reactComponentCode = slideLayout.layout_code;
  } else {
    // Try to get from database if we have layout ID and layoutGroup (template ID)
    if (slideLayout.id && slide.layoutGroup) {
      try {
        const prisma = (await import('../config/prisma.js')).default;
        
        // Check if layoutGroup is a template ID (UUID format)
        const isTemplateId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slide.layoutGroup);
        
        if (isTemplateId) {
          // layoutGroup is a template ID, use it directly
          const layout = await prisma.presentationLayoutCode.findFirst({
            where: {
              presentation: slide.layoutGroup,
              layoutId: slideLayout.id
            }
          });
          
          if (layout) {
            reactComponentCode = layout.layoutCode;
          }
        } else {
          // layoutGroup is a template name, find template ID first
          const template = await prisma.templateMetadata.findFirst({
            where: {
              name: { equals: slide.layoutGroup, mode: 'insensitive' }
            }
          });
          
          if (template) {
            const layout = await prisma.presentationLayoutCode.findFirst({
              where: {
                presentation: template.id,
                layoutId: slideLayout.id
              }
            });
            
            if (layout) {
              reactComponentCode = layout.layoutCode;
            }
          }
        }
      } catch (error) {
        console.warn('Could not fetch React component from database:', error);
      }
    }
  }
  
  // Generate HTML
  if (reactComponentCode) {
    return generateHtmlFromReactComponent(slide.content, {
      ...slideLayout,
      react_component: reactComponentCode
    });
  } else {
    return generateHtmlFromContentStructure(slide.content, slideLayout);
  }
}

