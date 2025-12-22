/**
 * HTML to Text Runs Parser
 * Matches FastAPI services/html_to_text_runs_service.py
 */

import { PptxFontModel, PptxTextRunModel } from '../models/pptxModels.js';

class InlineHTMLToRunsParser {
  constructor(baseFont) {
    this.baseFont = baseFont || new PptxFontModel();
    this.tagStack = [];
    this.textRuns = [];
  }

  _currentFont() {
    const fontJson = {
      name: this.baseFont.name,
      size: this.baseFont.size,
      italic: this.baseFont.italic,
      color: this.baseFont.color,
      font_weight: this.baseFont.font_weight,
      underline: this.baseFont.underline,
      strike: this.baseFont.strike
    };

    const isBold = this.tagStack.some(tag => ['strong', 'b'].includes(tag));
    const isItalic = this.tagStack.some(tag => ['em', 'i'].includes(tag));
    const isUnderline = this.tagStack.includes('u');
    const isStrike = this.tagStack.some(tag => ['s', 'strike', 'del'].includes(tag));
    const isCode = this.tagStack.includes('code');

    if (isBold) {
      fontJson.font_weight = 700;
    }
    if (isItalic) {
      fontJson.italic = true;
    }
    if (isUnderline) {
      fontJson.underline = true;
    }
    if (isStrike) {
      fontJson.strike = true;
    }
    if (isCode) {
      fontJson.name = 'Courier New';
    }

    return new PptxFontModel(fontJson);
  }

  handleStartTag(tag) {
    tag = tag.toLowerCase();
    if (tag === 'br') {
      this.textRuns.push(new PptxTextRunModel({ text: '\n' }));
      return;
    }
    this.tagStack.push(tag);
  }

  handleEndTag(tag) {
    tag = tag.toLowerCase();
    for (let i = this.tagStack.length - 1; i >= 0; i--) {
      if (this.tagStack[i] === tag) {
        this.tagStack.splice(i, 1);
        break;
      }
    }
  }

  handleData(data) {
    if (data === '') {
      return;
    }
    this.textRuns.push(new PptxTextRunModel({
      text: data,
      font: this._currentFont()
    }));
  }

  parse(html) {
    // Simple HTML parser for inline tags
    let i = 0;
    while (i < html.length) {
      if (html[i] === '<') {
        const endIndex = html.indexOf('>', i);
        if (endIndex === -1) break;
        
        const tagContent = html.substring(i + 1, endIndex);
        const isClosing = tagContent.startsWith('/');
        const tagName = isClosing 
          ? tagContent.substring(1).trim().split(/\s/)[0]
          : tagContent.trim().split(/\s/)[0];
        
        if (isClosing) {
          this.handleEndTag(tagName);
        } else {
          this.handleStartTag(tagName);
        }
        
        i = endIndex + 1;
      } else {
        let textEnd = html.indexOf('<', i);
        if (textEnd === -1) textEnd = html.length;
        
        const text = html.substring(i, textEnd);
        this.handleData(text);
        i = textEnd;
      }
    }
    
    return this.textRuns;
  }
}

/**
 * Parse HTML text to text runs
 * Matches FastAPI parse_html_text_to_text_runs()
 */
export function parseHtmlTextToTextRuns(text, baseFont = null) {
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br>');

  const parser = new InlineHTMLToRunsParser(baseFont || new PptxFontModel());
  return parser.parse(normalizedText);
}



