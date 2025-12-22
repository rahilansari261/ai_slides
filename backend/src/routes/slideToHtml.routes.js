import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  convertSlideToHtml,
  convertHtmlToReact,
  editHtmlWithImages
} from '../controllers/slideToHtml.controller.js';
import { getImagesDirectory } from '../utils/storage.js';

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ENDPOINT 1: Slide to HTML conversion
// POST /api/slide-to-html/
router.post('/', convertSlideToHtml);

// ENDPOINT 2: HTML to React component conversion
// POST /api/html-to-react/
router.post('/html-to-react', convertHtmlToReact);

// ENDPOINT 3: HTML editing with images
// POST /api/html-edit/
router.post('/html-edit', upload.fields([
  { name: 'current_ui_image', maxCount: 1 },
  { name: 'sketch_image', maxCount: 1 }
]), editHtmlWithImages);

export default router;

