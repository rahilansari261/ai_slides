/**
 * PPTX Models matching FastAPI models/pptx_models.py
 */

export class PptxSpacingModel {
  constructor({ top = 0, bottom = 0, left = 0, right = 0 } = {}) {
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
  }

  static all(num) {
    return new PptxSpacingModel({ top: num, left: num, bottom: num, right: num });
  }
}

export class PptxPositionModel {
  constructor({ left = 0, top = 0, width = 0, height = 0 } = {}) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
  }

  static forTextbox(left, top, width) {
    return new PptxPositionModel({ left, top, width, height: 100 });
  }

  toPtList() {
    return [this.left, this.top, this.width, this.height];
  }

  toPtXyxy() {
    return [
      this.left,
      this.top,
      this.left + this.width,
      this.top + this.height
    ];
  }
}

export class PptxFontModel {
  constructor({
    name = 'Inter',
    size = 16,
    italic = false,
    color = '000000',
    font_weight = 400,
    underline = null,
    strike = null
  } = {}) {
    this.name = name;
    this.size = size;
    this.italic = italic;
    this.color = color;
    this.font_weight = font_weight;
    this.underline = underline;
    this.strike = strike;
  }
}

export class PptxFillModel {
  constructor({ color, opacity = 1.0 } = {}) {
    this.color = color;
    this.opacity = opacity;
  }
}

export class PptxStrokeModel {
  constructor({ color, thickness, opacity = 1.0 } = {}) {
    this.color = color;
    this.thickness = thickness;
    this.opacity = opacity;
  }
}

export class PptxShadowModel {
  constructor({
    radius,
    offset = 0,
    color = '000000',
    opacity = 0.5,
    angle = 0
  } = {}) {
    this.radius = radius;
    this.offset = offset;
    this.color = color;
    this.opacity = opacity;
    this.angle = angle;
  }
}

export class PptxTextRunModel {
  constructor({ text, font = null } = {}) {
    this.text = text;
    this.font = font;
  }
}

export class PptxParagraphModel {
  constructor({
    spacing = null,
    alignment = null,
    font = null,
    line_height = null,
    text = null,
    text_runs = null
  } = {}) {
    this.spacing = spacing;
    this.alignment = alignment;
    this.font = font;
    this.line_height = line_height;
    this.text = text;
    this.text_runs = text_runs;
  }
}

export class PptxObjectFitModel {
  constructor({ fit = null, focus = null } = {}) {
    this.fit = fit; // 'contain', 'cover', 'fill'
    this.focus = focus; // [x, y]
  }
}

export class PptxPictureModel {
  constructor({ is_network, path } = {}) {
    this.is_network = is_network;
    this.path = path;
  }
}

export class PptxTextBoxModel {
  constructor({
    margin = null,
    fill = null,
    position,
    text_wrap = true,
    paragraphs = []
  } = {}) {
    this.shape_type = 'textbox';
    this.margin = margin;
    this.fill = fill;
    this.position = position;
    this.text_wrap = text_wrap;
    this.paragraphs = paragraphs;
  }
}

export class PptxAutoShapeBoxModel {
  constructor({
    type = 'RECTANGLE',
    margin = null,
    fill = null,
    stroke = null,
    shadow = null,
    position,
    text_wrap = true,
    border_radius = null,
    paragraphs = null
  } = {}) {
    this.shape_type = 'autoshape';
    this.type = type;
    this.margin = margin;
    this.fill = fill;
    this.stroke = stroke;
    this.shadow = shadow;
    this.position = position;
    this.text_wrap = text_wrap;
    this.border_radius = border_radius;
    this.paragraphs = paragraphs;
  }
}

export class PptxPictureBoxModel {
  constructor({
    position,
    margin = null,
    clip = true,
    opacity = null,
    invert = false,
    border_radius = null,
    shape = null,
    object_fit = null,
    picture
  } = {}) {
    this.shape_type = 'picture';
    this.position = position;
    this.margin = margin;
    this.clip = clip;
    this.opacity = opacity;
    this.invert = invert;
    this.border_radius = border_radius;
    this.shape = shape; // 'rectangle', 'circle'
    this.object_fit = object_fit;
    this.picture = picture;
  }
}

export class PptxConnectorModel {
  constructor({
    type = 'STRAIGHT',
    position,
    thickness = 0.5,
    color = '000000',
    opacity = 1.0
  } = {}) {
    this.shape_type = 'connector';
    this.type = type;
    this.position = position;
    this.thickness = thickness;
    this.color = color;
    this.opacity = opacity;
  }
}

export class PptxSlideModel {
  constructor({ background = null, note = null, shapes = [] } = {}) {
    this.background = background;
    this.note = note;
    this.shapes = shapes;
  }
}

export class PptxPresentationModel {
  constructor({ name = null, shapes = null, slides = [] } = {}) {
    this.name = name;
    this.shapes = shapes;
    this.slides = slides;
  }
}



