import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, ArrowRight, Database } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardInset } from '@/components/ui/Card';
import { StageProgressIndicator } from '@/components/StageProgressIndicator';
import { api } from '@/lib/api';
import type { StatusResponse } from '@/types';

export const DataModelPage: React.FC = () => {
  const { jobId }   = useParams<{ jobId: string }>();
  const navigate    = useNavigate();
  const [status,    setStatus]    = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [jobId]);

  const fetchStatus = async () => {
    if (!jobId) return;
    try {
      const data = await api.getStatus(jobId);
      setStatus(data);
      setIsLoading(false);
      const stageRunning = data.stage_history.some(s => s.status === 'running');
      if (!stageRunning && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-neutral-600 text-sm">Loading data model…</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-500">Data not available</p>
      </div>
    );
  }

  const { results } = status;
  const isGenerating = status.current_stage === 'data_model' &&
    status.stage_history.some(s => s.stage === 'data_model' && s.status === 'running');

  return (
    <div className="min-h-screen bg-neutral-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">

        <div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-1">Data Model &amp; Entities</h1>
          <p className="text-neutral-500 text-sm">Review your generated data model and entity relationships</p>
        </div>

        <StageProgressIndicator
          currentStage={status.current_stage || 'data_model'}
          stageHistory={status.stage_history}
        />

        {/* Stats */}
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-neutral-500 mb-1">Total Entities</p>
            <p className="text-3xl font-bold text-violet-600">{results.entities.length}</p>
          </CardContent>
        </Card>

        {/* Generating banner */}
        {isGenerating && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
            <p className="text-sm text-indigo-800">Generating data model…</p>
          </div>
        )}

        {/* Entities */}
        <div className="space-y-4">
          {results.entities.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-14 text-center">
              <Database className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="font-medium text-neutral-500">No entities generated yet</p>
              <p className="text-sm text-neutral-400 mt-1">Results will appear here once generation completes</p>
            </div>
          ) : (
            results.entities.map(entity => (
              <Card key={entity.name}>
                <CardHeader>
                  <CardTitle>{entity.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-500 mb-4">{entity.description}</p>
                  <div className="overflow-x-auto rounded-lg border border-neutral-100">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-100">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Field</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Type</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Required</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 bg-white">
                        {entity.fields.map((field, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-xs text-neutral-800">{field.name}</td>
                            <td className="px-4 py-2.5 text-xs text-neutral-500">{field.type}</td>
                            <td className="px-4 py-2.5 text-xs">
                              {field.required
                                ? <span className="text-emerald-600 font-medium">Yes</span>
                                : <span className="text-neutral-400">No</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Mermaid diagram */}
        {results.mermaid && (
          <Card>
            <CardHeader>
              <CardTitle>Entity Relationship Diagram</CardTitle>
            </CardHeader>
            <CardContent>
              <CardInset className="font-mono text-xs text-neutral-700 overflow-x-auto whitespace-pre leading-relaxed">
                {results.mermaid}
              </CardInset>
              <p className="text-xs text-neutral-400 mt-2">
                Copy this Mermaid code into the{' '}
                <span className="font-medium">Mermaid Live Editor</span> to visualize the ER diagram
              </p>
            </CardContent>
          </Card>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-neutral-200 shadow-card px-5 py-4">
          <Button variant="secondary" onClick={() => navigate(`/gherkin-tests/${jobId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Gherkin Tests
          </Button>
          <Button
            onClick={() => navigate(`/summary/${jobId}`)}
            disabled={results.entities.length === 0 || isGenerating}
          >
            Continue to Summary
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};
