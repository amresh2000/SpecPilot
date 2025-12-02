import React, { useState } from 'react';
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react';

interface EditableListProps {
  items: string[];
  onUpdate: (items: string[]) => void;
  title?: string;
  addButtonText?: string;
}

export const EditableList: React.FC<EditableListProps> = ({
  items,
  onUpdate,
  title,
  addButtonText = 'Add Item',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<string[]>([...items]);
  const [newItem, setNewItem] = useState('');

  const handleStartEdit = () => {
    setEditedItems([...items]);
    setIsEditing(true);
  };

  const handleSave = () => {
    const validItems = editedItems.filter(item => item.trim() !== '');
    onUpdate(validItems);
    setIsEditing(false);
    setNewItem('');
  };

  const handleCancel = () => {
    setEditedItems([...items]);
    setIsEditing(false);
    setNewItem('');
  };

  const handleAddItem = () => {
    if (newItem.trim()) {
      setEditedItems([...editedItems, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemoveItem = (index: number) => {
    setEditedItems(editedItems.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, value: string) => {
    const updated = [...editedItems];
    updated[index] = value;
    setEditedItems(updated);
  };

  if (!isEditing) {
    return (
      <div className="group">
        {title && <h4 className="font-medium text-gray-700 mb-2">{title}</h4>}
        <div className="flex items-start gap-2">
          <ul className="flex-1 space-y-1">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleStartEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
            title="Edit list"
          >
            <Pencil className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {title && <h4 className="font-medium text-gray-700 mb-2">{title}</h4>}
      <div className="space-y-2">
        {editedItems.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => handleUpdateItem(index, e.target.value)}
              className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => handleRemoveItem(index)}
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
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
            placeholder="Add new item..."
            className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleAddItem}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            title="Add"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <Check className="w-4 h-4" />
            Save Changes
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
