import React, { useState } from 'react';
import { Edit2, Check, X, Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from './ui/ToastContainer';
import { api } from '../lib/api';
import type { UserStory } from '../types';

interface EditableStoryProps {
  story: UserStory;
  jobId: string;
  onUpdate: () => void;
}

export const EditableStory: React.FC<EditableStoryProps> = ({ story, jobId, onUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTitle, setEditedTitle] = useState(story.title);
  const [editedRole, setEditedRole] = useState(story.role);
  const [editedGoal, setEditedGoal] = useState(story.goal);
  const [editedBenefit, setEditedBenefit] = useState(story.benefit);
  const [editedCriteria, setEditedCriteria] = useState<string[]>(
    story.acceptance_criteria.map((ac) => ac.text)
  );
  const [newCriterion, setNewCriterion] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  const handleAddCriterion = () => {
    if (newCriterion.trim()) {
      setEditedCriteria([...editedCriteria, newCriterion.trim()]);
      setNewCriterion('');
    }
  };

  const handleRemoveCriterion = (index: number) => {
    setEditedCriteria(editedCriteria.filter((_, i) => i !== index));
  };

  const handleUpdateCriterion = (index: number, value: string) => {
    const updated = [...editedCriteria];
    updated[index] = value;
    setEditedCriteria(updated);
  };

  const handleSave = async () => {
    if (!editedTitle.trim() || !editedRole.trim() || !editedGoal.trim() || !editedBenefit.trim()) {
      toast.error('All story fields are required');
      return;
    }

    const validCriteria = editedCriteria.filter((c) => c.trim() !== '');
    if (validCriteria.length === 0) {
      toast.error('At least one acceptance criterion is required');
      return;
    }

    setIsSaving(true);
    try {
      // Update story fields
      await api.updateStory(
        jobId,
        story.id,
        editedTitle.trim(),
        editedRole.trim(),
        editedGoal.trim(),
        editedBenefit.trim()
      );

      // Update acceptance criteria
      await api.updateAcceptanceCriteria(jobId, story.id, validCriteria);

      toast.success('Story updated successfully');
      setIsEditMode(false);
      onUpdate(); // Refresh data
    } catch (error) {
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
    setEditedCriteria(story.acceptance_criteria.map((ac) => ac.text));
    setNewCriterion('');
    setIsEditMode(false);
  };

  const handleRegenerateTests = async () => {
    setIsRegenerating(true);
    try {
      await api.regenerateStoryTests(jobId, story.id);
      toast.success('Test regeneration started. Tests will update shortly.');

      // Poll for updates after a delay
      setTimeout(() => {
        onUpdate();
      }, 5000);
    } catch (error) {
      toast.error('Failed to regenerate tests');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete story "${story.title}" and all its associated tests?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteStory(jobId, story.id);
      toast.success('Story and associated tests deleted successfully');
      onUpdate(); // Refresh data
    } catch (error) {
      toast.error('Failed to delete story');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`border-l-4 ${story.regeneration_needed ? 'border-orange-500 bg-orange-50' : 'border-blue-500'} pl-4 py-2 rounded-r-lg`}>
      {story.regeneration_needed && (
        <div className="mb-2 flex items-center gap-2 text-sm text-orange-700 bg-orange-100 p-2 rounded">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">Story edited - tests need regeneration</span>
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          {isEditMode ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full font-semibold text-gray-900 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Story title"
            />
          ) : (
            <h4 className="font-semibold text-gray-900">{story.title}</h4>
          )}
        </div>
        {!isEditMode && (
          <div className="flex gap-2 ml-2">
            {story.regeneration_needed && (
              <button
                onClick={handleRegenerateTests}
                disabled={isRegenerating}
                className="p-1 text-orange-600 hover:text-orange-700 hover:bg-orange-100 rounded transition-colors disabled:opacity-50"
                title="Regenerate tests for this story"
              >
                <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setIsEditMode(true)}
              disabled={isDeleting}
              className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
              title="Edit story"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting || isRegenerating}
              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="Delete story and all tests"
            >
              <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {isEditMode ? (
        <div className="space-y-4 mt-4">
          {/* Story Fields */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                As a (role)
              </label>
              <input
                type="text"
                value={editedRole}
                onChange={(e) => setEditedRole(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="user role"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                I want (goal)
              </label>
              <input
                type="text"
                value={editedGoal}
                onChange={(e) => setEditedGoal(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="user goal"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                So that (benefit)
              </label>
              <input
                type="text"
                value={editedBenefit}
                onChange={(e) => setEditedBenefit(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="user benefit"
              />
            </div>
          </div>

          {/* Acceptance Criteria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Acceptance Criteria
            </label>
            <div className="space-y-2">
              {editedCriteria.map((criterion, index) => (
                <div key={index} className="flex items-start gap-2">
                  <input
                    type="text"
                    value={criterion}
                    onChange={(e) => handleUpdateCriterion(index, e.target.value)}
                    className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => handleRemoveCriterion(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCriterion}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCriterion()}
                  placeholder="Add new criterion..."
                  className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleAddCriterion}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  title="Add"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex items-center gap-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-700 mb-3">
            As a <span className="font-medium">{story.role}</span>, I want{' '}
            <span className="font-medium">{story.goal}</span> so that{' '}
            <span className="font-medium">{story.benefit}</span>.
          </p>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Acceptance Criteria:</p>
            <ul className="list-disc list-inside space-y-1">
              {story.acceptance_criteria.map((ac) => (
                <li key={ac.id} className="text-sm text-gray-600">
                  {ac.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Source chunks indicator */}
          {story.source_chunks && story.source_chunks.length > 0 && (
            <div className="mt-3 text-xs text-gray-500">
              Source chunks: {story.source_chunks.length} references
            </div>
          )}
        </>
      )}
    </div>
  );
};
