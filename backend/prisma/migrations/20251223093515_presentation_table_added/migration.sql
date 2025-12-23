/*
  Warnings:

  - You are about to drop the `templates` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "templates";

-- CreateTable
CREATE TABLE "presentations" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "n_slides" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT,
    "file_paths" JSONB,
    "outlines" JSONB,
    "layout" JSONB,
    "structure" JSONB,
    "instructions" TEXT,
    "tone" TEXT,
    "verbosity" TEXT,
    "include_table_of_contents" BOOLEAN NOT NULL DEFAULT false,
    "include_title_slide" BOOLEAN NOT NULL DEFAULT true,
    "web_search" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slides" (
    "id" TEXT NOT NULL,
    "presentation" TEXT NOT NULL,
    "layout_group" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "speaker_note" TEXT,
    "content" JSONB NOT NULL,
    "html_content" TEXT,
    "properties" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slides_presentation_idx" ON "slides"("presentation");

-- AddForeignKey
ALTER TABLE "slides" ADD CONSTRAINT "slides_presentation_fkey" FOREIGN KEY ("presentation") REFERENCES "presentations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
