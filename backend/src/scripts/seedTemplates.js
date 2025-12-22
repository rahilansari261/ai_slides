import { config } from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import prisma from '../config/prisma.js';
import { TEMPLATES } from '../templates/index.js';

config();

const seedTemplates = async () => {
  try {
    await connectDatabase();
    
    console.log('🌱 Seeding templates...');
    
    // Clear existing templates (optional - comment out if you want to keep existing)
    // await prisma.template.deleteMany({});
    
    let created = 0;
    let skipped = 0;
    
    for (const [key, templateData] of Object.entries(TEMPLATES)) {
      // Check if template already exists
      const existing = await prisma.template.findUnique({ 
        where: { id: templateData.id } 
      });
      
      if (existing) {
        console.log(`⏭️  Template '${templateData.id}' already exists, skipping...`);
        skipped++;
        continue;
      }
      
      // Create template from existing data
      const template = await prisma.template.create({
        data: {
          id: templateData.id,
          name: templateData.name,
          description: templateData.description || '',
          preview: templateData.preview || '',
          theme: templateData.theme,
          decorationStyle: templateData.decorationStyle,
          slideLayouts: [],
          contentSchema: {},
          isDefault: templateData.id === 'modern_dark', // Set modern_dark as default
          isActive: true
        },
      });
      console.log(`✅ Created template: ${templateData.name} (${templateData.id})`);
      created++;
    }
    
    console.log(`\n✨ Seeding complete! Created: ${created}, Skipped: ${skipped}`);
    
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    await disconnectDatabase();
    process.exit(1);
  }
};

seedTemplates();




