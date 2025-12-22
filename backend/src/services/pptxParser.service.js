import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

/**
 * Extract template configuration from a PPTX file
 * This analyzes the presentation structure and extracts theme information
 */
export const extractTemplateFromPPTX = async (pptxPath) => {
  try {
    const tempDir = path.join(path.dirname(pptxPath), `temp_${Date.now()}`);
    
    // Extract PPTX (which is a ZIP file)
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(pptxPath)
        .pipe(unzipper.Extract({ path: tempDir }))
        .on('close', async () => {
          try {
            const result = await processExtractedFiles(tempDir);
            // Cleanup
            await fs.promises.rm(tempDir, { recursive: true, force: true });
            resolve(result);
          } catch (error) {
            // Cleanup on error
            await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
            reject(error);
          }
        })
        .on('error', async (error) => {
          // Cleanup on error
          await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
          reject(error);
        });
    });
  } catch (error) {
    console.error('Error extracting template from PPTX:', error);
    throw new Error(`Failed to extract template: ${error.message}`);
  }
};

/**
 * Process extracted PPTX files
 */
const processExtractedFiles = async (tempDir) => {

  // Read theme information from ppt/theme/theme1.xml
  let theme = {
    primaryColor: '#8b5cf6',
    secondaryColor: '#a78bfa',
    backgroundColor: '#0f172a',
    textColor: '#f8fafc',
    fontFamily: 'Arial'
  };

  const themePath = path.join(tempDir, 'ppt', 'theme', 'theme1.xml');
  if (fs.existsSync(themePath)) {
    try {
      const themeXML = await fs.promises.readFile(themePath, 'utf-8');
      const themeData = await parseXML(themeXML);
      
      // Extract colors from theme XML
      // This is a simplified extraction - PPTX themes are complex
      if (themeData['a:theme']?.['a:themeElements']?.[0]?.['a:clrScheme']?.[0]) {
        const colorScheme = themeData['a:theme']['a:themeElements'][0]['a:clrScheme'][0];
        
        // Extract accent colors
        const accent1 = colorScheme['a:accent1']?.[0]?.['a:srgbClr']?.[0]?.['$']?.['val'];
        const accent2 = colorScheme['a:accent2']?.[0]?.['a:srgbClr']?.[0]?.['$']?.['val'];
        const bg1 = colorScheme['a:bg1']?.[0]?.['a:srgbClr']?.[0]?.['$']?.['val'];
        const tx1 = colorScheme['a:tx1']?.[0]?.['a:srgbClr']?.[0]?.['$']?.['val'];
        
        if (accent1) theme.primaryColor = `#${accent1}`;
        if (accent2) theme.secondaryColor = `#${accent2}`;
        if (bg1) theme.backgroundColor = `#${bg1}`;
        if (tx1) theme.textColor = `#${tx1}`;
      }
    } catch (error) {
      console.warn('Could not parse theme XML:', error.message);
    }
  }

  // Analyze slide layouts from ppt/slides
  const slidesDir = path.join(tempDir, 'ppt', 'slides');
  const slideLayouts = [];
  
  if (fs.existsSync(slidesDir)) {
    const slideFiles = fs.readdirSync(slidesDir)
      .filter(f => f.startsWith('slide') && f.endsWith('.xml'))
      .sort();
    
    // Analyze first few slides to determine layout types
    for (let i = 0; i < Math.min(slideFiles.length, 5); i++) {
      const slidePath = path.join(slidesDir, slideFiles[i]);
      try {
        const slideXML = await fs.promises.readFile(slidePath, 'utf-8');
        const slideData = await parseXML(slideXML);
        
        // Determine slide type based on structure
        const slideType = determineSlideType(slideData);
        
        if (!slideLayouts.find(l => l.type === slideType)) {
          slideLayouts.push({
            type: slideType,
            schema: getSchemaForSlideType(slideType),
            layout: ''
          });
        }
      } catch (error) {
        console.warn(`Could not parse slide ${slideFiles[i]}:`, error.message);
      }
    }
  }

  return {
    theme,
    slideLayouts: slideLayouts.length > 0 ? slideLayouts : getDefaultSlideLayouts(),
    contentSchema: {}
  };
};

/**
 * Determine slide type from parsed XML data
 */
const determineSlideType = (slideData) => {
  // This is a simplified determination - in reality, PPTX structure is more complex
  const shapes = slideData['p:presentation']?.['p:sld']?.[0]?.['p:cSld']?.[0]?.['p:spTree']?.[0]?.['p:sp'] || [];
  
  if (shapes.length === 0) return 'content';
  
  // Check for title slide (usually first slide with large title)
  // Check for quote slide (usually has quote marks or attribution)
  // Check for stats slide (usually has numbers)
  // Check for two-column layout
  
  // Default to content for now
  return 'content';
};

/**
 * Get default slide layouts
 */
const getDefaultSlideLayouts = () => {
  return [
    {
      type: 'title',
      schema: {
        title: { type: 'string', required: true },
        subtitle: { type: 'string', required: false }
      },
      layout: ''
    },
    {
      type: 'content',
      schema: {
        title: { type: 'string', required: true },
        bullets: { type: 'array', items: 'string', required: true }
      },
      layout: ''
    }
  ];
};

/**
 * Get schema for a slide type
 */
const getSchemaForSlideType = (slideType) => {
  const schemas = {
    title: {
      title: { type: 'string', required: true },
      subtitle: { type: 'string', required: false }
    },
    content: {
      title: { type: 'string', required: true },
      bullets: { type: 'array', items: 'string', required: true }
    },
    'two-column': {
      title: { type: 'string', required: true },
      leftColumn: {
        heading: { type: 'string', required: true },
        bullets: { type: 'array', items: 'string', required: true }
      },
      rightColumn: {
        heading: { type: 'string', required: true },
        bullets: { type: 'array', items: 'string', required: true }
      }
    },
    quote: {
      quote: { type: 'string', required: true },
      attribution: { type: 'string', required: false }
    },
    stats: {
      title: { type: 'string', required: true },
      stats: {
        type: 'array',
        items: {
          value: { type: 'string', required: true },
          label: { type: 'string', required: true }
        },
        required: true
      }
    },
    section: {
      title: { type: 'string', required: true }
    },
    conclusion: {
      title: { type: 'string', required: true },
      bullets: { type: 'array', items: 'string', required: false },
      callToAction: { type: 'string', required: false }
    }
  };
  
  return schemas[slideType] || schemas.content;
};

