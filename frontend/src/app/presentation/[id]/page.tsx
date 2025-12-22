'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Download,
  Play,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  Palette,
  Settings,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import { SlidePreview } from '@/components/presentation/SlidePreview';
import { ThemePanel } from '@/components/presentation/ThemePanel';
import { exportPresentation } from '@/lib/exportApi';

interface Slide {
  id: string;
  type: string;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  quote?: string;
  attribution?: string;
  stats?: { value: string; label: string }[];
  leftColumn?: { heading: string; bullets: string[] };
  rightColumn?: { heading: string; bullets: string[] };
  callToAction?: string;
  speakerNotes?: string;
  content?: string | { // Raw content from backend - can be string or object
    title?: string;
    content?: string;
    text?: string;
    __speaker_note__?: string;
  };
  text?: string; // Alternative content field
  image?: string; // Slide image URL
  imageUrl?: string; // Alternative image field
}

interface Theme {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
}

interface Presentation {
  id: string;
  topic: string;
  slides: Slide[];
  theme: Theme;
  pptxPath?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PresentationEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPresentation();
  }, [id]);

  const fetchPresentation = async () => {
    try {
      const res = await fetch(`http://localhost:5002/api/presentations/${id}`);
      if (!res.ok) throw new Error('Presentation not found');
      const data = await res.json();
      
      // Ensure theme exists with default values
      if (!data.theme) {
        data.theme = {
          primaryColor: '#6366f1',
          secondaryColor: '#8b5cf6',
          backgroundColor: '#ffffff',
          textColor: '#1f2937',
          fontFamily: 'system-ui',
        };
      }
      
      // Process slides to ensure they have proper structure
      if (data.slides && Array.isArray(data.slides)) {
        data.slides = data.slides.map((slide: any) => {
          // Extract image URL from various possible fields
          if (!slide.image && !slide.imageUrl) {
            slide.image = slide.image_url || slide.imageUrl || slide.screenshot_url || null;
          }
          
          // Handle nested content structure from backend
          // Backend sends: { content: { title: "...", content: "..." } }
          if (slide.content && typeof slide.content === 'object' && !Array.isArray(slide.content)) {
            const contentObj = slide.content;
            // Extract title from content object
            if (contentObj.title && !slide.title) {
              slide.title = contentObj.title;
            }
            // Extract content string
            const contentString = contentObj.content || contentObj.text || '';
            if (contentString && typeof contentString === 'string') {
              // Parse for bullets
              const lines = contentString.split('\n').filter((line: string) => line.trim());
              const bulletPattern = /^[-•*]\s*/;
              const hasBullets = lines.some(line => bulletPattern.test(line));
              
              if (hasBullets && !slide.bullets) {
                slide.bullets = lines
                  .map((line: string) => line.replace(/^[-•*]\s*/, '').replace(/\*\*/g, '').trim())
                  .filter((line: string) => line);
              }
            }
          } else if (slide.content && typeof slide.content === 'string') {
            // Fallback: content is a string
            if (!slide.title && !slide.bullets) {
              const lines = slide.content.split('\n').filter((line: string) => line.trim());
              if (lines.length > 0) {
                slide.title = lines[0];
                if (lines.length > 1) {
                  slide.bullets = lines.slice(1).map((line: string) => line.replace(/^[-•*]\s*/, '').trim());
                }
              }
            }
          }
          
          // Ensure slide has a type
          if (!slide.type) {
            slide.type = slide.title ? 'content' : 'title';
          }
          
          // If slide has title but no bullets, add empty bullets array for content slides
          if (slide.type === 'content' && slide.title && !slide.bullets) {
            slide.bullets = [];
          }
          
          return slide;
        });
      }
      
      setPresentation(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const savePresentation = async () => {
    if (!presentation) return;
    
    setSaving(true);
    try {
      const res = await fetch(`http://localhost:5002/api/presentations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: presentation.slides,
          theme: presentation.theme
        })
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      const updated = await res.json();
      setPresentation(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateSlide = (index: number, updates: Partial<Slide>) => {
    if (!presentation) return;
    
    const newSlides = [...presentation.slides];
    newSlides[index] = { ...newSlides[index], ...updates };
    setPresentation({ ...presentation, slides: newSlides });
  };

  const addSlide = (afterIndex: number) => {
    if (!presentation) return;
    
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      type: 'content',
      title: 'New Slide',
      bullets: ['Point 1', 'Point 2', 'Point 3']
    };
    
    const newSlides = [...presentation.slides];
    newSlides.splice(afterIndex + 1, 0, newSlide);
    setPresentation({ ...presentation, slides: newSlides });
    setActiveSlideIndex(afterIndex + 1);
  };

  const deleteSlide = (index: number) => {
    if (!presentation || presentation.slides.length <= 1) return;
    
    const newSlides = presentation.slides.filter((_, i) => i !== index);
    setPresentation({ ...presentation, slides: newSlides });
    
    if (activeSlideIndex >= newSlides.length) {
      setActiveSlideIndex(newSlides.length - 1);
    }
  };

  const moveSlide = (fromIndex: number, direction: 'up' | 'down') => {
    if (!presentation) return;
    
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= presentation.slides.length) return;
    
    const newSlides = [...presentation.slides];
    [newSlides[fromIndex], newSlides[toIndex]] = [newSlides[toIndex], newSlides[fromIndex]];
    setPresentation({ ...presentation, slides: newSlides });
    setActiveSlideIndex(toIndex);
  };

  const updateTheme = (updates: Partial<Theme>) => {
    if (!presentation) return;
    setPresentation({
      ...presentation,
      theme: { ...presentation.theme, ...updates }
    });
  };

  const downloadPresentation = async () => {
    if (!presentation) return;
    
    setExporting(true);
    setError('');
    
    try {
      const filename = `${presentation.topic || 'presentation'}.pptx`;
      await exportPresentation(id, 'pptx', filename);
    } catch (err: any) {
      setError(err.message || 'Failed to export presentation');
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-accent">{error || 'Presentation not found'}</p>
        <Link href="/" className="text-primary hover:underline">
          Go back home
        </Link>
      </div>
    );
  }

  const activeSlide = presentation.slides[activeSlideIndex];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-bold text-lg">Presenton</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowThemePanel(!showThemePanel)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <Palette className="w-4 h-4" />
            Theme
          </button>
          <Link
            href={`/presentation/${id}/view`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            Present
          </Link>
          <button
            onClick={downloadPresentation}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary rounded-lg transition-all hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Slide Thumbnails Sidebar */}
        <aside className="w-72 border-r border-border bg-card overflow-y-auto p-4">
          <div className="space-y-3">
            {presentation.slides.map((slide, index) => {
              const imageUrl = slide.image || slide.imageUrl || (slide as any).image_url;
              const hasImage = imageUrl && typeof imageUrl === 'string';
              
              return (
                <motion.div
                  key={slide.id}
                  layout
                  className={`group relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    index === activeSlideIndex
                      ? 'border-primary shadow-lg shadow-primary/20'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setActiveSlideIndex(index)}
                >
                  {hasImage ? (
                    <div className="relative aspect-video">
                      <img
                        src={imageUrl.startsWith('http') ? imageUrl : `http://localhost:5002${imageUrl}`}
                        alt={slide.title || `Slide ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      {slide.title && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-white text-xs font-medium line-clamp-1">{slide.title}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="slide-preview bg-muted aspect-video">
                      <SlidePreview slide={slide} theme={presentation.theme} mini />
                    </div>
                  )}
                  
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white font-medium">
                    {index + 1}
                  </div>

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveSlide(index, 'up'); }}
                        disabled={index === 0}
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded disabled:opacity-30"
                      >
                        <GripVertical className="w-3 h-3 rotate-90" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); addSlide(index); }}
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSlide(index); }}
                        disabled={presentation.slides.length <= 1}
                        className="p-1.5 bg-white/10 hover:bg-accent/80 rounded disabled:opacity-30"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <button
            onClick={() => addSlide(presentation.slides.length - 1)}
            className="w-full mt-4 py-3 border-2 border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Slide
          </button>
        </aside>

        {/* Main Editor Area */}
        <main className="flex-1 flex overflow-hidden">
          {/* Preview */}
          <div className="flex-1 p-8 overflow-y-auto flex items-center justify-center bg-background">
            <div className="w-full max-w-6xl">
              <div className="slide-preview w-full rounded-lg overflow-hidden shadow-lg border border-border bg-white">
                <SlidePreview slide={activeSlide} theme={presentation.theme} />
              </div>
            </div>
          </div>

          {/* Theme Panel */}
          <AnimatePresence>
            {showThemePanel && (
              <motion.aside
                initial={{ x: 320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 320, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute right-0 top-0 bottom-0 w-80 border-l border-border bg-card shadow-2xl overflow-y-auto"
                style={{ top: '57px' }}
              >
                <ThemePanel
                  theme={presentation.theme}
                  onChange={updateTheme}
                  onClose={() => setShowThemePanel(false)}
                />
              </motion.aside>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

