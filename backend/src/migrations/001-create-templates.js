export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('templates', {
    id: {
      type: Sequelize.STRING,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
      defaultValue: '',
    },
    preview: {
      type: Sequelize.STRING,
      defaultValue: '',
    },
    theme: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        primaryColor: '#8b5cf6',
        secondaryColor: '#a78bfa',
        backgroundColor: '#0f172a',
        textColor: '#f8fafc',
        fontFamily: 'Arial',
      },
    },
    decoration_style: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'geometric',
    },
    slide_layouts: {
      type: Sequelize.JSONB,
      defaultValue: [],
    },
    content_schema: {
      type: Sequelize.JSONB,
      defaultValue: {},
    },
    is_default: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('templates');
}

