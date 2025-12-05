import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StageProgressIndicator } from '@/components/StageProgressIndicator';
import { api } from '@/lib/api';
import type { StatusResponse, CodeTreeNode } from '@/types';
import { Loader2, ChevronRight, ChevronDown, File, Folder, Download, ArrowLeft, ArrowRight } from 'lucide-react';

export const CodeSkeletonPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<CodeTreeNode | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;

    const fetchStatus = async () => {
      try {
        const data = await api.getStatus(jobId);
        setStatus(data);
        setLoading(false);

        // Auto-expand root folders
        if (data.results.code_tree.length > 0) {
          const rootFolders = data.results.code_tree
            .filter((node) => node.type === 'folder')
            .map((node) => node.name);
          setExpandedFolders(new Set(rootFolders));
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
        setLoading(false);
      }
    };

    fetchStatus();
  }, [jobId]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderTree = (nodes: CodeTreeNode[], parentPath: string = '') => {
    return (
      <div className="space-y-1">
        {nodes.map((node, index) => {
          const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
          const isExpanded = expandedFolders.has(currentPath);

          return (
            <div key={index}>
              {node.type === 'folder' ? (
                <>
                  <button
                    onClick={() => toggleFolder(currentPath)}
                    className="flex items-center space-x-2 w-full px-2 py-1 rounded hover:bg-gray-100 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <Folder className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">{node.name}</span>
                  </button>
                  {isExpanded && node.children && (
                    <div className="ml-6">
                      {renderTree(node.children, currentPath)}
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setSelectedFile(node)}
                  className={`flex items-center space-x-2 w-full px-2 py-1 rounded hover:bg-gray-100 text-left ${
                    selectedFile?.path === node.path ? 'bg-blue-50' : ''
                  }`}
                >
                  <File className="w-4 h-4 text-gray-400 ml-6" />
                  <span className="text-sm">{node.name}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!status || !status.results.code_tree || status.results.code_tree.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Code skeleton not available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Code Skeleton</h1>
          <p className="text-gray-600">
            Generated Java Selenium + Cucumber test automation framework
          </p>
        </div>

        {/* Stage Progress */}
        <StageProgressIndicator
          currentStage={status.current_stage || 'code_generation'}
          stageHistory={status.stage_history}
        />

        {/* Action Buttons */}
        <div className="flex gap-4 justify-between mb-6">
          <Button
            variant="outline"
            onClick={() => navigate(`/gherkin-tests/${jobId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Gherkin Tests
          </Button>
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => window.open(api.getDownloadUrl(jobId!), '_blank')}
            >
              <Download className="w-4 h-4 mr-2" />
              Download ZIP
            </Button>
            <Button
              variant="default"
              onClick={() => navigate(`/summary/${jobId}`)}
            >
              View Summary
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex rounded-lg overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 400px)' }}>
        {/* Left: Tree View */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Project Files</h2>
            <p className="text-sm text-gray-600">{status.results.project_name}</p>
          </div>
          <div className="p-4">{renderTree(status.results.code_tree)}</div>
        </div>

        {/* Right: File Preview */}
        <div className="flex-1 overflow-y-auto">
          {selectedFile ? (
            <div className="h-full">
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center space-x-2">
                  <File className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900">{selectedFile.name}</h3>
                </div>
                <p className="text-sm text-gray-600 mt-1">{selectedFile.path}</p>
              </div>
              <div className="p-6">
                <Card>
                  <CardContent className="p-0">
                    <pre className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto">
                      <code>{selectedFile.content}</code>
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Select a file to view its contents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
};
