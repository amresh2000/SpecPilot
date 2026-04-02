import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Edit2, Check, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from './ui/ToastContainer';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import type { GherkinScenario } from '../types';

interface EditableGherkinTestProps {
  scenario: GherkinScenario;
  jobId: string;
  onUpdate: () => void;
}

// ── Shared editable list helper ───────────────────────────────────────────────

const EditableClauseList: React.FC<{
  keyword: string;
  keywordColor: string;
  items: string[];
  newValue: string;
  onNewValueChange: (v: string) => void;
  onAdd: () => void;
  onUpdate: (i: number, v: string) => void;
  onRemove: (i: number) => void;
}> = ({ keyword, keywordColor, items, newValue, onNewValueChange, onAdd, onUpdate, onRemove }) => (
  <div className="space-y-1.5">
    {items.map((item, i) => (
      <div key={i} className="flex items-center gap-2">
        <span className={`text-xs font-bold shrink-0 w-10 ${keywordColor}`}>{keyword}</span>
        <Input
          value={item}
          onChange={e => onUpdate(i, e.target.value)}
          className="flex-1 text-xs h-7"
        />
        <button
          onClick={() => onRemove(i)}
          className="p-1 text-neutral-400 hover:text-red-500 rounded transition-colors shrink-0"
          aria-label={`Remove ${keyword} statement`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold shrink-0 w-10 opacity-50 ${keywordColor}`}>{keyword}</span>
      <Input
        value={newValue}
        onChange={e => onNewValueChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAdd()}
        placeholder={`Add ${keyword.toLowerCase()} statement…`}
        className="flex-1 text-xs h-7"
      />
      <button
        onClick={onAdd}
        className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 shrink-0"
        aria-label={`Add ${keyword} statement`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ── Keyword token for display mode ────────────────────────────────────────────

const Keyword: React.FC<{ word: string; color: string }> = ({ word, color }) => (
  <span className={`font-bold text-xs mr-1 ${color}`}>{word}</span>
);

// ── Main component ────────────────────────────────────────────────────────────

export const EditableGherkinTest: React.FC<EditableGherkinTestProps> = ({ scenario, jobId, onUpdate }) => {
  const [isEditMode,         setIsEditMode]         = useState(false);
  const [editedFeatureName,  setEditedFeatureName]  = useState(scenario.feature_name);
  const [editedScenarioName, setEditedScenarioName] = useState(scenario.scenario_name);
  const [editedGiven,        setEditedGiven]        = useState<string[]>(scenario.given);
  const [editedWhen,         setEditedWhen]         = useState<string[]>(scenario.when);
  const [editedThen,         setEditedThen]         = useState<string[]>(scenario.then);
  const [newGiven,           setNewGiven]           = useState('');
  const [newWhen,            setNewWhen]            = useState('');
  const [newThen,            setNewThen]            = useState('');
  const [isSaving,           setIsSaving]           = useState(false);
  const [isDeleting,         setIsDeleting]         = useState(false);
  const toast     = useToast();
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const makeListHandlers = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    newVal: string,
    setNewVal: React.Dispatch<React.SetStateAction<string>>,
  ) => ({
    items:    list,
    newValue: newVal,
    onNewValueChange: setNewVal,
    onAdd:    () => { if (newVal.trim()) { setList(p => [...p, newVal.trim()]); setNewVal(''); } },
    onUpdate: (i: number, v: string) => setList(p => p.map((x, idx) => idx === i ? v : x)),
    onRemove: (i: number) => setList(p => p.filter((_, idx) => idx !== i)),
  });

  const handleEnterEdit = () => {
    setIsEditMode(true);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  };

  const handleCancel = () => {
    setEditedFeatureName(scenario.feature_name);
    setEditedScenarioName(scenario.scenario_name);
    setEditedGiven(scenario.given);
    setEditedWhen(scenario.when);
    setEditedThen(scenario.then);
    setNewGiven(''); setNewWhen(''); setNewThen('');
    setIsEditMode(false);
    editBtnRef.current?.focus();
  };

  const handleSave = async () => {
    if (!editedFeatureName.trim() || !editedScenarioName.trim()) {
      toast.error('Feature name and scenario name are required');
      return;
    }
    const vGiven = editedGiven.filter(s => s.trim());
    const vWhen  = editedWhen.filter(s => s.trim());
    const vThen  = editedThen.filter(s => s.trim());
    if (!vGiven.length || !vWhen.length || !vThen.length) {
      toast.error('At least one Given, When, and Then statement are required');
      return;
    }
    setIsSaving(true);
    try {
      await api.updateGherkinTest(jobId, scenario.id, editedFeatureName.trim(), editedScenarioName.trim(), vGiven, vWhen, vThen);
      toast.success('Gherkin test updated');
      setIsEditMode(false);
      onUpdate();
    } catch {
      toast.error('Failed to update Gherkin test');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete Gherkin scenario "${scenario.scenario_name}"?`)) return;
    setIsDeleting(true);
    try {
      await api.deleteTest(jobId, scenario.id, 'gherkin');
      toast.success('Gherkin test deleted');
      onUpdate();
    } catch {
      toast.error('Failed to delete Gherkin test');
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {isEditMode ? (
              <div className="space-y-2 pr-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Feature Name</label>
                  <Input ref={firstInputRef} value={editedFeatureName} onChange={e => setEditedFeatureName(e.target.value)} placeholder="Feature name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Scenario Name</label>
                  <Input value={editedScenarioName} onChange={e => setEditedScenarioName(e.target.value)} placeholder="Scenario name" />
                </div>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-0.5">Feature</p>
                <CardTitle className="text-sm truncate">{scenario.feature_name}</CardTitle>
              </>
            )}
          </div>
          {!isEditMode && (
            <div className="flex gap-1 ml-3 shrink-0">
              <button
                ref={editBtnRef}
                onClick={handleEnterEdit}
                disabled={isDeleting}
                className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                aria-label="Edit Gherkin test"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                aria-label="Delete Gherkin test"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isEditMode ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Given</p>
              <EditableClauseList keyword="Given" keywordColor="text-emerald-600"
                {...makeListHandlers(editedGiven, setEditedGiven, newGiven, setNewGiven)} />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">When</p>
              <EditableClauseList keyword="When" keywordColor="text-amber-600"
                {...makeListHandlers(editedWhen, setEditedWhen, newWhen, setNewWhen)} />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Then</p>
              <EditableClauseList keyword="Then" keywordColor="text-indigo-500"
                {...makeListHandlers(editedThen, setEditedThen, newThen, setNewThen)} />
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
          /* ── Display mode: code-block style ── */
          <div className="rounded-lg bg-neutral-900 px-4 py-3 font-mono text-xs leading-6 overflow-x-auto">
            <p className="text-neutral-400 mb-1">
              <span className="text-violet-400 font-semibold">Scenario:</span>{' '}
              <span className="text-neutral-100">{scenario.scenario_name}</span>
            </p>
            <div className="space-y-0.5 mt-2">
              {scenario.given.map((g, i) => (
                <p key={i} className="text-neutral-300">
                  <Keyword word={i === 0 ? 'Given' : 'And'} color="text-emerald-400" />
                  {g}
                </p>
              ))}
              {scenario.when.map((w, i) => (
                <p key={i} className="text-neutral-300">
                  <Keyword word={i === 0 ? 'When' : 'And'} color="text-amber-400" />
                  {w}
                </p>
              ))}
              {scenario.then.map((t, i) => (
                <p key={i} className="text-neutral-300">
                  <Keyword word={i === 0 ? 'Then' : 'And'} color="text-indigo-400" />
                  {t}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
