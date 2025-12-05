import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Edit2, Check, X, Plus, Trash2 } from 'lucide-react';
import { useToast } from './ui/ToastContainer';
import { api } from '../lib/api';
import type { GherkinScenario } from '../types';

interface EditableGherkinTestProps {
  scenario: GherkinScenario;
  jobId: string;
  onUpdate: () => void;
}

export const EditableGherkinTest: React.FC<EditableGherkinTestProps> = ({ scenario, jobId, onUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedFeatureName, setEditedFeatureName] = useState(scenario.feature_name);
  const [editedScenarioName, setEditedScenarioName] = useState(scenario.scenario_name);
  const [editedGiven, setEditedGiven] = useState<string[]>(scenario.given);
  const [editedWhen, setEditedWhen] = useState<string[]>(scenario.when);
  const [editedThen, setEditedThen] = useState<string[]>(scenario.then);
  const [newGiven, setNewGiven] = useState('');
  const [newWhen, setNewWhen] = useState('');
  const [newThen, setNewThen] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  const handleAddGiven = () => {
    if (newGiven.trim()) {
      setEditedGiven([...editedGiven, newGiven.trim()]);
      setNewGiven('');
    }
  };

  const handleRemoveGiven = (index: number) => {
    setEditedGiven(editedGiven.filter((_, i) => i !== index));
  };

  const handleUpdateGiven = (index: number, value: string) => {
    const updated = [...editedGiven];
    updated[index] = value;
    setEditedGiven(updated);
  };

  const handleAddWhen = () => {
    if (newWhen.trim()) {
      setEditedWhen([...editedWhen, newWhen.trim()]);
      setNewWhen('');
    }
  };

  const handleRemoveWhen = (index: number) => {
    setEditedWhen(editedWhen.filter((_, i) => i !== index));
  };

  const handleUpdateWhen = (index: number, value: string) => {
    const updated = [...editedWhen];
    updated[index] = value;
    setEditedWhen(updated);
  };

  const handleAddThen = () => {
    if (newThen.trim()) {
      setEditedThen([...editedThen, newThen.trim()]);
      setNewThen('');
    }
  };

  const handleRemoveThen = (index: number) => {
    setEditedThen(editedThen.filter((_, i) => i !== index));
  };

  const handleUpdateThen = (index: number, value: string) => {
    const updated = [...editedThen];
    updated[index] = value;
    setEditedThen(updated);
  };

  const handleSave = async () => {
    if (!editedFeatureName.trim() || !editedScenarioName.trim()) {
      toast.error('Feature name and scenario name are required');
      return;
    }

    const validGiven = editedGiven.filter((g) => g.trim() !== '');
    const validWhen = editedWhen.filter((w) => w.trim() !== '');
    const validThen = editedThen.filter((t) => t.trim() !== '');

    if (validGiven.length === 0 || validWhen.length === 0 || validThen.length === 0) {
      toast.error('At least one Given, When, and Then statement are required');
      return;
    }

    setIsSaving(true);
    try {
      await api.updateGherkinTest(
        jobId,
        scenario.id,
        editedFeatureName.trim(),
        editedScenarioName.trim(),
        validGiven,
        validWhen,
        validThen
      );

      toast.success('Gherkin test updated successfully');
      setIsEditMode(false);
      onUpdate();
    } catch (error) {
      toast.error('Failed to update Gherkin test');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedFeatureName(scenario.feature_name);
    setEditedScenarioName(scenario.scenario_name);
    setEditedGiven(scenario.given);
    setEditedWhen(scenario.when);
    setEditedThen(scenario.then);
    setNewGiven('');
    setNewWhen('');
    setNewThen('');
    setIsEditMode(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete Gherkin scenario "${scenario.scenario_name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteTest(jobId, scenario.id, 'gherkin');
      toast.success('Gherkin test deleted successfully');
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete Gherkin test');
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
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Feature Name</label>
                  <input
                    type="text"
                    value={editedFeatureName}
                    onChange={(e) => setEditedFeatureName(e.target.value)}
                    className="w-full font-semibold text-lg p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Feature name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Scenario Name</label>
                  <input
                    type="text"
                    value={editedScenarioName}
                    onChange={(e) => setEditedScenarioName(e.target.value)}
                    className="w-full font-semibold p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Scenario name"
                  />
                </div>
              </div>
            ) : (
              <CardTitle className="text-lg">Feature: {scenario.feature_name}</CardTitle>
            )}
          </div>
          {!isEditMode && (
            <div className="flex gap-2 ml-2">
              <button
                onClick={() => setIsEditMode(true)}
                disabled={isDeleting}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                title="Edit Gherkin test"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Delete Gherkin test"
              >
                <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditMode ? (
          <div className="space-y-4">
            {/* Given Statements */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Given Statements</label>
              <div className="space-y-2">
                {editedGiven.map((given, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-sm text-gray-500 mt-2 flex-shrink-0">Given</span>
                    <input
                      type="text"
                      value={given}
                      onChange={(e) => handleUpdateGiven(index, e.target.value)}
                      className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleRemoveGiven(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <span className="text-sm text-gray-500 mt-2 flex-shrink-0">Given</span>
                  <input
                    type="text"
                    value={newGiven}
                    onChange={(e) => setNewGiven(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddGiven()}
                    placeholder="Add new Given statement..."
                    className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddGiven}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    title="Add"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* When Statements */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">When Statements</label>
              <div className="space-y-2">
                {editedWhen.map((when, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-sm text-gray-500 mt-2 flex-shrink-0">When</span>
                    <input
                      type="text"
                      value={when}
                      onChange={(e) => handleUpdateWhen(index, e.target.value)}
                      className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleRemoveWhen(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <span className="text-sm text-gray-500 mt-2 flex-shrink-0">When</span>
                  <input
                    type="text"
                    value={newWhen}
                    onChange={(e) => setNewWhen(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddWhen()}
                    placeholder="Add new When statement..."
                    className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddWhen}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    title="Add"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Then Statements */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Then Statements</label>
              <div className="space-y-2">
                {editedThen.map((then, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-sm text-gray-500 mt-2 flex-shrink-0">Then</span>
                    <input
                      type="text"
                      value={then}
                      onChange={(e) => handleUpdateThen(index, e.target.value)}
                      className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleRemoveThen(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <span className="text-sm text-gray-500 mt-2 flex-shrink-0">Then</span>
                  <input
                    type="text"
                    value={newThen}
                    onChange={(e) => setNewThen(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddThen()}
                    placeholder="Add new Then statement..."
                    className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddThen}
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
          <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-x-auto">
            <div className="font-semibold">Scenario: {scenario.scenario_name}</div>
            {scenario.given.map((g, idx) => (
              <div key={idx} className="ml-2">
                Given {g}
              </div>
            ))}
            {scenario.when.map((w, idx) => (
              <div key={idx} className="ml-2">
                When {w}
              </div>
            ))}
            {scenario.then.map((t, idx) => (
              <div key={idx} className="ml-2">
                Then {t}
              </div>
            ))}
            {scenario.source_chunks && scenario.source_chunks.length > 0 && (
              <div className="mt-3 text-xs text-gray-500 border-t pt-2">
                Source chunks: {scenario.source_chunks.length} references
              </div>
            )}
          </pre>
        )}
      </CardContent>
    </Card>
  );
};
