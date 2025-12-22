/**
 * API Configuration
 * Centralized configuration for backend API endpoints
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';

/**
 * Get the full API URL for an endpoint
 */
export function getApiUrl(endpoint: string): string {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
}

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  // Presentations
  presentations: {
    list: () => getApiUrl('api/presentations'),
    get: (id: string) => getApiUrl(`api/presentations/${id}`),
    create: () => getApiUrl('api/presentations/create'),
    update: (id: string) => getApiUrl(`api/presentations/${id}`),
    delete: (id: string) => getApiUrl(`api/presentations/${id}`),
    streamOutlines: (id: string) => getApiUrl(`api/presentations/outlines/stream/${id}`),
    prepare: () => getApiUrl('api/presentations/prepare'),
    stream: (id: string) => getApiUrl(`api/presentations/stream/${id}`),
    export: (id: string, format: string = 'pptx') => getApiUrl(`api/presentations/${id}/export?format=${format}`),
    getPptxModel: (id: string) => getApiUrl(`api/presentations/pptx-model?id=${id}`),
    templates: () => getApiUrl('api/presentations/templates'),
  },
  // Templates
  templates: {
    get: (name: string) => getApiUrl(`api/templates/${name}`),
    getCustom: (id: string) => getApiUrl(`api/templates/custom/${id}`),
  },
  // Custom Templates
  customTemplates: {
    processPptx: () => getApiUrl('api/custom-templates/process-pptx'),
    slideToHtml: () => getApiUrl('api/custom-templates/slide-to-html'),
    htmlToReact: () => getApiUrl('api/custom-templates/html-to-react'),
    saveTemplate: () => getApiUrl('api/custom-templates/save-template'),
    saveLayouts: () => getApiUrl('api/custom-templates/save-layouts'),
  },
} as const;

