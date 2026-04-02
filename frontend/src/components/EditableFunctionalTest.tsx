import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Edit2, Check, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from './ui/ToastContainer';
import { api } from '../lib/api';
import type { FunctionalTest } from '../types';

interface EditableFunctionalTestProps {
  test: FunctionalTest;
  jobId: string;
  onUpdate: () => void;
}

// ── Shared inline-list editor ─────────────────────────────────────────────────

const EditableList: React.FC<{
  items: string[];
  newValue: string;
  placeholder: string;
  onNewValueChange: (v: string) => void;
  onAdd: () => void;
  onUpdate: (i: number, v: string) => void;
  onRemove: (i: number) => void;
  numbered?: boolean;
}> = ({ items, newValue, placeholder, onNewValueChange, onAdd, onUpdate, onRemove, numbered }) => (
  <div className="space-y-1.5">
    {items.map((item, i) => (
      <div key={i} className="flex items-center gap-2">
        {numbered && (
          <span className="text-xs font-bold text-neutral-400 shrink-0 w-5 text-right">{i + 1}.</span>
        )}
        <Input
          value={item}
          onChange={e => onUpdate(i, e.target.value)}
          className="flex-1 text-xs h-7"
        />
        <button
          onClick={() => onRemove(i)}
          className="p-1 text-neutral-400 hover:text-red-500 rounded transition-colors shrink-0"
          aria-label="Remove item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}
    <div className="flex items-center gap-2">
      {numbered && <span className="w-5 shrink-0" />}
      <Input
        value={newValue}
        onChange={e => onNewValueChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAdd()}
        placeholder={placeholder}
        className="flex-1 text-xs h-7"
      />
      <button
        onClick={onAdd}
        className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 shrink-0"
        aria-label="Add item"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ── Section header for display mode ──────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2">{children}</p>
);

// ── Main component ────────────────────────────────────────────────────────────

export const EditableFunctionalTest: React.FC<EditableFunctionalTestProps> = ({ test, jobId, onUpdate }) => {
  const [isEditMode,          setIsEditMode]          = useState(false);
  const [editedTitle,         setEditedTitle]         = useState(test.title);
  const [editedObjective,     setEditedObjective]     = useState(test.objective);
  const [editedPreconditions, setEditedPreconditions] = useState<string[]>(test.preconditions);
  const [editedTestSteps,     setEditedTestSteps]     = useState<string[]>(test.test_steps);
  const [editedExpected,      setEditedExpected]      = useState<string[]>(test.expected_results);
  const [newPrecondition,     setNewPrecondition]     = useState('');
  const [newTestStep,         setNewTestStep]         = useState('');
  const [newExpected,         setNewExpected]         = useState('');
  const [isSaving,            setIsSaving]            = useState(false);
  const [isDeleting,          setIsDeleting]          = useState(false);
  const toast      = useToast();
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const titleRef   = useRef<HTMLInputElement>(null);

  const makeListHandlers = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    newVal: string,
    setNewVal: React.Dispatch<React.SetStateAction<string>>,
    placeholder: string,
    numbered = false,
  ) => ({
    items: list, newValue: newVal, placeholder, numbered,
    onNewValueChange: setNewVal,
    onAdd:    () => { if (newVal.trim()) { setList(p => [...p, newVal.trim()]); setNewVal(''); } },
    onUpdate: (i: number, v: string) => setList(p => p.map((x, idx) => idx === i ? v : x)),
    onRemove: (i: number) => setList(p => p.filter((_, idx) => idx !== i)),
  });

  const handleEnterEdit = () => {
    setIsEditMode(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  };

  const handleCancel = () => {
    setEditedTitle(test.title);
    setEditedObjective(test.objective);
    setEditedPreconditions(test.preconditions);
    setEditedTestSteps(test.test_steps);
    setEditedExpected(test.expected_results);
    setNewPrecondition(''); setNewTestStep(''); setNewExpected('');
    setIsEditMode(false);
    editBtnRef.current?.focus();
  };

  const handleSave = async () => {
    if (!editedTitle.trim() || !editedObjective.trim()) {
      toast.error('Title and objective are required');
      return;
    }
    const vPre   = editedPreconditions.filter(s => s.trim());
    const vSteps = editedTestSteps.filter(s => s.trim());
    const vExp   = editedExpected.filter(s => s.trim());
    if (!vPre.length || !vSteps.length || !vExp.length) {
      toast.error('At least one precondition, step, and expected result are required');
      return;
    }
    setIsSaving(true);
    try {
      await api.updateFunctionalTest(jobId, test.id, editedTitle.trim(), editedObjective.trim(), vPre, vSteps, vExp);
      toast.success('Functional test updated');
      setIsEditMode(false);
      onUpdate();
    } catch {
      toast.error('Failed to update functional test');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete functional test "${test.title}"?`)) return;
    setIsDeleting(true);
    try {
      await api.deleteTest(jobId, test.id, 'functional');
      toast.success('Functional test deleted');
      onUpdate();
    } catch {
      toast.error('Failed to delete functional test');
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {isEditMode ? (
              <Input ref={titleRef} value={editedTitle} onChange={e => setEditedTitle(e.target.value)} placeholder="Test title" className="font-medium" />
            ) : (
              <CardTitle className="text-sm leading-snug">{test.title}</CardTitle>
            )}
          </div>
          {!isEditMode && (
            <div className="flex gap-1 ml-3 shrink-0">
              <button
                ref={editBtnRef}
                onClick={handleEnterEdit}
                disabled={isDeleting}
                className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                aria-label="Edit functional test"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                aria-label="Delete functional test"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isEditMode ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Objective</label>
              <Textarea value={editedObjective} onChange={e => setEditedObjective(e.target.value)} rows={2} placeholder="Test objective" className="text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-2">Preconditions</label>
              <EditableList {...makeListHandlers(editedPreconditions, setEditedPreconditions, newPrecondition, setNewPrecondition, 'Add precondition…')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-2">Test Steps</label>
              <EditableList {...makeListHandlers(editedTestSteps, setEditedTestSteps, newTestStep, setNewTestStep, 'Add test step…', true)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-2">Expected Results</label>
              <EditableList {...makeListHandlers(editedExpected, setEditedExpected, newExpected, setNewExpected, 'Add expected result…')} />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded text-xs hover:bg-neutral-200 disabled:opacity-50"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── Display mode ── */
          <div className="space-y-4">
            <div>
              <SectionLabel>Objective</SectionLabel>
              <p className="text-sm text-neutral-600 leading-relaxed">{test.objective}</p>
            </div>

            <div>
              <SectionLabel>Preconditions</SectionLabel>
              <ul className="space-y-1">
                {test.preconditions.map((pc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
                    {pc}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <SectionLabel>Test Steps</SectionLabel>
              <ol className="space-y-1.5">
                {test.test_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-neutral-700 leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <SectionLabel>Expected Results</SectionLabel>
              <ul className="space-y-1">
                {test.expected_results.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
