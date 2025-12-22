import prisma from '../config/prisma.js';
import { v4 as uuidv4 } from 'uuid';
import { extractTemplateFromPPTX } from '../services/pptxParser.service.js';
import fs from 'fs';
import path from 'path';

// Get all templates
export const getAllTemplates = async (req, res) => {
  try {
    const templates = await prisma.template.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get a specific template by ID
export const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.template.findFirst({
      where: { id, isActive: true },
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create a new template
export const createTemplate = async (req, res) => {
  try {
    const {
      id,
      name,
      description,
      preview,
      theme,
      decorationStyle,
      slideLayouts,
      contentSchema,
      isDefault
    } = req.body;

    if (!name || !theme || !decorationStyle) {
      return res.status(400).json({ 
        error: 'Name, theme, and decorationStyle are required' 
      });
    }

    // Generate ID if not provided
    const templateId = id || name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Check if template with this ID already exists
    const existingTemplate = await prisma.template.findUnique({ 
      where: { id: templateId } 
    });
    if (existingTemplate) {
      return res.status(400).json({ error: 'Template with this ID already exists' });
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.template.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.template.create({
      data: {
        id: templateId,
        name,
        description: description || '',
        preview: preview || '',
        theme: {
          primaryColor: theme.primaryColor || '#8b5cf6',
          secondaryColor: theme.secondaryColor || '#a78bfa',
          backgroundColor: theme.backgroundColor || '#0f172a',
          textColor: theme.textColor || '#f8fafc',
          fontFamily: theme.fontFamily || 'Arial'
        },
        decorationStyle,
        slideLayouts: slideLayouts || [],
        contentSchema: contentSchema || {},
        isDefault: isDefault || false,
        isActive: true
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update a template
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const template = await prisma.template.findFirst({
      where: { id, isActive: true },
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // If setting as default, unset other defaults
    if (updates.isDefault === true) {
      await prisma.template.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Update fields
    const updateData = {};
    Object.keys(updates).forEach(key => {
      if (key === 'theme' && typeof updates[key] === 'object') {
        updateData.theme = { ...template.theme, ...updates[key] };
      } else if (key !== 'id') {
        updateData[key] = updates[key];
      }
    });

    const updatedTemplate = await prisma.template.update({
      where: { id },
      data: updateData,
    });

    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a template (soft delete)
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await prisma.template.findFirst({
      where: { id, isActive: true },
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Soft delete
    await prisma.template.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
};

// Set a template as default
export const setDefaultTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await prisma.template.findFirst({
      where: { id, isActive: true },
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Unset all other defaults
    await prisma.template.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    
    // Set this template as default
    const updatedTemplate = await prisma.template.update({
      where: { id },
      data: { isDefault: true },
    });

    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error setting default template:', error);
    res.status(500).json({ error: error.message });
  }
};

// Upload PPTX file and create template from it
export const uploadPPTXTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PPTX file uploaded' });
    }

    const { name, description, decorationStyle = 'geometric' } = req.body;
    
    if (!name) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Template name is required' });
    }

    // Extract template configuration from PPTX
    const templateConfig = await extractTemplateFromPPTX(req.file.path);

    // Generate template ID from name
    const templateId = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Check if template with this ID already exists
    const existingTemplate = await prisma.template.findUnique({ 
      where: { id: templateId } 
    });
    if (existingTemplate) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Template with this name already exists' });
    }

    // Create template
    const template = await prisma.template.create({
      data: {
        id: templateId,
        name,
        description: description || '',
        preview: '',
        theme: templateConfig.theme,
        decorationStyle,
        slideLayouts: templateConfig.slideLayouts,
        contentSchema: templateConfig.contentSchema,
        isDefault: false,
        isActive: true
      },
    });

    // Clean up uploaded file after processing
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      ...template,
      message: 'Template created successfully from PPTX file'
    });
  } catch (error) {
    console.error('Error uploading PPTX template:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: error.message });
  }
};
