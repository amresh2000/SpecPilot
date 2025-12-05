import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useToast } from './ui/ToastContainer';
import { api } from '@/lib/api';
import type { PipelineStage } from '@/types';

interface GenerateMorePanelProps {
  jobId: string;
  stage: PipelineStage;
  contextIds?: string[];
  onGenerated: () => void;
  placeholder?: string;
}

export const GenerateMorePanel: React.FC<GenerateMorePanelProps> = ({
  jobId,
  stage,
  contextIds = [],
  onGenerated,
  placeholder = 'Enter additional instructions for generating more artifacts...',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const toast = useToast();

  const handleGenerate = async () => {
    if (!instructions.trim()) {
      toast.warning('Please provide instructions');
      return;
    }

    setIsGenerating(true);
    try {
      await api.generateMore(jobId, {
        stage,
        instructions: instructions.trim(),
        context_ids: contextIds,
      });

      toast.success('Generating additional artifacts...');
      setInstructions('');
      setIsExpanded(false);

      // Poll for updates every 3 seconds, up to 2 minutes
      let pollCount = 0;
      const maxPolls = 40; // 40 * 3 seconds = 2 minutes
      const pollInterval = setInterval(() => {
        pollCount++;
        onGenerated();

        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setIsGenerating(false);
          toast.info('Generation complete or taking longer than expected');
        }
      }, 3000);

      // Clear interval after first successful update
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsGenerating(false);
      }, 6000); // Stop polling after 6 seconds (2 polls)
    } catch (error) {
      toast.error('Failed to generate more artifacts');
      setIsGenerating(false);
    }
  };

  if (!isExpanded) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Need more artifacts?
            </h3>
            <p className="text-sm text-gray-600">
              Generate additional {stage === 'epics' ? 'epics and stories' : stage.replace('_', ' ')} based on your specific requirements
            </p>
          </div>
          <Button
            onClick={() => setIsExpanded(true)}
            variant="default"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Generate More
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Generate More Artifacts
      </h3>
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        disabled={isGenerating}
      />
      <div className="flex gap-3 mt-4">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !instructions.trim()}
          className="flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Generate
            </>
          )}
        </Button>
        <Button
          onClick={() => {
            setIsExpanded(false);
            setInstructions('');
          }}
          variant="outline"
          disabled={isGenerating}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};
