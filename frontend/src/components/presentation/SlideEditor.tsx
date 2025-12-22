'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Type,
  AlignLeft,
  Quote,
  BarChart3,
  Columns,
  Layout,
  Flag,
  Plus,
  Trash2,
  ChevronDown,
  MessageSquare
} from 'lucide-react';

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
}

interface SlideEditorProps {
  slide: Slide;
  onChange: (updates: Partial<Slide>) => void;
}

const SLIDE_TYPES = [
  { value: 'title', label: 'Title Slide', icon: Type },
  { value: 'content', label: 'Content', icon: AlignLeft },
  { value: 'two-column', label: 'Two Column', icon: Columns },
  { value: 'quote', label: 'Quote', icon: Quote },
  { value: 'stats', label: 'Statistics', icon: BarChart3 },
  { value: 'section', label: 'Section', icon: Layout },
  { value: 'conclusion', label: 'Conclusion', icon: Flag },
];

export function SlideEditor({ slide, onChange }: SlideEditorProps) {
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const currentType = SLIDE_TYPES.find(t => t.value === slide.type) || SLIDE_TYPES[1];

  const handleBulletChange = (index: number, value: string) => {
    const bullets = [...(slide.bullets || [])];
    bullets[index] = value;
    onChange({ bullets });
  };

  const addBullet = () => {
    const bullets = [...(slide.bullets || []), 'New point'];
    onChange({ bullets });
  };

  const removeBullet = (index: number) => {
    const bullets = (slide.bullets || []).filter((_, i) => i !== index);
    onChange({ bullets });
  };

  const handleStatChange = (index: number, field: 'value' | 'label', value: string) => {
    const stats = [...(slide.stats || [])];
    stats[index] = { ...stats[index], [field]: value };
    onChange({ stats });
  };

  const addStat = () => {
    const stats = [...(slide.stats || []), { value: '0', label: 'Label' }];
    onChange({ stats });
  };

  const removeStat = (index: number) => {
    const stats = (slide.stats || []).filter((_, i) => i !== index);
    onChange({ stats });
  };

  const handleColumnBulletChange = (
    column: 'leftColumn' | 'rightColumn',
    index: number,
    value: string
  ) => {
    const col = { ...(slide[column] || { heading: '', bullets: [] }) };
    col.bullets[index] = value;
    onChange({ [column]: col });
  };

  const addColumnBullet = (column: 'leftColumn' | 'rightColumn') => {
    const col = { ...(slide[column] || { heading: '', bullets: [] }) };
    col.bullets = [...col.bullets, 'New point'];
    onChange({ [column]: col });
  };

  const removeColumnBullet = (column: 'leftColumn' | 'rightColumn', index: number) => {
    const col = { ...(slide[column] || { heading: '', bullets: [] }) };
    col.bullets = col.bullets.filter((_, i) => i !== index);
    onChange({ [column]: col });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Slide Type Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Slide Type</label>
        <div className="relative">
          <button
            onClick={() => setShowTypeSelector(!showTypeSelector)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted border border-border rounded-xl hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <currentType.icon className="w-5 h-5 text-primary" />
              <span>{currentType.label}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showTypeSelector ? 'rotate-180' : ''}`} />
          </button>

          {showTypeSelector && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-10"
            >
              {SLIDE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => {
                    onChange({ type: type.value });
                    setShowTypeSelector(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors ${
                    slide.type === type.value ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  <type.icon className="w-5 h-5" />
                  <span>{type.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Common Fields */}
      {(slide.type !== 'quote') && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Title</label>
          <input
            type="text"
            value={slide.title || ''}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            placeholder="Slide title"
          />
        </div>
      )}

      {slide.type === 'title' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Subtitle</label>
          <input
            type="text"
            value={slide.subtitle || ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            placeholder="Subtitle or tagline"
          />
        </div>
      )}

      {/* Bullets for content/conclusion */}
      {(slide.type === 'content' || slide.type === 'conclusion') && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Bullet Points</label>
          {slide.bullets?.map((bullet, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={bullet}
                onChange={(e) => handleBulletChange(i, e.target.value)}
                className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
              />
              <button
                onClick={() => removeBullet(i)}
                className="p-2 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addBullet}
            className="w-full py-2 border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Point
          </button>
        </div>
      )}

      {/* Two Column */}
      {slide.type === 'two-column' && (
        <>
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Left Column</label>
            <input
              type="text"
              value={slide.leftColumn?.heading || ''}
              onChange={(e) => onChange({ leftColumn: { ...slide.leftColumn!, heading: e.target.value } })}
              className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
              placeholder="Column heading"
            />
            {slide.leftColumn?.bullets?.map((bullet, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={bullet}
                  onChange={(e) => handleColumnBulletChange('leftColumn', i, e.target.value)}
                  className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                />
                <button
                  onClick={() => removeColumnBullet('leftColumn', i)}
                  className="p-2 text-muted-foreground hover:text-accent rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addColumnBullet('leftColumn')}
              className="w-full py-2 border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Point
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Right Column</label>
            <input
              type="text"
              value={slide.rightColumn?.heading || ''}
              onChange={(e) => onChange({ rightColumn: { ...slide.rightColumn!, heading: e.target.value } })}
              className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
              placeholder="Column heading"
            />
            {slide.rightColumn?.bullets?.map((bullet, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={bullet}
                  onChange={(e) => handleColumnBulletChange('rightColumn', i, e.target.value)}
                  className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                />
                <button
                  onClick={() => removeColumnBullet('rightColumn', i)}
                  className="p-2 text-muted-foreground hover:text-accent rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addColumnBullet('rightColumn')}
              className="w-full py-2 border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Point
            </button>
          </div>
        </>
      )}

      {/* Quote */}
      {slide.type === 'quote' && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Quote</label>
            <textarea
              value={slide.quote || ''}
              onChange={(e) => onChange({ quote: e.target.value })}
              className="w-full h-24 px-4 py-3 bg-muted border border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
              placeholder="Enter the quote"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Attribution</label>
            <input
              type="text"
              value={slide.attribution || ''}
              onChange={(e) => onChange({ attribution: e.target.value })}
              className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              placeholder="Author name"
            />
          </div>
        </>
      )}

      {/* Stats */}
      {slide.type === 'stats' && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Statistics</label>
          {slide.stats?.map((stat, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={stat.value}
                onChange={(e) => handleStatChange(i, 'value', e.target.value)}
                className="w-24 px-3 py-2 bg-muted border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm text-center font-bold"
                placeholder="Value"
              />
              <input
                type="text"
                value={stat.label}
                onChange={(e) => handleStatChange(i, 'label', e.target.value)}
                className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                placeholder="Label"
              />
              <button
                onClick={() => removeStat(i)}
                className="p-2 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addStat}
            className="w-full py-2 border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Statistic
          </button>
        </div>
      )}

      {/* Conclusion CTA */}
      {slide.type === 'conclusion' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Call to Action</label>
          <input
            type="text"
            value={slide.callToAction || ''}
            onChange={(e) => onChange({ callToAction: e.target.value })}
            className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            placeholder="e.g., Get Started Today!"
          />
        </div>
      )}

      {/* Speaker Notes */}
      <div className="space-y-2 pt-4 border-t border-border">
        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Speaker Notes
        </label>
        <textarea
          value={slide.speakerNotes || ''}
          onChange={(e) => onChange({ speakerNotes: e.target.value })}
          className="w-full h-24 px-4 py-3 bg-muted border border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none text-sm"
          placeholder="Notes for the presenter (not visible in presentation)"
        />
      </div>
    </div>
  );
}

