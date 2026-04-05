import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/ToastContainer';
import { api } from '@/lib/api';
import { Upload, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export const ConfigurationPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 15 * 1024 * 1024) {
        const errorMsg = 'File size exceeds 15MB limit';
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }
      if (!selectedFile.name.endsWith('.docx') && !selectedFile.name.endsWith('.txt')) {
        const errorMsg = 'Only .docx and .txt files are supported';
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }
      setFile(selectedFile);
      setError(null);
      toast.success(`File "${selectedFile.name}" selected successfully`);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      const errorMsg = 'Please upload a BRD file';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setIsSubmitting(true);
    toast.info('Uploading and validating BRD...');

    try {
      // Call validation API with all artefacts enabled by default
      const result = await api.validateBRD(file, {
        instructions,
        artefacts: {
          epics_and_stories: true,
          functional_tests: true,
          gherkin_tests: true,
          data_model: true,
        }
      });

      toast.success('BRD validation complete!');

      // Navigate to validation page with results
      navigate(`/validation/${result.job_id}`, {
        state: {
          validation: result.validation_report,
          gapFixes: result.gap_fixes
        }
      });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Validation failed');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Project Generator</h1>
          <p className="text-gray-600">Transform your BRD into structured specifications</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload BRD Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BRD Document
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary/90">
                      <span>Upload a file</span>
                      <input
                        type="file"
                        className="sr-only"
                        accept=".docx,.txt"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">.DOCX or .TXT up to 15MB</p>
                  {file && (
                    <p className="text-sm text-green-600 font-medium mt-2">{file.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Special Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Instructions (Optional)
              </label>
              <textarea
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Add any specific instructions for the generation process..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

            {/* Pipeline Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Generation Pipeline</h3>
              <p className="text-sm text-blue-800 mb-3">
                The system will generate all artifacts through a staged pipeline:
              </p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>EPICs & User Stories</li>
                <li>Functional Tests</li>
                <li>Gherkin BDD Scenarios</li>
                <li>Data Model & Diagrams</li>
              </ul>
            </div>

            {/* BRD Guidelines */}
            <div className="border border-amber-200 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                onClick={() => setGuidelinesOpen(o => !o)}
              >
                <span className="text-sm font-semibold text-amber-900">BRD Formatting Guidelines</span>
                {guidelinesOpen
                  ? <ChevronUp className="w-4 h-4 text-amber-700 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-amber-700 shrink-0" />
                }
              </button>
              {guidelinesOpen && (
                <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 space-y-3 text-sm text-amber-900">
                  <p className="font-medium">Following these guidelines improves generation quality:</p>

                  <div>
                    <p className="font-semibold mb-1">Structure</p>
                    <ul className="list-disc list-inside space-y-1 text-amber-800">
                      <li><span className="font-medium">.docx:</span> Apply Word Heading styles (H1/H2/H3) — do not use bold text as headings</li>
                      <li><span className="font-medium">.txt:</span> Use numbered sections — <code className="bg-amber-100 px-1 rounded">1.</code>, <code className="bg-amber-100 px-1 rounded">1.1.</code>, <code className="bg-amber-100 px-1 rounded">1.1.1.</code></li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">Recommended sections</p>
                    <ul className="list-disc list-inside space-y-1 text-amber-800">
                      <li>Project Overview</li>
                      <li>Business Objectives</li>
                      <li>Functional Requirements</li>
                      <li>Non-Functional Requirements</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">Tables</p>
                    <ul className="list-disc list-inside space-y-1 text-amber-800">
                      <li>First row must be column headers</li>
                      <li>Put field constraints and validation rules in tables, not prose — the data model and test generation specifically pull from them</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">Content</p>
                    <ul className="list-disc list-inside space-y-1 text-amber-800">
                      <li>Keep paragraphs focused — one requirement or idea per paragraph</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Validate & Generate Button */}
            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={!file || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating BRD...
                  </>
                ) : (
                  'Validate & Generate'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
