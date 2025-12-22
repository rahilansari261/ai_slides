'use client';

import { useState } from 'react';
import { Upload, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SlideProcessor from '@/components/custom-template/SlideProcessor';

export default function CustomTemplatePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processingData, setProcessingData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('File size exceeds 100MB limit');
        return;
      }
      if (!selectedFile.name.endsWith('.pptx') && !selectedFile.name.endsWith('.ppt')) {
        setError('Only PPTX files are allowed');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      // Append file with explicit filename to ensure backend receives it correctly
      formData.append('pptx_file', file, file.name);

      const response = await fetch('http://localhost:5002/api/custom-templates/process-pptx', {
        method: 'POST',
        // Don't set Content-Type header - browser will set it with boundary for FormData
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Extract error message from backend response
        const errorMessage = data.error || data.message || 'Failed to process PPTX file';
        throw new Error(errorMessage);
      }

      setProcessingData(data);
    } catch (err: any) {
      // If it's a network error or JSON parse error, show a generic message
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error: Could not connect to the server. Please check if the backend is running.');
      } else {
        setError(err.message || 'Failed to process file');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.size > 100 * 1024 * 1024) {
        setError('File size exceeds 100MB limit');
        return;
      }
      if (!droppedFile.name.endsWith('.pptx') && !droppedFile.name.endsWith('.ppt')) {
        setError('Only PPTX files are allowed');
        return;
      }
      setFile(droppedFile);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (processingData) {
    return (
      <SlideProcessor
        processingData={processingData}
        onBack={() => {
          setProcessingData(null);
          setFile(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-indigo-600 text-white shadow-lg">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          
          {/* <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Upload className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold">Presenton</h1>
          </div> */}

          <div className="flex items-center gap-4">
            <button className="px-4 py-2 hover:bg-indigo-700 rounded-lg transition-colors">
              Create Template
            </button>
            <button className="px-4 py-2 hover:bg-indigo-700 rounded-lg transition-colors">
              Templates
            </button>
            <button className="px-4 py-2 hover:bg-indigo-700 rounded-lg transition-colors">
              Dashboard
            </button>
            <button className="px-4 py-2 hover:bg-indigo-700 rounded-lg transition-colors">
              Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Custom Template Processor
          </h2>
          <p className="text-lg text-gray-600 mb-2">
            Upload your PDF or PPTX file to extract slides and convert them to a template
          </p>
          <p className="text-lg text-gray-600">
            which you can use to generate AI presentations.
          </p>
          <div className="mt-4 inline-block">
            <p className="text-sm text-orange-600 bg-orange-50 px-4 py-2 rounded-lg">
              AI template generation can take around 5 minutes per slide.
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-gray-700" />
            <h3 className="text-xl font-semibold text-gray-900">Upload PDF or PPTX File</h3>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Select a PDF or PowerPoint file (.pdf or .pptx) to process. Maximum file size: 100MB
          </p>

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              file
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50'
            }`}
          >
            {file ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle2 className="w-12 h-12 text-indigo-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-600">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Upload className="w-16 h-16 text-gray-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-900">
                    Click to upload a PDF or PPTX file
                  </p>
                  <p className="text-sm text-gray-500">
                    Drag and drop your file here or click to browse
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* File Input */}
          <input
            type="file"
            id="file-upload"
            accept=".pdf,.pptx,.ppt"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="mt-6">
            {file ? (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing File...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Process File
                  </>
                )}
              </button>
            ) : (
              <label
                htmlFor="file-upload"
                className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors cursor-pointer flex items-center justify-center gap-3"
              >
                <Upload className="w-5 h-5" />
                Select a PDF or PPTX file
              </label>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

