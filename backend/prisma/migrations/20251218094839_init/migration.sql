-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "preview" TEXT DEFAULT '',
    "theme" JSONB NOT NULL DEFAULT '{"primaryColor":"#8b5cf6","secondaryColor":"#a78bfa","backgroundColor":"#0f172a","textColor":"#f8fafc","fontFamily":"Arial"}',
    "decorationStyle" TEXT NOT NULL DEFAULT 'geometric',
    "slideLayouts" JSONB NOT NULL DEFAULT '[]',
    "contentSchema" JSONB NOT NULL DEFAULT '{}',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_metadata" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_layout_codes" (
    "id" SERIAL NOT NULL,
    "presentation" TEXT NOT NULL,
    "layout_id" TEXT NOT NULL,
    "layout_name" TEXT NOT NULL,
    "layout_code" TEXT NOT NULL,
    "fonts" JSONB DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_layout_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presentation_layout_codes_presentation_idx" ON "presentation_layout_codes"("presentation");

-- CreateIndex
CREATE UNIQUE INDEX "presentation_layout_codes_presentation_layout_id_key" ON "presentation_layout_codes"("presentation", "layout_id");

-- AddForeignKey
ALTER TABLE "presentation_layout_codes" ADD CONSTRAINT "presentation_layout_codes_presentation_fkey" FOREIGN KEY ("presentation") REFERENCES "template_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
