import React, { useState, useRef } from 'react';
import { Edit2, Check, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Input } from './ui/Input';
import { useToast } from './ui/ToastContainer';
import { api } from '../lib/api';
import type { UserStory } from '../types';

interface EditableStoryProps {
  story: UserStory;
  jobId: string;
  onUpdate: () => void;
}

export const EditableStory: React.FC<EditableStoryProps> = ({ story, jobId, onUpdate }) => {
  const [isEditMode,   setIsEditMode]   = useState(false);
  const [editedTitle,  setEditedTitle]  = useState(story.title);
  const [editedRole,   setEditedRole]   = useState(story.role);
  const [editedGoal,   setEditedGoal]   = useState(story.goal);
  const [editedBenefit,setEditedBenefit]= useState(story.benefit);
  const [editedCriteria, setEditedCriteria] = useState<string[]>(
    story.acceptance_criteria.map(ac => ac.text)
  );
  const [newCriterion, setNewCriterion] = useState('');
  const [isSaving,     setIsSaving]     = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const toast     = useToast();
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const titleRef   = useRef<HTMLInputElement>(null);

  const handleEnterEdit = () => {
    setIsEditMode(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  };

  const handleAddCriterion = () => {
    if (newCriterion.trim()) {
      setEditedCriteria(prev => [...prev, newCriterion.trim()]);
      setNewCriterion('');
    }
  };

  const handleSave = async () => {
    if (!editedTitle.trim() || !editedRole.trim() || !editedGoal.trim() || !editedBenefit.trim()) {
      toast.error('All story fields are required');
      return;
    }
    const validCriteria = editedCriteria.filter(c => c.trim());
    if (!validCriteria.length) {
      toast.error('At least one acceptance criterion is required');
      return;
    }
    setIsSaving(true);
    try {
      await api.updateStory(jobId, story.id, editedTitle.trim(), editedRole.trim(), editedGoal.trim(), editedBenefit.trim());
      await api.updateAcceptanceCriteria(jobId, story.id, validCriteria);
      toast.success('Story updated');
      setIsEditMode(false);
      onUpdate();
    } catch {
      toast.error('Failed to update story');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedTitle(story.title);
    setEditedRole(story.role);
    setEditedGoal(story.goal);
    setEditedBenefit(story.benefit);
    setEditedCriteria(story.acceptance_criteria.map(ac => ac.text));
    setNewCriterion('');
    setIsEditMode(false);
    editBtnRef.current?.focus();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete story "${story.title}" and all its associated tests?`)) return;
    setIsDeleting(true);
    try {
      await api.deleteStory(jobId, story.id);
      toast.success('Story deleted');
      onUpdate();
    } catch {
      toast.error('Failed to delete story');
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white border-l-4 border-l-indigo-400 pl-4 pr-3 py-3">
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          {isEditMode ? (
            <Input
              ref={titleRef}
              value={editedTitle}
              onChange={e => setEditedTitle(e.target.value)}
              placeholder="Story title"
              className="font-semibold"
            />
          ) : (
            <h4 className="font-semibold text-sm text-neutral-900 leading-snug">{story.title}</h4>
          )}
        </div>
        {!isEditMode && (
          <div className="flex gap-1 ml-2 shrink-0">
            <button
              ref={editBtnRef}
              onClick={handleEnterEdit}
              disabled={isDeleting}
              className="p-1 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
              aria-label="Edit story"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              aria-label="Delete story and all tests"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {isEditMode ? (
        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-1 gap-2">
            {[
              { label: 'As a (role)',    value: editedRole,    setter: setEditedRole,    placeholder: 'user role' },
              { label: 'I want (goal)',  value: editedGoal,    setter: setEditedGoal,    placeholder: 'user goal' },
              { label: 'So that (benefit)', value: editedBenefit, setter: setEditedBenefit, placeholder: 'user benefit' },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
                <Input value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} className="text-sm" />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Acceptance Criteria</label>
            <div className="space-y-1.5">
              {editedCriteria.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={c}
                    onChange={e => setEditedCriteria(prev => prev.map((x, idx) => idx === i ? e.target.value : x))}
                    className="flex-1 text-xs h-7"
                  />
                  <button
                    onClick={() => setEditedCriteria(prev => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-neutral-400 hover:text-red-500 rounded transition-colors"
                    aria-label="Remove criterion"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  value={newCriterion}
                  onChange={e => setNewCriterion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCriterion()}
                  placeholder="Add criterion…"
                  className="flex-1 text-xs h-7"
                />
                <button
                  onClick={handleAddCriterion}
                  className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  aria-label="Add criterion"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
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
        <>
          <p className="text-xs text-neutral-500 leading-relaxed">
            As a <span className="font-medium text-neutral-700">{story.role}</span>, I want{' '}
            <span className="font-medium text-neutral-700">{story.goal}</span> so that{' '}
            <span className="font-medium text-neutral-700">{story.benefit}</span>.
          </p>

          {story.acceptance_criteria.length > 0 && (
            <div className="mt-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">
                Acceptance Criteria
              </p>
              <ul className="space-y-0.5">
                {story.acceptance_criteria.map(ac => (
                  <li key={ac.id} className="flex items-start gap-2 text-xs text-neutral-600">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" />
                    {ac.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {story.atomic_requirement_ids && story.atomic_requirement_ids.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {story.atomic_requirement_ids.map(id => (
                <span key={id} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                  {id}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
