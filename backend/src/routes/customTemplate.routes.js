import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import {
  uploadCustomTemplate,
  processPPTX,
  slideToHTML,
  htmlToReact,
  saveLayouts,
  saveTemplate,
  getLayouts,
  getAllTemplates,
} from '../controllers/customTemplate.controller.js';

const router = express.Router();

// Multer configuration for PPTX uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/custom_templates';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      path.extname(file.originalname).toLowerCase() === '.pptx'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PPTX files are allowed'), false);
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Single end-to-end API: upload PPTX, process slides, generate layouts, and save template
router.post('/upload-template', upload.single('pptx_file'), uploadCustomTemplate);

// Process PPTX file - extract XMLs, generate screenshots, analyze fonts
router.post('/process-pptx', upload.single('pptx_file'), processPPTX);

// Convert slide to HTML using AI
router.post('/slide-to-html', slideToHTML);

// Convert HTML to React component using AI
router.post('/html-to-react', htmlToReact);

// Save layouts to database
router.post('/save-layouts', saveLayouts);

// Save template metadata
router.post('/save-template', saveTemplate);

// Get layouts for a template
router.get('/layouts/:presentationId', getLayouts);

// Get all custom templates
router.get('/templates', getAllTemplates);

export default router;

