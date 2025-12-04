import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Edit2, Check, X, Trash2 } from 'lucide-react';
import { EditableText } from './EditableText';
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedName, setEditedName] = useState(epic.name);
  const [editedDescription, setEditedDescription] = useState(epic.description);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    if (!editedName.trim() || !editedDescription.trim()) {
      toast.error('Name and description are required');
      return;
    }

    setIsSaving(true);
    try {
      await api.updateEpic(jobId, epic.id, editedName.trim(), editedDescription.trim());
      toast.success('Epic updated successfully');
      setIsEditMode(false);
      onUpdate(); // Refresh data
    } catch (error) {
      toast.error('Failed to update epic');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedName(epic.name);
    setEditedDescription(epic.description);
    setIsEditMode(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete epic "${epic.name}" and all its associated stories?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteEpic(jobId, epic.id);
      toast.success('Epic and associated stories deleted successfully');
      onUpdate(); // Refresh data
    } catch (error) {
      toast.error('Failed to delete epic');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditMode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Epic Name
                  </label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Epic name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Epic description"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <CardTitle>{epic.name}</CardTitle>
                <p className="text-sm text-gray-600 mt-1">{epic.description}</p>
              </>
            )}
          </div>
          {!isEditMode && (
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => setIsEditMode(true)}
                disabled={isDeleting}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                title="Edit epic"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Delete epic and all stories"
              >
                <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      {!isEditMode && <CardContent>{children}</CardContent>}
    </Card>
  );
};
