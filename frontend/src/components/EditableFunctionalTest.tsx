import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Edit2, Check, X, Plus, Trash2 } from 'lucide-react';
import { useToast } from './ui/ToastContainer';
import { api } from '../lib/api';
import type { FunctionalTest } from '../types';

interface EditableFunctionalTestProps {
  test: FunctionalTest;
  jobId: string;
  onUpdate: () => void;
}

export const EditableFunctionalTest: React.FC<EditableFunctionalTestProps> = ({ test, jobId, onUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTitle, setEditedTitle] = useState(test.title);
  const [editedObjective, setEditedObjective] = useState(test.objective);
  const [editedPreconditions, setEditedPreconditions] = useState<string[]>(test.preconditions);
  const [editedTestSteps, setEditedTestSteps] = useState<string[]>(test.test_steps);
  const [editedExpectedResults, setEditedExpectedResults] = useState<string[]>(test.expected_results);
  const [newPrecondition, setNewPrecondition] = useState('');
  const [newTestStep, setNewTestStep] = useState('');
  const [newExpectedResult, setNewExpectedResult] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  const handleAddPrecondition = () => {
    if (newPrecondition.trim()) {
      setEditedPreconditions([...editedPreconditions, newPrecondition.trim()]);
      setNewPrecondition('');
    }
  };

  const handleRemovePrecondition = (index: number) => {
    setEditedPreconditions(editedPreconditions.filter((_, i) => i !== index));
  };

  const handleUpdatePrecondition = (index: number, value: string) => {
    const updated = [...editedPreconditions];
    updated[index] = value;
    setEditedPreconditions(updated);
  };

  const handleAddTestStep = () => {
    if (newTestStep.trim()) {
      setEditedTestSteps([...editedTestSteps, newTestStep.trim()]);
      setNewTestStep('');
    }
  };

  const handleRemoveTestStep = (index: number) => {
    setEditedTestSteps(editedTestSteps.filter((_, i) => i !== index));
  };

  const handleUpdateTestStep = (index: number, value: string) => {
    const updated = [...editedTestSteps];
    updated[index] = value;
    setEditedTestSteps(updated);
  };

  const handleAddExpectedResult = () => {
    if (newExpectedResult.trim()) {
      setEditedExpectedResults([...editedExpectedResults, newExpectedResult.trim()]);
      setNewExpectedResult('');
    }
  };

  const handleRemoveExpectedResult = (index: number) => {
    setEditedExpectedResults(editedExpectedResults.filter((_, i) => i !== index));
  };

  const handleUpdateExpectedResult = (index: number, value: string) => {
    const updated = [...editedExpectedResults];
    updated[index] = value;
    setEditedExpectedResults(updated);
  };

  const handleSave = async () => {
    if (!editedTitle.trim() || !editedObjective.trim()) {
      toast.error('Title and objective are required');
      return;
    }

    const validPreconditions = editedPreconditions.filter((p) => p.trim() !== '');
    const validTestSteps = editedTestSteps.filter((s) => s.trim() !== '');
    const validExpectedResults = editedExpectedResults.filter((r) => r.trim() !== '');

    if (validPreconditions.length === 0 || validTestSteps.length === 0 || validExpectedResults.length === 0) {
      toast.error('At least one precondition, test step, and expected result are required');
      return;
    }

    setIsSaving(true);
    try {
      await api.updateFunctionalTest(
        jobId,
        test.id,
        editedTitle.trim(),
        editedObjective.trim(),
        validPreconditions,
        validTestSteps,
        validExpectedResults
      );

      toast.success('Functional test updated successfully');
      setIsEditMode(false);
      onUpdate();
    } catch (error) {
      toast.error('Failed to update functional test');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedTitle(test.title);
    setEditedObjective(test.objective);
    setEditedPreconditions(test.preconditions);
    setEditedTestSteps(test.test_steps);
    setEditedExpectedResults(test.expected_results);
    setNewPrecondition('');
    setNewTestStep('');
    setNewExpectedResult('');
    setIsEditMode(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete functional test "${test.title}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteTest(jobId, test.id, 'functional');
      toast.success('Functional test deleted successfully');
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete functional test');
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
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full font-semibold text-lg p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Test title"
              />
            ) : (
              <CardTitle className="text-lg">{test.title}</CardTitle>
            )}
          </div>
          {!isEditMode && (
            <div className="flex gap-2 ml-2">
              <button
                onClick={() => setIsEditMode(true)}
                disabled={isDeleting}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                title="Edit functional test"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Delete functional test"
              >
                <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditMode ? (
          <div className="space-y-4">
            {/* Objective */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objective</label>
              <textarea
                value={editedObjective}
                onChange={(e) => setEditedObjective(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                placeholder="Test objective"
              />
            </div>

            {/* Preconditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preconditions</label>
              <div className="space-y-2">
                {editedPreconditions.map((precondition, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <input
                      type="text"
                      value={precondition}
                      onChange={(e) => handleUpdatePrecondition(index, e.target.value)}
                      className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleRemovePrecondition(index)}
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
                    value={newPrecondition}
                    onChange={(e) => setNewPrecondition(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPrecondition()}
                    placeholder="Add new precondition..."
                    className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddPrecondition}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    title="Add"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Test Steps */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Test Steps</label>
              <div className="space-y-2">
                {editedTestSteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-sm text-gray-500 mt-2">{index + 1}.</span>
                    <input
                      type="text"
                      value={step}
                      onChange={(e) => handleUpdateTestStep(index, e.target.value)}
                      className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleRemoveTestStep(index)}
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
                    value={newTestStep}
                    onChange={(e) => setNewTestStep(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTestStep()}
                    placeholder="Add new test step..."
                    className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddTestStep}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    title="Add"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Expected Results */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expected Results</label>
              <div className="space-y-2">
                {editedExpectedResults.map((result, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <input
                      type="text"
                      value={result}
                      onChange={(e) => handleUpdateExpectedResult(index, e.target.value)}
                      className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleRemoveExpectedResult(index)}
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
                    value={newExpectedResult}
                    onChange={(e) => setNewExpectedResult(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddExpectedResult()}
                    placeholder="Add new expected result..."
                    className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddExpectedResult}
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
            <div>
              <p className="text-sm font-medium text-gray-700">Objective:</p>
              <p className="text-sm text-gray-600">{test.objective}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Preconditions:</p>
              <ul className="list-disc list-inside space-y-1">
                {test.preconditions.map((pc, idx) => (
                  <li key={idx} className="text-sm text-gray-600">
                    {pc}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Test Steps:</p>
              <ol className="list-decimal list-inside space-y-1">
                {test.test_steps.map((step, idx) => (
                  <li key={idx} className="text-sm text-gray-600">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Expected Results:</p>
              <ul className="list-disc list-inside space-y-1">
                {test.expected_results.map((result, idx) => (
                  <li key={idx} className="text-sm text-gray-600">
                    {result}
                  </li>
                ))}
              </ul>
            </div>
            {test.source_chunks && test.source_chunks.length > 0 && (
              <div className="text-xs text-gray-500 pt-2 border-t">
                Source chunks: {test.source_chunks.length} references
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
