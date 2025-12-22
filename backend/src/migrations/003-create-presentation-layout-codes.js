export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('presentation_layout_codes', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    presentation: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'template_metadata',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    layout_id: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    layout_name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    layout_code: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    fonts: {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
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

  // Add indexes
  await queryInterface.addIndex('presentation_layout_codes', ['presentation']);
  await queryInterface.addIndex('presentation_layout_codes', ['presentation', 'layout_id'], {
    unique: true,
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('presentation_layout_codes');
}

