import prisma from '../config/prisma.js';

// Get default template
export const getDefaultTemplate = async () => {
  const defaultTemplate = await prisma.template.findFirst({
    where: { isDefault: true, isActive: true },
  });
  if (defaultTemplate) {
    return defaultTemplate;
  }
  // If no default, return first active template
  return prisma.template.findFirst({ where: { isActive: true } });
};

// Get template by ID with fallback to default
export const getTemplateById = async (templateId) => {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
  });
  if (template && template.isActive) {
    return template;
  }
  // Fallback to default if not found or inactive
  return getDefaultTemplate();
};

