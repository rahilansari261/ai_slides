/**
 * PPTX Presentation Creator
 * Matches FastAPI services/pptx_presentation_creator.py
 * Creates PPTX files from PptxPresentationModel using pptxgenjs
 */

import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import {
  PptxPresentationModel,
  PptxSlideModel,
  PptxTextBoxModel,
  PptxAutoShapeBoxModel,
  PptxPictureBoxModel,
  PptxConnectorModel
} from '../models/pptxModels.js';

const BLANK_SLIDE_LAYOUT = 6;

export class PptxPresentationCreator {
  constructor(pptModel, tempDir) {
    this._tempDir = tempDir;
    this._pptModel = pptModel;
    this._slideModels = pptModel.slides || [];
    this._ppt = new PptxGenJS();
    
    // Set slide dimensions (1280x720 in points = 13.33" x 7.5")
    this._ppt.defineLayout({ name: 'CUSTOM', width: 13.33, height: 7.5 });
    this._ppt.layout = 'CUSTOM';
  }

  /**
   * Fetch network assets (images)
   * Matches FastAPI fetch_network_assets()
   */
  async fetchNetworkAssets() {
    const imageUrls = [];
    const modelsWithNetworkAsset = [];

    // Check global shapes
    if (this._pptModel.shapes) {
      for (const shape of this._pptModel.shapes) {
        if (shape.shape_type === 'picture' && shape.picture) {
          const imagePath = shape.picture.path;
          if (imagePath && imagePath.startsWith('http') && shape.picture.is_network) {
            imageUrls.push(imagePath);
            modelsWithNetworkAsset.push(shape);
          }
        }
      }
    }

    // Check slide shapes
    for (const slideModel of this._slideModels) {
      for (const shape of slideModel.shapes || []) {
        if (shape.shape_type === 'picture' && shape.picture) {
          const imagePath = shape.picture.path;
          if (imagePath && imagePath.startsWith('http') && shape.picture.is_network) {
            imageUrls.push(imagePath);
            modelsWithNetworkAsset.push(shape);
          }
        }
      }
    }

    // Download images
    if (imageUrls.length > 0) {
      const imagePaths = await Promise.all(
        imageUrls.map(async (url) => {
          try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const imagePath = path.join(this._tempDir, `${Date.now()}-${Math.random().toString(36).substring(7)}.png`);
            fs.writeFileSync(imagePath, response.data);
            return imagePath;
          } catch (error) {
            console.error(`Failed to download image ${url}:`, error.message);
            return null;
          }
        })
      );

      // Update models with local paths
      for (let i = 0; i < modelsWithNetworkAsset.length; i++) {
        if (imagePaths[i]) {
          modelsWithNetworkAsset[i].picture.path = imagePaths[i];
          modelsWithNetworkAsset[i].picture.is_network = false;
        }
      }
    }
  }

  /**
   * Create PPTX from model
   * Matches FastAPI create_ppt()
   */
  async createPpt() {
    await this.fetchNetworkAssets();

    for (const slideModel of this._slideModels) {
      // Add global shapes to slide if present
      const shapes = [...(this._pptModel.shapes || []), ...(slideModel.shapes || [])];
      
      const slide = this._ppt.addSlide();
      
      // Set background
      if (slideModel.background) {
        slide.background = { 
          color: this.hexToRgb(slideModel.background.color),
          transparency: 1 - (slideModel.background.opacity || 1.0)
        };
      }

      // Add shapes
      for (const shapeModel of shapes) {
        await this.addAndPopulateShape(slide, shapeModel);
      }

      // Add speaker notes
      if (slideModel.note) {
        slide.addNotes(slideModel.note);
      }
    }
  }

  /**
   * Add and populate shape on slide
   */
  async addAndPopulateShape(slide, shapeModel) {
    switch (shapeModel.shape_type) {
      case 'picture':
        await this.addPicture(slide, shapeModel);
        break;
      case 'autoshape':
        this.addAutoshape(slide, shapeModel);
        break;
      case 'textbox':
        this.addTextbox(slide, shapeModel);
        break;
      case 'connector':
        this.addConnector(slide, shapeModel);
        break;
    }
  }

  /**
   * Add picture to slide
   * Matches FastAPI add_picture()
   */
  async addPicture(slide, pictureModel) {
    let imagePath = pictureModel.picture.path;
    
    // Process image if needed
    if (pictureModel.clip || pictureModel.border_radius || pictureModel.invert || 
        pictureModel.opacity || pictureModel.object_fit || pictureModel.shape) {
      try {
        let image = sharp(imagePath);
        const metadata = await image.metadata();
        
        // Apply transformations
        if (pictureModel.object_fit) {
          // Resize to fit
          const { width, height } = pictureModel.position;
          image = image.resize(width, height, {
            fit: pictureModel.object_fit.fit || 'contain'
          });
        }
        
        if (pictureModel.border_radius) {
          // Apply border radius (simplified - sharp doesn't support this directly)
          // Would need more complex processing
        }
        
        if (pictureModel.invert) {
          image = image.negate();
        }
        
        if (pictureModel.opacity && pictureModel.opacity < 1.0) {
          // Apply opacity
          image = image.composite([{
            input: Buffer.from([255, 255, 255, Math.floor(pictureModel.opacity * 255)]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: 'dest-in'
          }]);
        }
        
        // Save processed image
        const processedPath = path.join(this._tempDir, `processed-${Date.now()}.png`);
        await image.png().toFile(processedPath);
        imagePath = processedPath;
      } catch (error) {
        console.error(`Could not process image ${imagePath}:`, error.message);
      }
    }

    // Convert position from points to inches (pptxgenjs uses inches)
    const pos = pictureModel.position;
    const margin = pictureModel.margin || { left: 0, top: 0, right: 0, bottom: 0 };
    
    const options = {
      x: this.pointsToInches(pos.left + margin.left),
      y: this.pointsToInches(pos.top + margin.top),
      w: this.pointsToInches(pos.width - margin.left - margin.right),
      h: this.pointsToInches(pos.height - margin.top - margin.bottom)
    };

    if (pictureModel.opacity && pictureModel.opacity < 1.0) {
      options.transparency = 1 - pictureModel.opacity;
    }

    slide.addImage({ path: imagePath, ...options });
  }

  /**
   * Add autoshape to slide
   * Matches FastAPI add_autoshape()
   */
  addAutoshape(slide, autoshapeModel) {
    const pos = autoshapeModel.position;
    const margin = autoshapeModel.margin || { left: 0, top: 0, right: 0, bottom: 0 };
    
    const shapeType = this.mapAutoshapeType(autoshapeModel.type);
    
    const options = {
      x: this.pointsToInches(pos.left + margin.left),
      y: this.pointsToInches(pos.top + margin.top),
      w: this.pointsToInches(pos.width - margin.left - margin.right),
      h: this.pointsToInches(pos.height - margin.top - margin.bottom),
      shape: shapeType
    };

    if (autoshapeModel.fill) {
      options.fill = { color: this.hexToRgb(autoshapeModel.fill.color) };
      if (autoshapeModel.fill.opacity < 1.0) {
        options.fill.transparency = 1 - autoshapeModel.fill.opacity;
      }
    }

    if (autoshapeModel.stroke && autoshapeModel.stroke.thickness > 0) {
      options.line = {
        color: this.hexToRgb(autoshapeModel.stroke.color),
        width: autoshapeModel.stroke.thickness
      };
    }

    const shape = slide.addShape(this._ppt.ShapeType.rect, options);

    // Add text if paragraphs exist
    if (autoshapeModel.paragraphs && autoshapeModel.paragraphs.length > 0) {
      const text = this.paragraphsToText(autoshapeModel.paragraphs);
      shape.text = text;
    }
  }

  /**
   * Add textbox to slide
   * Matches FastAPI add_textbox()
   */
  addTextbox(slide, textboxModel) {
    const pos = textboxModel.position;
    const margin = textboxModel.margin || { left: 0, top: 0, right: 0, bottom: 0 };
    
    const options = {
      x: this.pointsToInches(pos.left + margin.left),
      y: this.pointsToInches(pos.top + margin.top),
      w: this.pointsToInches(pos.width - margin.left - margin.right),
      h: this.pointsToInches(pos.height - margin.top - margin.bottom),
      wrap: textboxModel.text_wrap !== false
    };

    if (textboxModel.fill) {
      options.fill = { color: this.hexToRgb(textboxModel.fill.color) };
    }

    // Convert paragraphs to text with formatting
    const textOptions = this.paragraphsToTextOptions(textboxModel.paragraphs);
    
    slide.addText(textOptions.text, {
      ...options,
      ...textOptions.options
    });
  }

  /**
   * Add connector to slide
   * Matches FastAPI add_connector()
   */
  addConnector(slide, connectorModel) {
    if (connectorModel.thickness === 0) {
      return;
    }

    const pos = connectorModel.position;
    const [x1, y1, x2, y2] = pos.toPtXyxy();
    
    // pptxgenjs doesn't support connectors directly, use a line shape
    slide.addShape(this._ppt.ShapeType.line, {
      x: this.pointsToInches(x1),
      y: this.pointsToInches(y1),
      w: this.pointsToInches(x2 - x1),
      h: this.pointsToInches(y2 - y1),
      line: {
        color: this.hexToRgb(connectorModel.color),
        width: connectorModel.thickness
      }
    });
  }

  /**
   * Convert paragraphs to text
   */
  paragraphsToText(paragraphs) {
    return paragraphs
      .map(p => {
        if (p.text_runs) {
          return p.text_runs.map(r => r.text).join('');
        }
        return p.text || '';
      })
      .join('\n');
  }

  /**
   * Convert paragraphs to text options with formatting
   */
  paragraphsToTextOptions(paragraphs) {
    if (!paragraphs || paragraphs.length === 0) {
      return { text: '', options: {} };
    }

    // Get first paragraph's font as base
    const firstPara = paragraphs[0];
    const baseFont = firstPara.font || {};
    
    const text = paragraphs
      .map(p => {
        if (p.text_runs) {
          return p.text_runs.map(r => r.text).join('');
        }
        return p.text || '';
      })
      .join('\n');

    const options = {
      fontSize: baseFont.size || 16,
      fontFace: baseFont.name || 'Arial',
      color: this.hexToRgb(baseFont.color || '000000'),
      bold: (baseFont.font_weight || 400) >= 600,
      italic: baseFont.italic || false
    };

    return { text, options };
  }

  /**
   * Map autoshape type
   */
  mapAutoshapeType(type) {
    const typeMap = {
      'RECTANGLE': this._ppt.ShapeType.rect,
      'ROUNDED_RECTANGLE': this._ppt.ShapeType.roundRect,
      'ELLIPSE': this._ppt.ShapeType.ellipse,
      'CIRCLE': this._ppt.ShapeType.ellipse
    };
    return typeMap[type] || this._ppt.ShapeType.rect;
  }

  /**
   * Convert points to inches (1 inch = 72 points)
   */
  pointsToInches(points) {
    return points / 72;
  }

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex) {
    if (!hex) return '000000';
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Save PPTX file
   * Matches FastAPI save()
   */
  async save(filePath) {
    return new Promise((resolve, reject) => {
      this._ppt.writeFile({ fileName: filePath })
        .then(() => resolve())
        .catch((error) => reject(error));
    });
  }
}

