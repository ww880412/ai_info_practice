"use client";

import { useState } from "react";
import { useToast } from "@/components/common/Toast";

interface TagEditorProps {
  tags: string[];
  onSave: (newTags: string[]) => Promise<void>;
  className?: string;
}

export function TagEditor({ tags, onSave, className = "" }: TagEditorProps) {
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const handleAddTag = async () => {
    const newTag = inputValue.trim();
    if (!newTag || localTags.includes(newTag)) {
      setInputValue("");
      return;
    }

    const updatedTags = [...localTags, newTag];
    setLocalTags(updatedTags);
    setInputValue("");

    setIsSaving(true);
    try {
      await onSave(updatedTags);
    } catch (error) {
      console.error("Failed to add tag:", error);
      setLocalTags(localTags);
      showToast("error", "Failed to add tag");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = localTags.filter((t) => t !== tagToRemove);
    setLocalTags(updatedTags);

    setIsSaving(true);
    try {
      await onSave(updatedTags);
    } catch (error) {
      console.error("Failed to remove tag:", error);
      setLocalTags(localTags);
      showToast("error", "Failed to remove tag");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2 mb-2">
        {localTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
          >
            {tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              disabled={isSaving}
              className="hover:text-blue-600 disabled:opacity-50"
              title="Remove tag"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          placeholder="Add a tag..."
          className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAddTag}
          disabled={isSaving || !inputValue.trim()}
          className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
}
