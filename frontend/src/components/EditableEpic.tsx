import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Edit2, Check, X, Trash2, Loader2 } from 'lucide-react';
import { useToast } from './ui/ToastContainer';
import { api } from '../lib/api';
import type { Epic } from '../types';

interface EditableEpicProps {
  epic: Epic;
  jobId: string;
  onUpdate: () => void;
  children?: React.ReactNode;
}

export const EditableEpic: React.FC<EditableEpicProps> = ({ epic, jobId, onUpdate, children }) => {
  const [isEditMode,       setIsEditMode]       = useState(false);
  const [editedName,       setEditedName]       = useState(epic.name);
  const [editedDescription,setEditedDescription]= useState(epic.description);
  const [isSaving,         setIsSaving]         = useState(false);
  const [isDeleting,       setIsDeleting]       = useState(false);
  const toast     = useToast();
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleEnterEdit = () => {
    setIsEditMode(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!editedName.trim() || !editedDescription.trim()) {
      toast.error('Name and description are required');
      return;
    }
    setIsSaving(true);
    try {
      await api.updateEpic(jobId, epic.id, editedName.trim(), editedDescription.trim());
      toast.success('Epic updated');
      setIsEditMode(false);
      onUpdate();
    } catch {
      toast.error('Failed to update epic');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedName(epic.name);
    setEditedDescription(epic.description);
    setIsEditMode(false);
    editBtnRef.current?.focus();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete epic "${epic.name}" and all its stories?`)) return;
    setIsDeleting(true);
    try {
      const result = await api.deleteEpic(jobId, epic.id);
      if (result.success) {
        toast.success(`Epic and ${result.deleted_stories_count} stories deleted`);
        onUpdate();
      } else {
        toast.error('Failed to delete epic');
        setIsDeleting(false);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete epic');
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {isEditMode ? (
              <div className="space-y-2.5 pr-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Epic Name</label>
                  <Input
                    ref={nameInputRef}
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    placeholder="Epic name"
                    className="font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
                  <Textarea
                    value={editedDescription}
                    onChange={e => setEditedDescription(e.target.value)}
                    rows={3}
                    placeholder="Epic description"
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    {isSaving ? 'Saving…' : 'Save'}
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
                <CardTitle>{epic.name}</CardTitle>
                <p className="text-sm text-neutral-500 mt-1">{epic.description}</p>
              </>
            )}
          </div>
          {!isEditMode && (
            <div className="flex gap-1 ml-4 shrink-0">
              <button
                ref={editBtnRef}
                onClick={handleEnterEdit}
                disabled={isDeleting}
                className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                aria-label="Edit epic"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                aria-label="Delete epic and all stories"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      {!isEditMode && <CardContent>{children}</CardContent>}
    </Card>
  );
};
