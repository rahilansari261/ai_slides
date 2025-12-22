import fs from 'fs';
import path from 'path';
import {
  generateHTMLFromSlide,
  generateReactFromHTML,
  editHTMLWithImages,
  readImageAsBase64
} from '../services/aiConversion.service.js';
import { getImagesDirectory } from '../utils/storage.js';

/**
 * Convert slide image and XML to HTML
 * Matches FastAPI convert_slide_to_html() exactly
 */
export async function convertSlideToHtml(req, res) {
  try {
    const { image, xml, fonts } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image path is required' });
    }

    if (!xml) {
      return res.status(400).json({ error: 'XML content is required' });
    }

    // Get OpenRouter API key from environment
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY environment variable not set' });
    }

    // Resolve image path
    let actualImagePath = image;
    if (image.startsWith('/app_data/images/')) {
      const relativePath = image.substring('/app_data/images/'.length);
      actualImagePath = path.join(getImagesDirectory(), relativePath);
    } else if (image.startsWith('/static/')) {
      const relativePath = image.substring('/static/'.length);
      actualImagePath = path.join('static', relativePath);
    } else if (!path.isAbsolute(image)) {
      actualImagePath = path.join(getImagesDirectory(), image);
    }

    // Check if image file exists
    if (!fs.existsSync(actualImagePath)) {
      return res.status(404).json({ error: `Image file not found: ${image}` });
    }

    // Read and encode image to base64
    const imageBuffer = fs.readFileSync(actualImagePath);
    const base64Image = imageBuffer.toString('base64');

    // Determine media type from file extension
    const fileExtension = path.extname(actualImagePath).toLowerCase();
    const mediaTypeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    const mediaType = mediaTypeMap[fileExtension] || 'image/png';

    // Generate HTML using the service
    const htmlContent = await generateHTMLFromSlide(
      base64Image,
      mediaType,
      xml,
      fonts || null
    );

    // Clean up markdown code blocks
    const cleanedHtml = htmlContent.replace(/```html/g, '').replace(/```/g, '');

    return res.json({
      success: true,
      html: cleanedHtml
    });
  } catch (error) {
    console.error('Error during slide to HTML processing:', error);
    return res.status(500).json({
      error: `Error processing slide to HTML: ${error.message}`
    });
  }
}

/**
 * Convert HTML to React component
 * Matches FastAPI convert_html_to_react() exactly
 */
export async function convertHtmlToReact(req, res) {
  try {
    const { html, image } = req.body;

    if (!html || !html.trim()) {
      return res.status(400).json({ error: 'HTML content cannot be empty' });
    }

    // Get OpenRouter API key from environment
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY environment variable not set' });
    }

    // Optionally resolve image and encode to base64
    let imageB64 = null;
    let mediaType = null;
    
    if (image) {
      let actualImagePath = image;
      if (image.startsWith('/app_data/images/')) {
        const relativePath = image.substring('/app_data/images/'.length);
        actualImagePath = path.join(getImagesDirectory(), relativePath);
      } else if (image.startsWith('/static/')) {
        const relativePath = image.substring('/static/'.length);
        actualImagePath = path.join('static', relativePath);
      } else if (!path.isAbsolute(image)) {
        actualImagePath = path.join(getImagesDirectory(), image);
      }

      if (fs.existsSync(actualImagePath)) {
        const imageBuffer = fs.readFileSync(actualImagePath);
        imageB64 = imageBuffer.toString('base64');
        const ext = path.extname(actualImagePath).toLowerCase();
        const mediaTypeMap = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };
        mediaType = mediaTypeMap[ext] || 'image/png';
      }
    }

    // Convert HTML to React component
    const reactComponent = await generateReactFromHTML(
      html,
      imageB64,
      mediaType
    );

    const cleanedReact = reactComponent.replace(/```tsx/g, '').replace(/```/g, '');

    return res.json({
      success: true,
      react_component: cleanedReact,
      message: 'React component generated successfully'
    });
  } catch (error) {
    console.error('Error during HTML to React processing:', error);
    return res.status(500).json({
      error: `Error processing HTML to React: ${error.message}`
    });
  }
}

/**
 * Edit HTML with images
 * Matches FastAPI edit_html_with_images_endpoint() exactly
 */
export async function editHtmlWithImages(req, res) {
  try {
    const { html, prompt } = req.body;

    if (!html || !html.trim()) {
      return res.status(400).json({ error: 'HTML content cannot be empty' });
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Text prompt cannot be empty' });
    }

    // Get OpenRouter API key from environment
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY environment variable not set' });
    }

    // Get uploaded files
    const files = req.files || {};
    const currentUiImage = files.current_ui_image?.[0];
    const sketchImage = files.sketch_image?.[0];

    if (!currentUiImage) {
      return res.status(400).json({ error: 'Current UI image is required' });
    }

    // Validate image files
    if (!currentUiImage.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Current UI file must be an image' });
    }

    if (sketchImage && !sketchImage.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Sketch file must be an image' });
    }

    // Read and encode images to base64
    const currentUiBase64 = currentUiImage.buffer.toString('base64');
    const sketchBase64 = sketchImage ? sketchImage.buffer.toString('base64') : null;
    const mediaType = currentUiImage.mimetype;

    // Edit HTML using the service
    const editedHtml = await editHTMLWithImages(
      currentUiBase64,
      sketchBase64,
      mediaType,
      html,
      prompt
    );

    const cleanedHtml = editedHtml.replace(/```html/g, '').replace(/```/g, '');

    return res.json({
      success: true,
      edited_html: cleanedHtml,
      message: 'HTML edited successfully'
    });
  } catch (error) {
    console.error('Error during HTML editing:', error);
    return res.status(500).json({
      error: `Error processing HTML editing: ${error.message}`
    });
  }
}

