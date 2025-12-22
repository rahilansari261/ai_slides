import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  uploadPPTXTemplate
} from '../controllers/template.controller.js';

const router = express.Router();

// Multer configuration for PPTX uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/templates';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
        path.extname(file.originalname).toLowerCase() === '.pptx') {
      cb(null, true);
    } else {
      cb(new Error('Only PPTX files are allowed'), false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Get all templates
router.get('/', getAllTemplates);

// Get a specific template by ID
router.get('/:id', getTemplateById);

// Create a new template
router.post('/', createTemplate);

// Update a template
router.put('/:id', updateTemplate);

// Delete a template
router.delete('/:id', deleteTemplate);

// Set template as default
router.post('/:id/set-default', setDefaultTemplate);

// Upload PPTX file to create template
router.post('/upload-pptx', upload.single('pptx'), uploadPPTXTemplate);

export default router;

