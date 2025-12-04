import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Trash2 } from 'lucide-react';
import { useToast } from './ui/ToastContainer';
import { api } from '../lib/api';
import type { FunctionalTest } from '../types';

interface EditableFunctionalTestProps {
  test: FunctionalTest;
  jobId: string;
  onUpdate: () => void;
}

export const EditableFunctionalTest: React.FC<EditableFunctionalTestProps> = ({ test, jobId, onUpdate }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete functional test "${test.title}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteTest(jobId, test.id, 'functional');
      toast.success('Functional test deleted successfully');
      onUpdate(); // Refresh data
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
          <CardTitle className="text-lg">{test.title}</CardTitle>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="Delete functional test"
          >
            <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
};
