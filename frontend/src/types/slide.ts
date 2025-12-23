export interface Slide {
  id: string;
  index: number;
  type: string;
  layout: string;
  layout_group: string;
  content: any;
  properties?: any;
  images?: string[];
  icons?: string[];
  speaker_note?: string;
  [key: string]: any;
}

