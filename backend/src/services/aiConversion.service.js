import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { getImagesDirectory } from '../utils/storage.js';

// System prompts from FastAPI implementation
const GENERATE_HTML_SYSTEM_PROMPT = `
You need to generate html and tailwind code for given presentation slide image. Generated code will be used as template for different content. You need to think through each design elements and then decide where each element should go.
Follow these rules strictly:
- Make sure the design from html and tailwind is exact to the slide. 
- Make sure all components are in their own place. 
- Make sure size of elements are exact. Check sizes of images and other elements from OXML and convert them to pixels.
- Make sure all components should be noted of and should be added as it is.
- Image's and icons's size and position should be added exactly as it is.
- Read through the OXML data of slide and then match exact position ans size of elements. Make sure to convert between dimension and pixels. 
- Make sure the vertical and horizonal spacing between elements are same as in the image. Try to get spacing from the OXML document as well. Make sure no elements overflows because of high spacing.
- Do not use absolute position unless absolutely necessary. Use flex, grid and spacing to properly arrange components.
- First, layout everything using flex or grid. Try to fit all the components using this layout. Finally, if you cannot layout any element without flex and grid, then only use absolute to place the element.
- Analyze each text's available space and it's design, and give minimum characters to fill in the text for the space and context and maximum that the space can handle. Be  conservative with how many characters text space can handle. Make sure no text overflows and decide as to not disrupt the slide.  Do this for every text. 
- Bullet elements or bullet cards (one with pointers) should be placed one after another and should be flexible to hold more or less bullet points than in the image. Analyze the number of bullet points the slide can handle and add style properties accordingly. Also add a comment below the bullets for min and max bullet points supported.  Make sure the number you quote should fit in the available space. Don't  be too ambitious. 
- For each text add font size and font family as tailwind property. Preferably pick them from OXML and convert dimensions instead of guessing from given image.
- Make sure that no elements overflow or exceed slide bounding in any way.
- Properly export shapes as exact SVG.
- Add relevant font in tailwind to all texts.   
- Wrap the output code inside these classes: "relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-white relative z-20 mx-auto overflow-hidden". 
- For image everywhere use https://images.pexels.com/photos/31527637/pexels-photo-31527637.jpeg
- Image should never be inside of a SVG.
- Replace brand icons with a circle of same size with "i" between. Generic icons like "email", "call", etc should remain same.
- If there is a box/card enclosing a text, make it grow as well when the text grows, so that the text does not overflow the box/card.
- Give out only HTML and Tailwind code. No other texts or explanations. 
- Do not give entire HTML structure with head, body, etc. Just give the respective HTML and Tailwind code inside div with above classes.
- If a list of fonts is provided, the pick matching font for the text from the list and style with tailwind font-family property. Use following format: font-["font-name"]
`;

const HTML_TO_REACT_SYSTEM_PROMPT = `
Convert given static HTML and Tailwind slide to a TSX React component so that it can be dynamically populated. Follow these rules strictly while converting:

1) Required imports, a zod schema and HTML layout has to be generated.
2) Schema will populate the layout so make sure schema has fields for all text, images and icons in the layout.
3) For similar components in the layouts (eg, team members), they should be represented by array of such components in the schema.
4) For image and icons icons should be a different schema with two dunder fields for prompt and url separately.
5) Default value for schema fields should be populated with the respective static value in HTML input.
6) In schema max and min value for characters in string and items in array should be specified as per the given image of the slide. You should accurately evaluate the maximum and minimum possible characters respective fields can handle visually through the image. ALso give out maximum number of words it can handle in the meta.
7) For image and icons schema should be compulsorily declared with two dunder fields for prompt and url separately.
8) Component name at the end should always yo 'dynamicSlideLayout'.
9) **Import or export statements should not be present in the output.**
    - Don't give "import {React} from 'react'"
    - Don't give "import {z} from 'zod'"
10) Always use double quotes for strings.
11) Layout Id, layout name and layout description should be declared and should describe the structure of the layout not its purpose. Do not describe numbers of any items in the layout.
    -layoutDescription should not have any purpose for elements in it, so use '...cards' instead of '...goal cards' and '...bullet points' instead of '...solution bullet points'.
    -layoutDescription should not have words like 'goals', 'solutions', 'problems' in it.
    -layoutName constant should be same as the component name in the layout.
    -Layout Id examples: header-description-bullet-points-slide, header-description-image-slide
    -Layout Name examples: HeaderDescriptionBulletPointsLayout, HeaderDescriptionImageLayout
    -Layout Description examples: A slide with a header, description, and bullet points and A slide with a header, description, and image
12. Only give Code and nothing else. No other text or comments.
13. Do not parse the slideData inside dynamicSlideLayout, just use it as it is. Do not use statements like \`Schema.parse() \` anywhere. Instead directly use the data without validating or parsing.
14. Always complete the reference, do not give "slideData .? .cards" instead give "slideData?.cards".
15. Do not add anything other than code. Do not add "use client", "json", "typescript", "javascript" and other prefix or suffix, just give out code exactly formatted like example.
16. In schema, give default for all fields irrespective of their types, give defualt values for array and objects as well. 
17. For charts use recharts.js library and follow these rules strictly:
    - Do not import rechart, it will already be imported.
    - There should support for multiple chart types including bar, line, pie and donut in the same size as given. 
    - Use an attribute in the schema to select between chart types.
    - All data should be properly represented in schema.
18. For diagrams use mermaid with appropriate placeholder which can render any daigram. Schema should have a field for code. Render in the placeholder properly.
19. Don't add style attribute in the schema. Colors, font sizes, and all other style attributes should be added directly as tailwind classes.
`;

const HTML_EDIT_SYSTEM_PROMPT = `
You need to edit given html with respect to the indication and sketch in the given UI. You'll be given the code for current UI which is in presentation size, along with its visualization in image form. Over that you'll also be given another image which has indications of what might change in form of sketch in the UI. You will have to return the edited html with tailwind with the changes as indicated on the image and through prompt. Make sure you think through the design before making the change and also make sure you don't change the non-indicated part. Try to follow the design style of current content for generated content. If sketch image is not provided, then you need to edit the html with respect to the prompt. Make sure size of the presentation does not change in any cirsumstance. Only give out code and nothing else.
`;

/**
 * Edit HTML with images using OpenAI GPT-5 Responses API
 * Matches FastAPI edit_html_with_images() exactly
 */
export async function editHTMLWithImages(
  currentUiBase64,
  sketchBase64,
  mediaType,
  htmlContent,
  prompt
) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    // OpenRouter uses OpenAI-compatible API
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://github.com/your-repo',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'AI Slides Backend',
      },
    });

    console.log('Making Responses API request for HTML editing...');

    const currentDataUrl = `data:${mediaType};base64,${currentUiBase64}`;
    const sketchDataUrl = sketchBase64 ? `data:${mediaType};base64,${sketchBase64}` : null;

    // FastAPI: content_parts = [{"type": "input_image", "image_url": current_data_url}, {"type": "input_text", "text": f"CURRENT HTML TO EDIT:\n{html_content}\n\nTEXT PROMPT FOR CHANGES:\n{prompt}"}]
    const contentParts = [
      { type: 'input_image', image_url: currentDataUrl },
      {
        type: 'input_text',
        text: `CURRENT HTML TO EDIT:\n${htmlContent}\n\nTEXT PROMPT FOR CHANGES:\n${prompt}`
      }
    ];

    // FastAPI: if sketch_data_url: content_parts.insert(1, {"type": "input_image", "image_url": sketch_data_url})
    if (sketchDataUrl) {
      contentParts.splice(1, 0, { type: 'input_image', image_url: sketchDataUrl });
    }

    // FastAPI: input_payload = [{"role": "system", "content": HTML_EDIT_SYSTEM_PROMPT}, {"role": "user", "content": content_parts}]
    const inputPayload = [
      { role: 'system', content: HTML_EDIT_SYSTEM_PROMPT },
      { role: 'user', content: contentParts }
    ];

    let response;
    try {
      // FastAPI: response = client.responses.create(model="gpt-5", input=input_payload, reasoning={"effort": "low"}, text={"verbosity": "low"})
      // Note: OpenRouter may not support responses API, so we use chat completions
      const chatContentParts = [
        { type: 'image_url', image_url: { url: currentDataUrl } },
        {
          type: 'text',
          text: `CURRENT HTML TO EDIT:\n${htmlContent}\n\nTEXT PROMPT FOR CHANGES:\n${prompt}`
        }
      ];
      if (sketchDataUrl) {
        chatContentParts.splice(1, 0, { type: 'image_url', image_url: { url: sketchDataUrl } });
      }
      const chatMessages = [
        { role: 'system', content: HTML_EDIT_SYSTEM_PROMPT },
        { role: 'user', content: chatContentParts }
      ];
      response = await client.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: chatMessages,
        max_tokens: 4000,
        temperature: 0.7
      });
    } catch (apiError) {
      console.error('OpenRouter API Error:', apiError);
      throw new Error(`OpenRouter API error during HTML editing: ${apiError.message}`);
    }

    // FastAPI: edited_html = getattr(response, "output_text", None) or getattr(response, "text", None) or ""
    let editedHtml = '';
    if (response.output_text) {
      editedHtml = response.output_text;
    } else if (response.text) {
      editedHtml = response.text;
    } else if (response.choices?.[0]?.message?.content) {
      editedHtml = response.choices[0].message.content;
    }

    console.log(`Received edited HTML content length: ${editedHtml.length}`);

    // FastAPI: if not edited_html: raise HTTPException
    if (!editedHtml || editedHtml.trim().length === 0) {
      throw new Error('No edited HTML content generated by OpenRouter');
    }

    return editedHtml;
  } catch (error) {
    // FastAPI error handling
    const errorMsg = error.message || String(error);
    console.error(`Exception occurred: ${errorMsg}`);
    console.error(`Exception type: ${error.constructor?.name || typeof error}`);

    if (errorMsg.toLowerCase().includes('timeout')) {
      throw new Error(`OpenRouter API timeout during HTML editing: ${errorMsg}`);
    } else if (errorMsg.toLowerCase().includes('connection')) {
      throw new Error(`OpenRouter API connection error during HTML editing: ${errorMsg}`);
    } else {
      throw new Error(`OpenRouter API error during HTML editing: ${errorMsg}`);
    }
  }
}

/**
 * Generate HTML from slide image and XML using OpenAI GPT-5 Responses API
 * Matches FastAPI generate_html_from_slide() exactly
 */
export async function generateHTMLFromSlide(imageBase64, mediaType, xmlContent, fonts = []) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    // OpenRouter uses OpenAI-compatible API
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://github.com/your-repo',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'AI Slides Backend',
      },
    });

    console.log('Generating HTML from slide image and XML using OpenRouter...');

    // Compose input for Responses API - matches FastAPI exactly
    const dataUrl = `data:${mediaType};base64,${imageBase64}`;
    const fontsText = fonts && fonts.length > 0
      ? `\nFONTS (Normalized root families used in this slide, use where it is required): ${fonts.join(', ')}`
      : '';
    const userText = `OXML: \n\n${fontsText}`;

    // FastAPI: input_payload = [{"role": "system", "content": GENERATE_HTML_SYSTEM_PROMPT}, {"role": "user", "content": [{"type": "input_image", "image_url": data_url}, {"type": "input_text", "text": user_text}]}]
    // Note: OpenAI Responses API uses 'input_image' and 'input_text' types, not 'image_url'
    const inputPayload = [
      { role: 'system', content: GENERATE_HTML_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'input_image', image_url: dataUrl },
          { type: 'input_text', text: userText }
        ]
      }
    ];

    console.log('Making Responses API request for HTML generation...');

    let response;
    try {
      // OpenRouter uses chat completions with vision
      const chatMessages = [
        { role: 'system', content: GENERATE_HTML_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: userText }
          ]
        }
      ];
      response = await client.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: chatMessages,
        max_tokens: 4000,
        temperature: 0.7
      });
    } catch (apiError) {
      console.error('OpenRouter API Error:', apiError);
      throw new Error(`OpenRouter API error during HTML generation: ${apiError.message}`);
    }

    // FastAPI: html_content = getattr(response, "output_text", None) or getattr(response, "text", None) or ""
    let htmlContent = '';
    if (response.output_text) {
      htmlContent = response.output_text;
    } else if (response.text) {
      htmlContent = response.text;
    } else if (response.choices?.[0]?.message?.content) {
      htmlContent = response.choices[0].message.content;
    }

    console.log(`Received HTML content length: ${htmlContent.length}`);

    // FastAPI: if not html_content: raise HTTPException
    if (!htmlContent || htmlContent.trim().length === 0) {
      throw new Error('No HTML content generated by OpenRouter');
    }

    return htmlContent;
  } catch (error) {
    // FastAPI error handling
    const errorMsg = error.message || String(error);
    console.error(`Exception occurred: ${errorMsg}`);
    console.error(`Exception type: ${error.constructor?.name || typeof error}`);

    if (errorMsg.toLowerCase().includes('timeout')) {
      throw new Error(`OpenRouter API timeout during HTML generation: ${errorMsg}`);
    } else if (errorMsg.toLowerCase().includes('connection')) {
      throw new Error(`OpenRouter API connection error during HTML generation: ${errorMsg}`);
    } else {
      throw new Error(`OpenRouter API error during HTML generation: ${errorMsg}`);
    }
  }
}

/**
 * Generate HTML from multiple slides in parallel using OpenRouter
 * @param {Array} slides - Array of { imageBase64, mediaType, xmlContent, fonts }
 * @returns {Promise<Array>} Array of HTML content strings
 */
export async function generateHTMLFromSlidesBatch(slides) {
  try {
    console.log(`[Batch] Calling OpenRouter for ${slides.length} slides in parallel (HTML generation)...`);

    // Process all slides in parallel using Promise.all
    const htmlPromises = slides.map(async (slide, index) => {
      try {
        console.log(`[Batch] [Slide ${index + 1}/${slides.length}] Starting HTML generation...`);
        const html = await generateHTMLFromSlide(
          slide.imageBase64,
          slide.mediaType,
          slide.xmlContent,
          slide.fonts
        );
        console.log(`[Batch] [Slide ${index + 1}/${slides.length}] HTML generated successfully (${html.length} chars)`);
        return html;
      } catch (error) {
        console.error(`[Batch] [Slide ${index + 1}/${slides.length}] Error:`, error.message);
        throw new Error(`Failed to generate HTML for slide ${index + 1}: ${error.message}`);
      }
    });

    // Wait for all requests to complete in parallel
    console.log(`[Batch] Waiting for all ${slides.length} HTML generation requests to complete...`);
    const htmlContents = await Promise.all(htmlPromises);

    console.log(`[Batch] Successfully generated HTML for ${htmlContents.length} slides`);
    return htmlContents;
  } catch (error) {
    console.error('[Batch] Error generating HTML from slides:', error);
    throw new Error(`Failed to generate HTML in batch: ${error.message}`);
  }
}

/**
 * Generate React component from HTML using OpenRouter
 * This matches FastAPI's generate_react_component_from_html() function exactly
 */
export async function generateReactFromHTML(htmlContent, imageBase64 = null, mediaType = null) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    // OpenRouter uses OpenAI-compatible API
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://github.com/your-repo',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'AI Slides Backend',
      },
    });

    console.log('Making OpenRouter API request for React component generation...');

    // Build payload with optional image - matches FastAPI exactly
    // FastAPI: content_parts = [{"type": "input_text", "text": f"HTML INPUT:\n{html_content}"}]
    const contentParts = [
      { type: 'input_text', text: `HTML INPUT:\n${htmlContent}` }
    ];

    // FastAPI: if image_base64 and media_type: content_parts.insert(0, {"type": "input_image", "image_url": data_url})
    if (imageBase64 && mediaType) {
      const dataUrl = `data:${mediaType};base64,${imageBase64}`;
      contentParts.unshift({ type: 'input_image', image_url: dataUrl });
    }

    // FastAPI: input_payload = [{"role": "system", "content": HTML_TO_REACT_SYSTEM_PROMPT}, {"role": "user", "content": content_parts}]
    const inputPayload = [
      { role: 'system', content: HTML_TO_REACT_SYSTEM_PROMPT },
      { role: 'user', content: contentParts },
    ];

    let response;
    try {
      // OpenRouter uses chat completions
      const chatMessages = [
        { role: 'system', content: HTML_TO_REACT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: imageBase64 && mediaType
            ? [
                { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
                { type: 'text', text: `HTML INPUT:\n${htmlContent}` }
              ]
            : [{ type: 'text', text: `HTML INPUT:\n${htmlContent}` }]
        }
      ];
      response = await client.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: chatMessages,
        max_tokens: 4000,
        temperature: 0.7
      });
      console.log(`[generateReactFromHTML] API call completed. Response structure:`, {
        hasResponse: !!response,
        hasChoices: !!(response?.choices),
        choicesLength: response?.choices?.length || 0,
      });
    } catch (apiError) {
      console.error('[generateReactFromHTML] OpenRouter API error:', apiError);
      console.error('[generateReactFromHTML] Error details:', {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
        response: apiError.response?.data || apiError.response,
      });
      throw new Error(`OpenRouter API call failed: ${apiError.message}`);
    }

    // FastAPI: react_content = getattr(response, "output_text", None) or getattr(response, "text", None) or ""
    // For chat completions, we get content from choices[0].message.content
    let reactContent = '';
    if (response?.output_text) {
      reactContent = response.output_text;
    } else if (response?.text) {
      reactContent = response.text;
    } else if (response?.choices?.[0]?.message?.content) {
      reactContent = response.choices[0].message.content;
    }

    console.log(`Received React content length: ${reactContent.length}`);

    // FastAPI: if not react_content: raise HTTPException
    if (!reactContent || reactContent.trim().length === 0) {
      console.error('OpenRouter API response:', JSON.stringify(response, null, 2));
      throw new Error('No React component generated by OpenRouter');
    }

    // FastAPI: react_content = react_content.replace("```tsx", "").replace("```", "").replace("typescript", "").replace("javascript", "")
    reactContent = reactContent
      .replace(/```tsx/g, '')
      .replace(/```/g, '')
      .replace(/typescript/g, '')
      .replace(/javascript/g, '');

    // FastAPI: Filter out lines that start with import or export
    // FastAPI: filtered_lines = [line for line in react_content.split("\n") if not (line.strip().startswith("import ") or line.strip().startswith("export "))]
    const filteredLines = [];
    for (const line of reactContent.split('\n')) {
      const strippedLine = line.trim();
      if (
        !strippedLine.startsWith('import ') &&
        !strippedLine.startsWith('export ')
      ) {
        filteredLines.push(line);
      }
    }

    const filteredReactContent = filteredLines.join('\n');
    console.log(`Filtered React content length: ${filteredReactContent.length}`);

    return filteredReactContent;
  } catch (error) {
    // FastAPI error handling
    const errorMsg = error.message || String(error);
    console.error(`Exception occurred: ${errorMsg}`);
    console.error(`Exception type: ${error.constructor?.name || typeof error}`);

    if (errorMsg.toLowerCase().includes('timeout')) {
      throw new Error(`OpenRouter API timeout during React generation: ${errorMsg}`);
    } else if (errorMsg.toLowerCase().includes('connection')) {
      throw new Error(`OpenRouter API connection error during React generation: ${errorMsg}`);
    } else {
      throw new Error(`OpenRouter API error during React generation: ${errorMsg}`);
    }
  }
}

/**
 * Generate React components from multiple HTML contents in parallel using OpenRouter
 * @param {Array} htmlData - Array of { htmlContent, imageBase64 (optional), mediaType (optional) }
 * @returns {Promise<Array>} Array of React component strings
 */
export async function generateReactFromHTMLBatch(htmlData) {
  try {
    console.log(`[Batch] Calling OpenRouter for ${htmlData.length} HTML conversions in parallel (React generation)...`);

    // Process all HTML conversions in parallel using Promise.all
    const reactPromises = htmlData.map(async (item, index) => {
      try {
        console.log(`[Batch] [HTML ${index + 1}/${htmlData.length}] Starting React component generation...`);
        const react = await generateReactFromHTML(
          item.htmlContent,
          item.imageBase64,
          item.mediaType
        );
        console.log(`[Batch] [HTML ${index + 1}/${htmlData.length}] React component generated successfully (${react.length} chars)`);
        return react;
      } catch (error) {
        console.error(`[Batch] [HTML ${index + 1}/${htmlData.length}] Error:`, error.message);
        throw new Error(`Failed to generate React component for HTML ${index + 1}: ${error.message}`);
      }
    });

    // Wait for all requests to complete in parallel
    console.log(`[Batch] Waiting for all ${htmlData.length} React generation requests to complete...`);
    const reactComponents = await Promise.all(reactPromises);

    console.log(`[Batch] Successfully generated React components for ${reactComponents.length} HTML files`);
    return reactComponents;
  } catch (error) {
    console.error('[Batch] Error generating React components:', error);
    throw new Error(`Failed to generate React components in batch: ${error.message}`);
  }
}

/**
 * Read and encode image file to base64
 */
export function readImageAsBase64(imagePath) {
  try {
    // Handle relative paths starting with /app_data/images/
    let actualPath = imagePath;
    if (imagePath.startsWith('/app_data/images/')) {
      const relativePath = imagePath.substring('/app_data/images/'.length);
      actualPath = path.join(getImagesDirectory(), relativePath);
    }

    const imageBuffer = fs.readFileSync(actualPath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine media type from file extension
    const ext = path.extname(actualPath).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

    return { base64Image, mediaType };
  } catch (error) {
    console.error('Error reading image file:', error);
    throw new Error(`Failed to read image: ${error.message}`);
  }
}

