import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/ToastContainer';
import { api } from '@/lib/api';
import { Upload, Loader2, ShieldCheck, Layers, FlaskConical, Code2, Database } from 'lucide-react';

const PIPELINE_STEPS = [
  { icon: ShieldCheck, label: 'BRD Validation & gap fixes' },
  { icon: Layers,      label: 'EPICs & User Stories' },
  { icon: FlaskConical,label: 'Functional Test cases' },
  { icon: Code2,       label: 'Gherkin BDD Scenarios' },
  { icon: Database,    label: 'Data Model & ER diagram' },
];

export const ConfigurationPage: React.FC = () => {
  const navigate     = useNavigate();
  const toast        = useToast();
  const [file,         setFile]         = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [error,        setError]        = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging,   setIsDragging]   = useState(false);

  const validateAndSetFile = (f: File) => {
    if (f.size > 15 * 1024 * 1024) {
      const msg = 'File size exceeds 15 MB limit';
      setError(msg); toast.error(msg); return;
    }
    if (!f.name.endsWith('.docx') && !f.name.endsWith('.txt')) {
      const msg = 'Only .docx and .txt files are supported';
      setError(msg); toast.error(msg); return;
    }
    setFile(f);
    setError(null);
    toast.success(`"${f.name}" selected`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSetFile(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      const msg = 'Please upload a BRD file';
      setError(msg); toast.error(msg); return;
    }
    setIsSubmitting(true);
    toast.info('Uploading and validating BRD…');
    try {
      const result = await api.validateBRD(file, {
        instructions,
        artefacts: {
          epics_and_stories: true,
          functional_tests:  true,
          gherkin_tests:     true,
          data_model:        true,
        },
      });
      toast.success('BRD validation complete!');
      navigate(`/validation/${result.job_id}`, {
        state: { validation: result.validation_report, gapFixes: result.gap_fixes },
      });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Validation failed');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-4 py-16">

        {/* Hero header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-5">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-neutral-900 mb-3">SpecPilot</h1>
          <p className="text-neutral-500 text-lg max-w-sm mx-auto leading-relaxed">
            Transform your BRD into structured specifications, tests, and data models
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">

            {/* File upload */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">
                BRD Document
              </label>
              <label
                htmlFor="brd-file"
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-3 px-6 py-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-50'
                    : file
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-neutral-300 bg-neutral-50 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                <div className={`rounded-full p-3 ${file ? 'bg-emerald-100' : 'bg-neutral-100'}`}>
                  <Upload className={`w-6 h-6 ${file ? 'text-emerald-600' : 'text-neutral-400'}`} />
                </div>
                {file ? (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
                    <p className="text-xs text-emerald-500 mt-0.5">
                      {(file.size / 1024).toFixed(0)} KB · Click to replace
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-neutral-600">
                      Drop your file here, or <span className="text-indigo-600">browse</span>
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">.DOCX or .TXT · max 15 MB</p>
                  </div>
                )}
                <input
                  id="brd-file"
                  type="file"
                  className="sr-only"
                  accept=".docx,.txt"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {/* Special Instructions */}
            <div>
              <label
                htmlFor="instructions"
                className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2"
              >
                Special Instructions <span className="normal-case font-normal">(optional)</span>
              </label>
              <Textarea
                id="instructions"
                rows={3}
                placeholder="e.g. Focus on the checkout flow, use microservices architecture…"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Pipeline steps */}
            <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">
                What gets generated
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PIPELINE_STEPS.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 text-sm text-neutral-600">
                    <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!file || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Validating BRD…</>
              ) : (
                'Validate & Generate'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
