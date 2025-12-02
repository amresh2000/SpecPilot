import React, { useState, useEffect } from 'react';
import { Check, X, Pencil } from 'lucide-react';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

export const EditableText: React.FC<EditableTextProps> = ({
  value,
  onSave,
  multiline = false,
  placeholder = '',
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(value);

  useEffect(() => {
    setEditedValue(value);
  }, [value]);

  const handleSave = () => {
    if (editedValue.trim() !== value) {
      onSave(editedValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedValue(value);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className={`group relative ${className}`}>
        <div className="flex items-start gap-2">
          <span className="flex-1">{value}</span>
          <button
            onClick={() => setIsEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
            title="Edit"
          >
            <Pencil className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {multiline ? (
        <textarea
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          placeholder={placeholder}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={4}
          autoFocus
        />
      ) : (
        <input
          type="text"
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          placeholder={placeholder}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
      )}
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
        >
          <Check className="w-4 h-4" />
          Save
        </button>
        <button
          onClick={handleCancel}
          className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
};
