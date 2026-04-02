import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2, Download, CheckCircle2, Home, FileText,
  TestTube, Database, PartyPopper,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StageProgressIndicator } from '@/components/StageProgressIndicator';
import { useToast } from '@/components/ui/ToastContainer';
import { api } from '@/lib/api';
import type { StatusResponse, CoverageReport } from '@/types';

export const SummaryPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate  = useNavigate();
  const toast     = useToast();

  const [status,      setStatus]      = useState<StatusResponse | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [coverage,    setCoverage]    = useState<CoverageReport | null>(null);
  const [traceFilter, setTraceFilter] = useState<'all' | 'uncovered' | 'table_derived'>('all');

  useEffect(() => { fetchStatus(); }, [jobId]);

  const fetchStatus = async () => {
    if (!jobId) return;
    try {
      const data = await api.getStatus(jobId);
      setStatus(data);
      setIsLoading(false);
      try { setCoverage(await api.getCoverage(jobId)); } catch { /* non-blocking */ }
    } catch {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!jobId) return;
    window.open(api.getDownloadUrl(jobId), '_blank');
    toast.success('Download started!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-neutral-600 text-sm">Loading summary…</p>
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

  const coveragePct = coverage ? Math.round(coverage.coverage_pct) : 0;
  const coverageColor =
    coveragePct === 100 ? 'text-emerald-600' :
    coveragePct >= 70   ? 'text-amber-500'   : 'text-red-500';

  const metrics: {
    label: string; count: number; suffix?: string;
    icon: React.ElementType; colorClass: string; bgClass: string; description: string;
  }[] = [
    { label: 'EPICs',              count: results.epics.length,            icon: FileText,     colorClass: 'text-indigo-600',  bgClass: 'bg-indigo-50',  description: 'High-level feature groupings' },
    { label: 'User Stories',       count: results.user_stories.length,     icon: FileText,     colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', description: 'Detailed user requirements' },
    { label: 'Functional Tests',   count: results.functional_tests.length, icon: TestTube,     colorClass: 'text-violet-600',  bgClass: 'bg-violet-50',  description: 'Manual test scenarios' },
    { label: 'Gherkin Scenarios',  count: results.gherkin_tests.length,    icon: TestTube,     colorClass: 'text-sky-600',     bgClass: 'bg-sky-50',     description: 'BDD test scenarios' },
    { label: 'Data Entities',      count: results.entities.length,         icon: Database,     colorClass: 'text-rose-600',    bgClass: 'bg-rose-50',    description: 'Data model entities' },
    { label: 'Atomic Requirements',count: results.atomic_requirements.length, icon: FileText,  colorClass: 'text-orange-600',  bgClass: 'bg-orange-50',  description: 'Extracted from requirement map' },
    { label: 'Req Coverage',       count: coveragePct, suffix: '%',        icon: CheckCircle2, colorClass: coverageColor,      bgClass: 'bg-neutral-50', description: `${coverage?.covered_req_ids.length ?? 0} of ${coverage?.total ?? 0} covered` },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">

        <div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-1">Generation Complete</h1>
          <p className="text-neutral-500 text-sm">All artifacts for {results.project_name}</p>
        </div>

        <StageProgressIndicator
          currentStage={status.current_stage || 'completed'}
          stageHistory={status.stage_history}
        />

        {/* Completion banner */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-4">
          <div className="bg-emerald-500 rounded-full p-2.5 shrink-0">
            <PartyPopper className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-semibold text-emerald-900">All done!</p>
            <p className="text-sm text-emerald-700 mt-0.5">
              Successfully generated {metrics.reduce((s, m) => s + m.count, 0)} artifacts across all pipeline stages
            </p>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {metrics.map(m => {
            const Icon = m.icon;
            return (
              <Card key={m.label}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-neutral-500 mb-1">{m.label}</p>
                      <p className={`text-3xl font-bold tabular-nums ${m.colorClass}`}>
                        {m.count}{m.suffix ?? ''}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1 leading-snug">{m.description}</p>
                    </div>
                    <div className={`rounded-lg p-2 shrink-0 ${m.bgClass}`}>
                      <Icon className={`w-5 h-5 ${m.colorClass}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Project Details */}
        <Card>
          <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-1">Project Name</p>
                <p className="text-base font-semibold text-neutral-900">{results.project_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-1">Job ID</p>
                <p className="text-sm font-mono text-neutral-600 break-all">{jobId}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-1">Status</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> Completed
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Traceability Matrix */}
        {results.atomic_requirements.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Requirement Traceability Matrix</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                {(['all', 'uncovered', 'table_derived'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTraceFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      traceFilter === f
                        ? 'bg-indigo-600 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'uncovered' ? 'Uncovered' : 'Table-Derived'}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto rounded-lg border border-neutral-100">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-100">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase w-24">Req ID</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase">Requirement</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase w-28">Type</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase w-40">Linked Stories</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {results.atomic_requirements
                      .filter(req => {
                        if (traceFilter === 'uncovered')    return !coverage?.covered_req_ids.includes(req.id);
                        if (traceFilter === 'table_derived') return req.derived_from_table;
                        return true;
                      })
                      .map(req => {
                        const linked   = results.user_stories.filter(s => s.atomic_requirement_ids?.includes(req.id));
                        const isCovered = coverage?.covered_req_ids.includes(req.id) ?? linked.length > 0;
                        return (
                          <tr key={req.id} className={isCovered ? 'hover:bg-neutral-50' : 'bg-red-50 hover:bg-red-100'}>
                            <td className="px-3 py-2.5 font-mono text-xs text-neutral-600">{req.id}</td>
                            <td className="px-3 py-2.5 text-neutral-800">{req.text}</td>
                            <td className="px-3 py-2.5">
                              <span className="px-1.5 py-0.5 text-xs rounded bg-neutral-100 text-neutral-600">{req.type}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              {linked.length > 0
                                ? <div className="flex flex-col gap-0.5">{linked.map(s => <span key={s.id} className="text-xs text-indigo-700">{s.title}</span>)}</div>
                                : <span className="text-xs text-neutral-400">None</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              {isCovered
                                ? <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700">Covered</span>
                                : <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600">Uncovered</span>}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center pb-8">
          <Button variant="primary" size="lg" onClick={handleDownload} className="px-8">
            <Download className="w-5 h-5 mr-2" />
            Download Complete ZIP
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate('/')} className="px-8">
            <Home className="w-5 h-5 mr-2" />
            Start New Project
          </Button>
        </div>
      </div>
    </div>
  );
};
