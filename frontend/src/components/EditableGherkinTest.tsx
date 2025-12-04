import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Trash2 } from 'lucide-react';
import { useToast } from './ui/ToastContainer';
import { api } from '../lib/api';
import type { GherkinScenario } from '../types';

interface EditableGherkinTestProps {
  scenario: GherkinScenario;
  jobId: string;
  onUpdate: () => void;
}

export const EditableGherkinTest: React.FC<EditableGherkinTestProps> = ({ scenario, jobId, onUpdate }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete Gherkin scenario "${scenario.scenario_name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteTest(jobId, scenario.id, 'gherkin');
      toast.success('Gherkin test deleted successfully');
      onUpdate(); // Refresh data
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
          <CardTitle className="text-lg">Feature: {scenario.feature_name}</CardTitle>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="Delete Gherkin test"
          >
            <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent>
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
        </pre>
      </CardContent>
    </Card>
  );
};
