'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  X, 
  Sparkles, 
  Loader2, 
  ChevronDown, 
  Languages,
  MessageSquare,
  AlignLeft,
  Hash,
  ArrowRight,
  ArrowLeft,
  Check,
  Palette,
  FileText,
  Layout,
  Layers
} from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/apiConfig';
import { createPresentationStep, streamOutlinesStep, preparePresentationStep, streamSlidesStep } from '@/lib/presentationApiHelpers';
import type { Presentation } from '@/lib/presentationApi';

interface Template {
  id: string;
  name: string;
  description: string;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
  };
  decorationStyle?: string;
}

interface CreatePresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'educational', label: 'Educational' },
  { value: 'sales_pitch', label: 'Sales Pitch' },
  { value: 'funny', label: 'Funny' },
];

const VERBOSITIES = [
  { value: 'concise', label: 'Concise' },
  { value: 'standard', label: 'Standard' },
  { value: 'text-heavy', label: 'Text Heavy' },
];

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 
  'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Hindi'
];

export function CreatePresentationModal({ isOpen, onClose, onSuccess }: CreatePresentationModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1 = input, 2 = generating outlines, 3 = review outlines, 4 = template selection, 5 = generating slides
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generationStep, setGenerationStep] = useState(0); // 1-4 for generation steps (used in step 5)
  const [generationMessage, setGenerationMessage] = useState('');
  const [generatedSlides, setGeneratedSlides] = useState<any[]>([]);
  const [presentationWithOutlines, setPresentationWithOutlines] = useState<Presentation | null>(null);
  const [presentationId, setPresentationId] = useState<string | null>(null);
  const [isPrepared, setIsPrepared] = useState(false); // Track if presentation is prepared and ready to stream
  const eventSourceRef = useRef<EventSource | null>(null);
  
  const [formData, setFormData] = useState({
    topic: '',
    numSlides: 8,
    language: 'English',
    tone: 'professional',
    verbosity: 'standard',
    instructions: '',
    templateId: '',
    includeTitleSlide: true,
    includeTableOfContents: false,
    webSearch: false
  });

  // Fetch templates when modal opens
  useEffect(() => {
    if (isOpen && templates.length === 0) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch(API_ENDPOINTS.presentations.templates());
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleGenerateOutlines = async () => {
    if (!formData.topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError('');
    setStep(2); // Move to generating outlines step
    setGenerationMessage('Creating presentation...');

    // Clean up any existing event sources
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // Step 1: Create presentation
      const presentation = await createPresentationStep({
        content: formData.topic,
        n_slides: formData.numSlides,
        language: formData.language || 'English',
        tone: formData.tone || 'professional',
        verbosity: formData.verbosity || 'standard',
        instructions: formData.instructions || '',
        include_title_slide: formData.includeTitleSlide !== false,
        include_table_of_contents: formData.includeTableOfContents || false,
        web_search: formData.webSearch || false,
        file_paths: null,
      });

      setPresentationId(presentation.id);
      setGenerationMessage('Generating outlines...');

      // Step 2: Stream outlines
      await new Promise<void>((resolve, reject) => {
        const eventSource = streamOutlinesStep(
          presentation.id,
          {
            onStatus: (status) => {
              setGenerationMessage(`Generating outlines: ${status}`);
            },
            onChunk: (chunk) => {
              // Optional: Show streaming progress
            },
            onComplete: (updatedPresentation) => {
              setPresentationWithOutlines(updatedPresentation);
              setLoading(false);
              setStep(3); // Move to review outlines step
              resolve();
            },
            onError: (errorMessage) => {
              setError(errorMessage);
              setLoading(false);
              setStep(1); // Go back to input
              reject(new Error(errorMessage));
            },
          }
        );
        eventSourceRef.current = eventSource;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to generate outlines');
      setLoading(false);
      setStep(1);
    }
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(1);
    } else if (step === 4) {
      setStep(3);
    }
    setError('');
  };

  const handleProceedToTemplateSelection = () => {
    setStep(4);
    // Fetch templates if not already loaded
    if (templates.length === 0) {
      fetchTemplates();
    }
  };

  const handleGeneratePresentation = async () => {
    if (!formData.templateId) {
      setError('Please select a template');
      return;
    }

    if (!presentationId || !presentationWithOutlines) {
      setError('Missing presentation data. Please start over.');
      return;
    }

    setLoading(true);
    setError('');
    setIsPrepared(false);
    setStep(5); // Move to generating slides step
    setGenerationMessage('Preparing presentation with template...');
    setGenerationStep(3);
    setGeneratedSlides([]);

    // Clean up any existing event sources
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // Extract outlines
      let outlinesArray: any[] = [];
      if (presentationWithOutlines.outlines) {
        if (Array.isArray(presentationWithOutlines.outlines)) {
          outlinesArray = presentationWithOutlines.outlines;
        } else if (presentationWithOutlines.outlines.slides) {
          outlinesArray = presentationWithOutlines.outlines.slides;
        }
      }

      // Step 3: Prepare with template
      const templateName = formData.templateId;
      const preparedPresentation = await preparePresentationStep(
        presentationId,
        outlinesArray,
        templateName,
        formData.topic
      );

      // Prepare is complete, show button to stream
      setGenerationMessage('Presentation prepared! Click "Stream Slides" to generate slides.');
      setGenerationStep(4);
      setIsPrepared(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to prepare presentation');
      setLoading(false);
      setIsPrepared(false);
    }
  };

  const handleStreamSlides = async () => {
    if (!presentationId) {
      setError('Missing presentation data. Please start over.');
      return;
    }

    setLoading(true);
    setError('');
    setGenerationMessage('Generating slides...');
    setGeneratedSlides([]);

    // Clean up any existing event sources
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // Step 4: Stream slide generation
      await new Promise<void>((resolve, reject) => {
        const eventSource = streamSlidesStep(
          presentationId,
          {
            onSlide: (slide) => {
              setGeneratedSlides(prev => {
                const newSlides = [...prev, slide];
                setGenerationMessage(`Generated slide ${newSlides.length}`);
                return newSlides;
              });
            },
            onComplete: (finalPresentation) => {
              router.push(`/presentation/${finalPresentation.id}`);
              onSuccess();
              handleClose();
              resolve();
            },
            onError: (errorMessage) => {
              setError(errorMessage);
              setLoading(false);
              reject(new Error(errorMessage));
            },
          }
        );
        eventSourceRef.current = eventSource;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to stream slides');
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Clean up event sources
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStep(1);
    setError('');
    setIsPrepared(false);
    setGenerationStep(0);
    setGenerationMessage('');
    setGeneratedSlides([]);
    setGenerationStep(0);
    setGenerationMessage('');
    setGeneratedSlides([]);
    setPresentationWithOutlines(null);
    setPresentationId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl glass rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="relative p-6 border-b border-border shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  {step === 1 ? (
                    <Sparkles className="w-5 h-5 text-white" />
                  ) : step === 2 ? (
                    <Palette className="w-5 h-5 text-white" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {step === 1 
                      ? 'Create Presentation' 
                      : step === 2 
                      ? 'Generating Outlines' 
                      : step === 3 
                      ? 'Review Outlines' 
                      : step === 4 
                      ? 'Choose Template' 
                      : 'Generating Slides'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {step === 1 
                      ? 'Step 1: Enter your topic and preferences' 
                      : step === 2 
                      ? generationMessage || 'Generating outlines...'
                      : step === 3
                      ? 'Review the generated outlines and proceed to select a template'
                      : step === 4
                      ? 'Step 3: Select a design template'
                      : generationMessage || 'Generating slides...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Step indicators */}
                {step !== 3 && (
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step >= 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {step > 1 ? <Check className="w-4 h-4" /> : '1'}
                    </div>
                    <div className={`w-8 h-1 rounded ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step >= 2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {step > 2 ? <Check className="w-4 h-4" /> : '2'}
                    </div>
                  </div>
                )}
                <button
                  onClick={handleClose}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 space-y-6"
                >
                  {/* Topic */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      Topic / Prompt
                    </label>
                    <textarea
                      value={formData.topic}
                      onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                      placeholder="e.g., Introduction to Machine Learning for Beginners"
                      className="w-full h-28 px-4 py-3 bg-muted border border-border rounded-xl resize-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Number of Slides */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Hash className="w-4 h-4 text-primary" />
                        Number of Slides
                      </label>
                      <div className="relative">
                        <select
                          value={formData.numSlides}
                          onChange={(e) => setFormData(prev => ({ ...prev, numSlides: parseInt(e.target.value) }))}
                          className="w-full px-4 py-3 bg-muted border border-border rounded-xl appearance-none cursor-pointer focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        >
                          {[5, 6, 7, 8, 9, 10, 12, 15, 20].map(n => (
                            <option key={n} value={n}>{n} slides</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* Language */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Languages className="w-4 h-4 text-primary" />
                        Language
                      </label>
                      <div className="relative">
                        <select
                          value={formData.language}
                          onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                          className="w-full px-4 py-3 bg-muted border border-border rounded-xl appearance-none cursor-pointer focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        >
                          {LANGUAGES.map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* Tone */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        Tone
                      </label>
                      <div className="relative">
                        <select
                          value={formData.tone}
                          onChange={(e) => setFormData(prev => ({ ...prev, tone: e.target.value }))}
                          className="w-full px-4 py-3 bg-muted border border-border rounded-xl appearance-none cursor-pointer focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        >
                          {TONES.map(tone => (
                            <option key={tone.value} value={tone.value}>{tone.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* Verbosity */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <AlignLeft className="w-4 h-4 text-primary" />
                        Content Length
                      </label>
                      <div className="relative">
                        <select
                          value={formData.verbosity}
                          onChange={(e) => setFormData(prev => ({ ...prev, verbosity: e.target.value }))}
                          className="w-full px-4 py-3 bg-muted border border-border rounded-xl appearance-none cursor-pointer focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        >
                          {VERBOSITIES.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Additional Instructions */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Additional Instructions (Optional)
                    </label>
                    <textarea
                      value={formData.instructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                      placeholder="e.g., Focus on practical examples, include case studies..."
                      className="w-full h-20 px-4 py-3 bg-muted border border-border rounded-xl resize-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-accent/10 border border-accent/20 rounded-xl text-accent text-sm"
                    >
                      {error}
                    </motion.div>
                  )}
                </motion.div>
              ) : step === 2 ? (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="p-6"
                >
                  <div className="flex flex-col items-center justify-center py-12 space-y-6">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                      </div>
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-primary/20"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-bold">Generating Outlines</h3>
                      <p className="text-muted-foreground">{generationMessage || 'Please wait...'}</p>
                    </div>
                  </div>
                </motion.div>
              ) : step === 3 ? (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="p-6"
                >
                  <div className="mb-4">
                    <p className="text-muted-foreground mb-2">
                      Review the generated outlines for <span className="text-foreground font-medium">"{formData.topic}"</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {presentationWithOutlines?.outlines?.slides?.length || 0} slides generated
                    </p>
                  </div>

                  {/* Outlines Review */}
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {presentationWithOutlines?.outlines?.slides?.map((outline: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-muted rounded-lg border border-border"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <pre className="whitespace-pre-wrap text-sm text-foreground font-mono">
                                {outline.content || 'No content'}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-xl text-accent text-sm"
                    >
                      {error}
                    </motion.div>
                  )}
                </motion.div>
              ) : step === 4 ? (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="p-6"
                >
                  <div className="mb-4">
                    <p className="text-muted-foreground">
                      Select a template for <span className="text-foreground font-medium">"{formData.topic}"</span>
                    </p>
                  </div>

                  {loadingTemplates ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {templates.map((template) => {
                        // Provide default theme values if missing
                        const theme = template.theme || {
                          primaryColor: '#6366f1',
                          secondaryColor: '#8b5cf6',
                          backgroundColor: '#ffffff',
                          textColor: '#1f2937',
                        };
                        const decorationStyle = template.decorationStyle || 'geometric';
                        
                        return (
                        <motion.button
                          key={template.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, templateId: template.id }))}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
                            formData.templateId === template.id
                              ? 'border-primary shadow-lg shadow-primary/20'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {/* Template Preview */}
                          <div 
                            className="aspect-[16/10] p-3"
                            style={{ backgroundColor: theme.backgroundColor || '#ffffff' }}
                          >
                            {/* Mini slide preview */}
                            <div className="h-full flex flex-col justify-center items-start pl-2">
                              {/* Decoration shapes based on style */}
                              <div 
                                className="absolute top-0 right-0 w-8 h-8 opacity-30"
                                style={{ 
                                  backgroundColor: theme.primaryColor || '#6366f1',
                                  clipPath: decorationStyle === 'geometric' 
                                    ? 'polygon(100% 0, 0 0, 100% 100%)' 
                                    : 'circle(50% at 100% 0)'
                                }}
                              />
                              <div 
                                className="absolute bottom-0 left-0 w-6 h-1 rounded"
                                style={{ backgroundColor: theme.primaryColor || '#6366f1' }}
                              />
                              
                              {/* Title preview */}
                              <div 
                                className="text-[8px] font-bold mb-1 line-clamp-1"
                                style={{ color: theme.primaryColor || '#6366f1' }}
                              >
                                Title Here
                              </div>
                              {/* Content lines */}
                              <div 
                                className="w-16 h-[3px] rounded mb-1 opacity-40"
                                style={{ backgroundColor: theme.textColor || '#1f2937' }}
                              />
                              <div 
                                className="w-12 h-[3px] rounded opacity-30"
                                style={{ backgroundColor: theme.textColor || '#1f2937' }}
                              />
                            </div>
                          </div>

                          {/* Template Info */}
                          <div className="p-3 bg-card border-t border-border">
                            <h4 className="font-medium text-sm truncate">{template.name}</h4>
                            <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                            
                            {/* Color swatches */}
                            <div className="flex gap-1 mt-2">
                              <div 
                                className="w-4 h-4 rounded-full border border-border"
                                style={{ backgroundColor: theme.primaryColor || '#6366f1' }}
                                title="Primary"
                              />
                              <div 
                                className="w-4 h-4 rounded-full border border-border"
                                style={{ backgroundColor: theme.secondaryColor || '#8b5cf6' }}
                                title="Secondary"
                              />
                              <div 
                                className="w-4 h-4 rounded-full border border-border"
                                style={{ backgroundColor: theme.backgroundColor || '#ffffff' }}
                                title="Background"
                              />
                            </div>
                          </div>

                          {/* Selected indicator */}
                          {formData.templateId === template.id && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                            >
                              <Check className="w-4 h-4 text-white" />
                            </motion.div>
                          )}
                        </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-xl text-accent text-sm"
                    >
                      {error}
                    </motion.div>
                  )}
                </motion.div>
              ) : step === 5 ? (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="p-6"
                >
                  <div className="flex flex-col items-center justify-center py-12 space-y-6">
                    {(!isPrepared || (isPrepared && loading)) && (
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                          <Loader2 className="w-10 h-10 text-white animate-spin" />
                        </div>
                        <motion.div
                          className="absolute inset-0 rounded-full border-4 border-primary/20"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                    )}

                    {isPrepared && !loading && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center"
                      >
                        <Check className="w-10 h-10 text-white" />
                      </motion.div>
                    )}

                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-bold">
                        {isPrepared && !loading 
                          ? 'Ready to Generate Slides' 
                          : isPrepared && loading
                          ? 'Generating Slides'
                          : 'Preparing Presentation'}
                      </h3>
                      <p className="text-muted-foreground">{generationMessage || 'Please wait...'}</p>
                    </div>

                    {isPrepared && !loading && (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={handleStreamSlides}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-secondary rounded-xl font-medium text-white shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <Sparkles className="w-5 h-5" />
                        Stream Slides
                      </motion.button>
                    )}

                    {/* Progress Steps */}
                    <div className="w-full max-w-md space-y-4">
                      {[
                        { step: 1, label: 'Create Presentation', icon: FileText },
                        { step: 2, label: 'Generate Outlines', icon: FileText },
                        { step: 3, label: 'Prepare with Template', icon: Layout },
                        { step: 4, label: 'Generate Slides', icon: Layers },
                      ].map(({ step, label, icon: Icon }) => (
                        <div
                          key={step}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                            generationStep >= step
                              ? 'bg-primary/10 border border-primary/20'
                              : 'bg-muted border border-border'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              generationStep > step
                                ? 'bg-primary text-white'
                                : generationStep === step
                                ? 'bg-primary text-white'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {generationStep > step ? (
                              <Check className="w-4 h-4" />
                            ) : generationStep === step ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Icon className="w-4 h-4" />
                            )}
                          </div>
                          <span
                            className={`flex-1 text-sm font-medium ${
                              generationStep >= step ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Generated Slides Count */}
                    {generatedSlides.length > 0 && (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                          Generated {generatedSlides.length} slide{generatedSlides.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-md p-4 bg-accent/10 border border-accent/20 rounded-xl text-accent text-sm"
                      >
                        {error}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border bg-card/50 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                {(step === 3 || step === 4) && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                {step === 1 ? (
                  <button
                    type="button"
                    onClick={handleGenerateOutlines}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-secondary rounded-xl font-medium text-white shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Outlines
                      </>
                    )}
                  </button>
                ) : step === 3 ? (
                  <button
                    type="button"
                    onClick={handleProceedToTemplateSelection}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-secondary rounded-xl font-medium text-white shadow-lg hover:shadow-primary/25 transition-all"
                  >
                    Continue to Template Selection
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : step === 4 ? (
                  <button
                    type="button"
                    onClick={handleGeneratePresentation}
                    disabled={loading || !formData.templateId}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-secondary rounded-xl font-medium text-white shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Layout className="w-5 h-5" />
                        Prepare Presentation
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
