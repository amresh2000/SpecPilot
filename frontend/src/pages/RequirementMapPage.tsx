import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2, ArrowRight, CheckCircle2, Table2, AlertTriangle,
  ChevronRight, Edit2, Trash2, Check, X, RefreshCw, Map,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastContainer';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  RequirementChunk, AtomicRequirement, BrdChunk,
  AtomicRequirementType, AtomicRequirementStatus,
} from '@/types';

// ─── Req type badge config ────────────────────────────────────────────────────

const REQ_TYPE_LABELS: Record<AtomicRequirementType, string> = {
  functional:    'Functional',
  business_rule: 'Business Rule',
  exception:     'Exception',
  validation:    'Validation',
  nfr:           'NFR',
  constraint:    'Constraint',
};

const REQ_TYPE_COLORS: Record<AtomicRequirementType, string> = {
  functional:    'bg-sky-100 text-sky-700',
  business_rule: 'bg-violet-100 text-violet-700',
  exception:     'bg-orange-100 text-orange-700',
  validation:    'bg-amber-100 text-amber-700',
  nfr:           'bg-neutral-100 text-neutral-600',
  constraint:    'bg-red-100 text-red-600',
};

const SEMANTIC_TYPE_LABELS: Record<string, string> = {
  functional_flow: 'Functional Flow',
  business_rules:  'Business Rules',
  nfr:             'NFR',
  constraint:      'Constraint',
  mixed:           'Mixed',
  informational:   'Informational',
};

const FILTER_OPTIONS = [
  { value: 'all',            label: 'All' },
  { value: 'functional_flow', label: 'Functional' },
  { value: 'business_rules',  label: 'Business Rules' },
  { value: 'nfr',             label: 'NFR' },
  { value: 'informational',   label: 'Informational' },
];

// ─── Atomic Requirement Card ──────────────────────────────────────────────────

const AtomicRequirementCard: React.FC<{
  req: AtomicRequirement;
  jobId: string;
  onUpdate: (id: string, updates: Partial<AtomicRequirement>) => void;
  onDelete: (id: string) => void;
}> = ({ req, jobId, onUpdate, onDelete }) => {
  const [isEditing,  setIsEditing]  = useState(false);
  const [editText,   setEditText]   = useState(req.text);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editBtnRef  = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const isOutOfScope = req.status === 'out_of_scope';

  const handleEdit = () => {
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditText(req.text);
    editBtnRef.current?.focus();
  };

  const handleSave = async () => {
    if (!editText.trim()) return;
    setIsSaving(true);
    try {
      await api.updateAtomicRequirement(jobId, req.id, { text: editText.trim(), status: 'edited' });
      onUpdate(req.id, { text: editText.trim(), status: 'edited' });
      setIsEditing(false);
    } catch {
      toast.error('Failed to save requirement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleOutOfScope = async () => {
    const newStatus: AtomicRequirementStatus = isOutOfScope ? 'reviewed' : 'out_of_scope';
    try {
      await api.updateAtomicRequirement(jobId, req.id, { status: newStatus });
      onUpdate(req.id, { status: newStatus });
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.deleteAtomicRequirement(jobId, req.id);
      onDelete(req.id);
    } catch {
      toast.error('Failed to delete requirement');
      setIsDeleting(false);
    }
  };

  return (
    <div className={cn(
      'rounded-lg border p-3 transition-all',
      isOutOfScope ? 'opacity-40 bg-neutral-50 border-neutral-200' : 'bg-white border-neutral-200 hover:border-neutral-300',
    )}>
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            className="w-full text-sm border border-neutral-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            rows={3}
            value={editText}
            onChange={e => setEditText(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-2.5 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-50 text-neutral-600"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm leading-relaxed', isOutOfScope ? 'line-through text-neutral-400' : 'text-neutral-800')}>
              {req.text}
            </p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${REQ_TYPE_COLORS[req.type]}`}>
                {REQ_TYPE_LABELS[req.type]}
              </span>
              {req.derived_from_table && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-teal-50 text-teal-700">
                  <Table2 className="w-3 h-3" /> Table
                </span>
              )}
              {req.status === 'edited' && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-600">Edited</span>
              )}
              <span className="text-xs text-neutral-400 font-mono">{req.id}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button
              ref={editBtnRef}
              onClick={handleEdit}
              className="p-1 text-neutral-400 hover:text-indigo-600 rounded transition-colors"
              aria-label="Edit requirement"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleToggleOutOfScope}
              className={cn('p-1 rounded transition-colors', isOutOfScope ? 'text-emerald-500 hover:text-emerald-700' : 'text-neutral-400 hover:text-amber-500')}
              aria-label={isOutOfScope ? 'Restore requirement' : 'Mark out of scope'}
            >
              {isOutOfScope ? <RefreshCw className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1 text-neutral-400 hover:text-red-500 rounded disabled:opacity-50 transition-colors"
              aria-label="Delete requirement"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const RequirementMapPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate  = useNavigate();
  const toast     = useToast();

  const [isLoading,        setIsLoading]        = useState(true);
  const [chunks,           setChunks]           = useState<RequirementChunk[]>([]);
  const [requirements,     setRequirements]     = useState<AtomicRequirement[]>([]);
  const [brdChunks,        setBrdChunks]        = useState<BrdChunk[]>([]);
  const [selectedChunkId,  setSelectedChunkId]  = useState<string | null>(null);
  const [filter,           setFilter]           = useState('all');
  const [isProceeding,     setIsProceeding]     = useState(false);
  const [isStillGenerating,setIsStillGenerating]= useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = async () => {
    if (!jobId) return;
    try {
      const status = await api.getStatus(jobId);
      const rmStage = status.stage_history.find(s => s.stage === 'requirement_map');
      if (!rmStage || rmStage.status === 'running') { setIsStillGenerating(true); return; }
      setIsStillGenerating(false);

      const [mapData, chunksData] = await Promise.all([
        api.getRequirementMap(jobId),
        api.getBrdChunks(jobId),
      ]);
      setChunks(mapData.requirement_chunks);
      setRequirements(mapData.atomic_requirements);
      setBrdChunks(chunksData.chunks);
      setSelectedChunkId(prev => prev ?? mapData.requirement_chunks[0]?.chunk_id ?? null);

      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    } catch {
      toast.error('Failed to load requirement map');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(loadData, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [jobId]);

  const handleUpdateRequirement = (id: string, updates: Partial<AtomicRequirement>) => {
    setRequirements(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleDeleteRequirement = (id: string) => {
    setRequirements(prev => prev.filter(r => r.id !== id));
    setChunks(prev => prev.map(c => ({
      ...c,
      atomic_requirement_ids: c.atomic_requirement_ids.filter(rid => rid !== id),
    })));
  };

  const handleProceedToEpics = async () => {
    if (!jobId) return;
    setIsProceeding(true);
    try {
      await api.proceedToStage(jobId, 'epics');
      toast.success('Building epics & user stories…');
      navigate(`/epics/${jobId}`);
    } catch {
      toast.error('Failed to proceed to epics');
      setIsProceeding(false);
    }
  };

  // Derived state
  const filteredChunks  = filter === 'all' ? chunks : chunks.filter(c => c.semantic_type === filter);
  const selectedChunk   = chunks.find(c => c.chunk_id === selectedChunkId) ?? null;
  const chunkRequirements = selectedChunk
    ? requirements.filter(r => selectedChunk.atomic_requirement_ids.includes(r.id))
    : [];
  const sourceBrdChunk = selectedChunk ? brdChunks.find(b => b.id === selectedChunk.chunk_id) ?? null : null;

  const totalReqs    = requirements.length;
  const inScopeReqs  = requirements.filter(r => r.status !== 'out_of_scope').length;
  const reviewedReqs = requirements.filter(r => r.status === 'reviewed' || r.status === 'edited').length;

  if (isLoading || isStillGenerating) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Map className="w-8 h-8 text-indigo-500" />
          </div>
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-neutral-700 font-medium text-sm">
            {isStillGenerating ? 'Building requirement map…' : 'Loading…'}
          </p>
          {isStillGenerating && (
            <p className="text-neutral-400 text-xs mt-1">
              The AI is extracting atomic requirements from your BRD
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="h-14 border-b border-neutral-200 bg-white flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-neutral-900">SpecPilot</span>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-neutral-500">Requirement Map</span>
        </div>
        {/* Breadcrumb stepper pills */}
        <div className="hidden md:flex items-center gap-1 text-xs">
          {['Upload', 'Validation', 'Req Map', 'Epics', 'Tests', 'Summary'].map((step, i) => (
            <React.Fragment key={step}>
              <span className={cn('px-2.5 py-1 rounded-full font-medium transition-colors',
                i === 2 ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-600')}>
                {step}
              </span>
              {i < 5 && <ChevronRight className="w-3 h-3 text-neutral-300" />}
            </React.Fragment>
          ))}
        </div>
        <div className="text-xs text-neutral-500">
          <span className="font-semibold text-neutral-800">{inScopeReqs}</span>/{totalReqs} in scope
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="px-5 py-2 bg-white border-b border-neutral-100 flex items-center gap-6 text-xs shrink-0">
        {[
          ['Chunks', chunks.length, 'text-neutral-800'],
          ['Requirements', totalReqs, 'text-neutral-800'],
          ['Reviewed', reviewedReqs, 'text-emerald-600'],
          ['Out of scope', totalReqs - inScopeReqs, 'text-neutral-400'],
        ].map(([label, val, color]) => (
          <div key={label as string} className="flex items-center gap-1.5">
            <span className="text-neutral-400">{label}:</span>
            <span className={`font-semibold ${color}`}>{val}</span>
          </div>
        ))}
      </div>

      {/* ── 3-column body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Chunk Navigator */}
        <div className="w-64 bg-neutral-50 border-r border-neutral-200 flex flex-col shrink-0">
          {/* Filter tabs */}
          <div className="px-3 pt-3 pb-2 flex flex-wrap gap-1 border-b border-neutral-100">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={cn('px-2 py-0.5 text-xs rounded-full transition-colors font-medium',
                  filter === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-500 hover:bg-neutral-200')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filteredChunks.length === 0 ? (
              <p className="p-4 text-xs text-neutral-400 text-center">No chunks match this filter</p>
            ) : (
              filteredChunks.map(chunk => {
                const chunkReqs = requirements.filter(r => chunk.atomic_requirement_ids.includes(r.id));
                const inScope   = chunkReqs.filter(r => r.status !== 'out_of_scope').length;
                const isSelected = chunk.chunk_id === selectedChunkId;

                return (
                  <button
                    key={chunk.chunk_id}
                    onClick={() => setSelectedChunkId(chunk.chunk_id)}
                    className={cn(
                      'w-full text-left mx-2 my-0.5 px-3 py-2.5 rounded-lg transition-colors',
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'hover:bg-neutral-200 text-neutral-700',
                    )}
                    style={{ width: 'calc(100% - 16px)' }}
                  >
                    <p className={cn('text-xs font-medium leading-snug truncate', isSelected ? 'text-white' : 'text-neutral-800')}>
                      {chunk.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={cn('text-[10px]', isSelected ? 'text-indigo-200' : 'text-neutral-400')}>
                        {SEMANTIC_TYPE_LABELS[chunk.semantic_type] ?? chunk.semantic_type}
                      </span>
                      <span className={cn('text-[10px]', isSelected ? 'text-indigo-200' : 'text-neutral-500')}>
                        · {inScope} reqs
                      </span>
                      {chunk.has_table && <Table2 className={cn('w-3 h-3', isSelected ? 'text-indigo-200' : 'text-teal-500')} />}
                      {chunk.confidence < 0.6 && <AlertTriangle className={cn('w-3 h-3', isSelected ? 'text-yellow-300' : 'text-amber-400')} />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Chunk Detail */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {!selectedChunk ? (
            <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
              Select a chunk to review its requirements
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-neutral-100 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-neutral-900">{selectedChunk.title}</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">{selectedChunk.summary}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-1 text-xs rounded-full bg-neutral-100 text-neutral-600">
                      {SEMANTIC_TYPE_LABELS[selectedChunk.semantic_type] ?? selectedChunk.semantic_type}
                    </span>
                    {selectedChunk.has_table && (
                      <span className="px-2 py-1 text-xs rounded-full bg-teal-50 text-teal-700 flex items-center gap-1">
                        <Table2 className="w-3 h-3" /> Table
                      </span>
                    )}
                    <span className={cn('px-2 py-1 text-xs rounded-full',
                      selectedChunk.confidence >= 0.8 ? 'bg-emerald-50 text-emerald-700' :
                      selectedChunk.confidence >= 0.6 ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-600'
                    )}>
                      {Math.round(selectedChunk.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                  Atomic Requirements ({chunkRequirements.filter(r => r.status !== 'out_of_scope').length} in scope)
                </p>
                {chunkRequirements.length === 0 ? (
                  <p className="text-center py-8 text-xs text-neutral-400">No requirements extracted for this chunk</p>
                ) : (
                  <div className="space-y-2">
                    {chunkRequirements.map(req => (
                      <AtomicRequirementCard
                        key={req.id}
                        req={req}
                        jobId={jobId!}
                        onUpdate={handleUpdateRequirement}
                        onDelete={handleDeleteRequirement}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: Source Viewer — dark code-block style */}
        <div className="w-72 bg-neutral-900 border-l border-neutral-700 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-neutral-700 shrink-0">
            <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">Source Text</h3>
            {sourceBrdChunk && (
              <p className="text-[10px] text-neutral-500 mt-0.5">
                {sourceBrdChunk.section_id} · Level {sourceBrdChunk.heading_level}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!sourceBrdChunk ? (
              <p className="text-xs text-neutral-500">Select a chunk to see source</p>
            ) : (
              <div className="space-y-3">
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
                  {sourceBrdChunk.type === 'table' ? 'Table content' : 'Section content'}
                </span>
                <pre className="text-xs text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed mt-2">
                  {sourceBrdChunk.text}
                </pre>
                {sourceBrdChunk.parent_section_id && (
                  <p className="text-[10px] text-neutral-600 mt-2">
                    Parent: {sourceBrdChunk.parent_section_id}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom action bar ── */}
      <div className="h-16 border-t border-neutral-200 bg-white flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{inScopeReqs} requirements ready for epic generation</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/validation/${jobId}`)}
            disabled={isProceeding}
          >
            Back
          </Button>
          <Button
            onClick={handleProceedToEpics}
            disabled={isProceeding || inScopeReqs === 0}
          >
            {isProceeding
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating Epics…</>
              : <>Proceed to Epics<ArrowRight className="w-4 h-4 ml-2" /></>
            }
          </Button>
        </div>
      </div>
    </div>
  );
};
