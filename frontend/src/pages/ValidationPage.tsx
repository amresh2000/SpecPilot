import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardInset } from '../components/ui/Card';
import { Textarea } from '../components/ui/Textarea';
import { useToast } from '../components/ui/ToastContainer';
import { api } from '../lib/api';
import type { ValidationReport, GapFix } from '../types';

export const ValidationPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate  = useNavigate();
  const location  = useLocation();
  const toast     = useToast();

  const [isLoading,    setIsLoading]    = useState(true);
  const [validation,   setValidation]   = useState<ValidationReport | null>(null);
  const [gapFixes,     setGapFixes]     = useState<GapFix[]>([]);
  const [isProceeding, setIsProceeding] = useState(false);
  const [loadingGapId, setLoadingGapId] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.validation && location.state?.gapFixes) {
      setValidation(location.state.validation);
      setGapFixes(location.state.gapFixes);
      setIsLoading(false);
    } else if (jobId) {
      fetchValidationData();
    }
  }, [jobId, location.state]);

  const fetchValidationData = async () => {
    try {
      const status = await api.getStatus(jobId!);
      if (status.results.validation_report && status.results.gap_fixes) {
        setValidation(status.results.validation_report);
        setGapFixes(status.results.gap_fixes);
      }
    } catch {
      toast.error('Failed to load validation data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateGapFix = async (gapId: string, action: string, finalText?: string) => {
    setLoadingGapId(gapId);
    try {
      await api.updateGapFix(jobId!, gapId, action, finalText);
      setGapFixes(prev =>
        prev.map(gf => gf.gap_id === gapId ? { ...gf, user_action: action, final_text: finalText } : gf)
      );
      if (action === 'accepted')      toast.success('Fix accepted');
      else if (action === 'edited')   toast.success('Edited fix accepted');
      else if (action === 'rejected') toast.info('Fix rejected');
    } catch {
      toast.error('Failed to update gap fix');
    } finally {
      setLoadingGapId(null);
    }
  };

  const handleProceedToGeneration = async () => {
    const reviewedCount = gapFixes.filter(gf => gf.user_action && gf.user_action !== 'pending').length;
    if (reviewedCount === 0) {
      toast.warning('Please review at least one gap before proceeding');
      return;
    }
    setIsProceeding(true);
    try {
      await api.proceedToStage(jobId!, 'requirement_map');
      toast.success('Building requirement map...');
      navigate(`/requirement-map/${jobId}`);
    } catch {
      toast.error('Failed to start generation');
      setIsProceeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-neutral-600 text-sm">Loading validation report…</p>
        </div>
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500 mb-4">Validation data not available</p>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const scoreColor = (s: number) =>
    s >= 4 ? 'text-emerald-600' : s >= 3 ? 'text-amber-500' : 'text-red-500';

  const scoreBg = (s: number) =>
    s >= 4
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : s >= 3
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-red-50 border-red-200 text-red-600';

  const reviewedCount = gapFixes.filter(gf => gf.user_action && gf.user_action !== 'pending').length;
  const acceptedCount = gapFixes.filter(gf => gf.user_action === 'accepted' || gf.user_action === 'edited').length;
  const rejectedCount = gapFixes.filter(gf => gf.user_action === 'rejected').length;

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-1">BRD Quality Validation</h1>
          <p className="text-neutral-500 text-sm">Review identified gaps and AI-suggested fixes before proceeding</p>
        </div>

        {/* ── Overall Score ── */}
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              Overall Quality Score
            </h2>
            <div className="flex items-center gap-6">
              <div className="text-center shrink-0">
                <div className={`text-6xl font-bold tabular-nums ${scoreColor(validation.overall_score)}`}>
                  {validation.overall_score.toFixed(1)}
                </div>
                <div className="text-neutral-400 text-xs mt-1">out of 5.0</div>
              </div>
              <div className="flex-1">
                <div className="w-full bg-neutral-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      validation.overall_score >= 3.5
                        ? 'bg-emerald-500'
                        : validation.overall_score >= 2.5
                        ? 'bg-amber-400'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${(validation.overall_score / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-400 mt-2">
                  {validation.overall_score >= 3.5
                    ? 'Good quality — minor improvements suggested'
                    : validation.overall_score >= 2.5
                    ? 'Moderate quality — review gaps carefully'
                    : 'Low quality — significant gaps detected'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── CTQ Scores ── */}
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              Critical-to-Quality Dimensions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {Object.entries(validation.ctq_scores).map(([ctq, score]) => (
                <div key={ctq} className="text-center">
                  <div className={`px-2 py-1.5 rounded-lg border text-sm font-bold ${scoreBg(score)}`}>
                    {score}<span className="text-xs font-normal opacity-60">/5</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1.5 capitalize leading-tight">
                    {ctq.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Gap Fixes ── */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                Identified Gaps
                <span className="ml-2 text-neutral-400 font-normal">({gapFixes.length})</span>
              </h2>
              <span className="text-xs text-neutral-500">
                {reviewedCount}/{gapFixes.length} reviewed
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden mb-2">
              <div className="flex h-full">
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(acceptedCount / Math.max(gapFixes.length, 1)) * 100}%` }}
                />
                <div
                  className="bg-red-400 transition-all duration-300"
                  style={{ width: `${(rejectedCount / Math.max(gapFixes.length, 1)) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex gap-4 text-xs text-neutral-500 mb-5">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                {acceptedCount} accepted
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                {rejectedCount} rejected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neutral-300 inline-block" />
                {gapFixes.length - reviewedCount} pending
              </span>
            </div>

            {gapFixes.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                <p className="font-medium text-neutral-700">No significant gaps found</p>
                <p className="text-sm text-neutral-400 mt-1">Your BRD looks complete</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gapFixes.map(gap => (
                  <GapFixPanel
                    key={gap.gap_id}
                    gap={gap}
                    onUpdate={handleUpdateGapFix}
                    isLoading={loadingGapId === gap.gap_id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Actions ── */}
        <div className="flex gap-3 pb-8">
          <Button variant="secondary" onClick={() => navigate('/')} disabled={isProceeding}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Upload
          </Button>
          <Button onClick={handleProceedToGeneration} disabled={isProceeding} className="flex-1">
            {isProceeding ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting…</>
            ) : (
              <><ArrowRight className="w-4 h-4 mr-2" />Approve Fixes & Build Requirement Map ({acceptedCount} accepted)</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Gap Fix Panel ──────────────────────────────────────────────────────────────

const GapFixPanel: React.FC<{
  gap: GapFix;
  onUpdate: (gapId: string, action: string, finalText?: string) => void;
  isLoading?: boolean;
}> = ({ gap, onUpdate, isLoading = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedFix,  setEditedFix]  = useState(gap.suggested_fix);
  const [isEditing,  setIsEditing]  = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const statusBadge = () => {
    if (!gap.user_action || gap.user_action === 'pending')
      return <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-xs rounded-full">Pending</span>;
    if (gap.user_action === 'accepted')
      return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">Accepted</span>;
    if (gap.user_action === 'edited')
      return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">Accepted (edited)</span>;
    if (gap.user_action === 'rejected')
      return <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">Rejected</span>;
  };

  const confidenceColor =
    gap.confidence === 'high'   ? 'text-emerald-600' :
    gap.confidence === 'medium' ? 'text-amber-500'   : 'text-red-500';

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setIsExpanded(v => !v)}
        aria-expanded={isExpanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {statusBadge()}
            <span className="text-xs text-neutral-400">{gap.affected_section}</span>
          </div>
          <p className="text-sm font-medium text-amber-900 leading-snug">{gap.gap_description}</p>
          {gap.current_text && (
            <p className="text-xs text-neutral-500 mt-1 truncate">
              Current: "{gap.current_text}"
            </p>
          )}
        </div>
        <span className="shrink-0 text-amber-600 mt-0.5">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t border-amber-200 bg-white px-4 py-4 space-y-4 animate-fade-in">
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              AI Suggested Fix
            </p>
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                rows={8}
                value={editedFix}
                onChange={e => setEditedFix(e.target.value)}
                autoFocus
              />
            ) : (
              <CardInset>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{gap.suggested_fix}</p>
              </CardInset>
            )}
            <div className="flex gap-4 mt-2 text-xs text-neutral-400">
              <span>Rationale: {gap.rationale}</span>
              <span className={confidenceColor}>Confidence: {gap.confidence}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {!isEditing ? (
              <>
                <Button onClick={() => onUpdate(gap.gap_id, 'accepted')} variant="success" size="sm" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Accept
                </Button>
                <Button onClick={() => { setIsEditing(true); setTimeout(() => textareaRef.current?.focus(), 50); }} variant="outline" size="sm" disabled={isLoading}>
                  Edit & Accept
                </Button>
                <Button onClick={() => onUpdate(gap.gap_id, 'rejected')} variant="danger" size="sm" disabled={isLoading}>
                  Reject
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => { onUpdate(gap.gap_id, 'edited', editedFix); setIsEditing(false); }} variant="success" size="sm" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Save & Accept
                </Button>
                <Button onClick={() => { setEditedFix(gap.suggested_fix); setIsEditing(false); }} variant="secondary" size="sm" disabled={isLoading}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
