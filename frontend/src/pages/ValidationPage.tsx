import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/ToastContainer';
import { api } from '../lib/api';

interface CTQScore {
  score: number;
  findings: string[];
  recommendations: string[];
}

interface ValidationReport {
  ctq_scores: Record<string, number>;
  overall_score: number;
  key_gaps: string[];
  remediation_actions: string[];
  detailed_findings: Record<string, CTQScore>;
}

interface GapFix {
  gap_id: string;
  gap_description: string;
  affected_section: string;
  current_text: string;
  suggested_fix: string;
  rationale: string;
  confidence: string;
  user_action?: string;
  final_text?: string;
}

export const ValidationPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [gapFixes, setGapFixes] = useState<GapFix[]>([]);
  const [isProceeding, setIsProceeding] = useState(false);
  const [loadingGapId, setLoadingGapId] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have data from navigation state
    if (location.state?.validation && location.state?.gapFixes) {
      setValidation(location.state.validation);
      setGapFixes(location.state.gapFixes);
      setIsLoading(false);
    } else if (jobId) {
      // Fetch validation data from API
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
    } catch (error) {
      toast.error('Failed to load validation data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateGapFix = async (gapId: string, action: string, finalText?: string) => {
    setLoadingGapId(gapId);
    try {
      await api.updateGapFix(jobId!, gapId, action, finalText);

      // Update local state
      setGapFixes(prev =>
        prev.map(gf =>
          gf.gap_id === gapId
            ? { ...gf, user_action: action, final_text: finalText }
            : gf
        )
      );

      if (action === 'accepted') {
        toast.success('✓ Fix accepted');
      } else if (action === 'edited') {
        toast.success('✓ Edited fix accepted');
      } else if (action === 'rejected') {
        toast.info('Fix rejected');
      }
    } catch (error) {
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
      await api.proceedToGeneration(jobId!);
      toast.success('Generation started!');
      navigate(`/progress/${jobId}`);
    } catch (error) {
      toast.error('Failed to start generation');
      setIsProceeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading validation report...</p>
        </div>
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Validation data not available</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600 bg-green-100 border-green-200';
    if (score >= 3) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const reviewedCount = gapFixes.filter(gf => gf.user_action && gf.user_action !== 'pending').length;
  const acceptedCount = gapFixes.filter(gf => gf.user_action === 'accepted' || gf.user_action === 'edited').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">BRD Quality Validation</h1>
          <p className="text-gray-600">Review identified gaps and AI-suggested fixes</p>
        </div>

        {/* Overall Score */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Overall Quality Score</h2>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={`text-5xl font-bold ${validation.overall_score >= 3.5 ? 'text-green-600' : validation.overall_score >= 2.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                {validation.overall_score.toFixed(1)}
              </div>
              <div className="text-gray-500 text-sm">out of 5.0</div>
            </div>
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${validation.overall_score >= 3.5 ? 'bg-green-500' : validation.overall_score >= 2.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${(validation.overall_score / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CTQ Scores Grid */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Critical-to-Quality Dimensions</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(validation.ctq_scores).map(([ctq, score]) => (
              <div key={ctq} className="text-center">
                <div className={`px-3 py-2 rounded-lg border font-semibold ${getScoreColor(score)}`}>
                  {score}/5
                </div>
                <div className="text-sm text-gray-600 mt-2 capitalize">
                  {ctq.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gap Fixes */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">Identified Gaps ({gapFixes.length})</h2>
              <div className="text-sm font-medium text-gray-700">
                {reviewedCount}/{gapFixes.length} Reviewed
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="flex h-full">
                  {/* Accepted (Green) */}
                  <div
                    className="bg-green-500 transition-all duration-300"
                    style={{ width: `${(acceptedCount / gapFixes.length) * 100}%` }}
                  />
                  {/* Rejected (Red) */}
                  <div
                    className="bg-red-500 transition-all duration-300"
                    style={{ width: `${(gapFixes.filter(gf => gf.user_action === 'rejected').length / gapFixes.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  {acceptedCount} Accepted
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  {gapFixes.filter(gf => gf.user_action === 'rejected').length} Rejected
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                  {gapFixes.length - reviewedCount} Pending
                </span>
              </div>
            </div>
          </div>

          {gapFixes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>No significant gaps identified! Your BRD looks good.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {gapFixes.map((gap) => (
                <GapFixPanel
                  key={gap.gap_id}
                  gap={gap}
                  onUpdate={handleUpdateGapFix}
                  isLoading={loadingGapId === gap.gap_id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/')}
            disabled={isProceeding}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Upload
          </Button>
          <Button
            onClick={handleProceedToGeneration}
            disabled={isProceeding}
            className="flex-1"
          >
            {isProceeding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Generation...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                Proceed to Generation ({acceptedCount} fixes accepted)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Gap Fix Panel Component
const GapFixPanel: React.FC<{
  gap: GapFix;
  onUpdate: (gapId: string, action: string, finalText?: string) => void;
  isLoading?: boolean;
}> = ({ gap, onUpdate, isLoading = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedFix, setEditedFix] = useState(gap.suggested_fix);
  const [isEditing, setIsEditing] = useState(false);

  const getActionBadge = () => {
    if (!gap.user_action || gap.user_action === 'pending') {
      return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Pending Review</span>;
    }
    if (gap.user_action === 'accepted') {
      return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">✓ Accepted</span>;
    }
    if (gap.user_action === 'edited') {
      return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">✓ Accepted (Edited)</span>;
    }
    if (gap.user_action === 'rejected') {
      return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">✗ Rejected</span>;
    }
  };

  const handleAccept = () => {
    onUpdate(gap.gap_id, 'accepted');
  };

  const handleAcceptEdited = () => {
    onUpdate(gap.gap_id, 'edited', editedFix);
    setIsEditing(false);
  };

  const handleReject = () => {
    onUpdate(gap.gap_id, 'rejected');
  };

  return (
    <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4 rounded">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-yellow-800">⚠️ {gap.gap_description}</h4>
            {getActionBadge()}
          </div>
          <p className="text-sm text-gray-600 mb-2">
            <strong>Section:</strong> {gap.affected_section}
          </p>
          {gap.current_text && (
            <p className="text-sm text-gray-600 mb-2">
              <strong>Current:</strong> "{gap.current_text}"
            </p>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-yellow-700 hover:text-yellow-900 font-bold text-xl"
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              AI Suggested Fix:
            </label>
            {isEditing ? (
              <textarea
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                rows={8}
                value={editedFix}
                onChange={(e) => setEditedFix(e.target.value)}
              />
            ) : (
              <div className="bg-white p-4 rounded-lg border whitespace-pre-wrap">
                {gap.suggested_fix}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              💡 <strong>Rationale:</strong> {gap.rationale}
            </p>
            <p className="text-xs text-gray-500">
              🎯 <strong>Confidence:</strong> {gap.confidence}
            </p>
          </div>

          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button onClick={handleAccept} variant="success" size="sm" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    '✓ Accept'
                  )}
                </Button>
                <Button onClick={() => setIsEditing(true)} variant="primary" size="sm" disabled={isLoading}>
                  ✏️ Edit & Accept
                </Button>
                <Button onClick={handleReject} variant="danger" size="sm" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    '✗ Reject'
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleAcceptEdited} variant="success" size="sm" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    '✓ Accept Edited Version'
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setEditedFix(gap.suggested_fix);
                    setIsEditing(false);
                  }}
                  variant="secondary"
                  size="sm"
                  disabled={isLoading}
                >
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
