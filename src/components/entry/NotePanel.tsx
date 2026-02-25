"use client";

import { useState } from "react";
import { useEntryNotes } from "@/hooks/useEntryNotes";

interface NotePanelProps {
  entryId: string;
}

export function NotePanel({ entryId }: NotePanelProps) {
  const { notes, isLoading, createNote } = useEntryNotes(entryId);
  const [noteContent, setNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setIsSubmitting(true);
    try {
      await createNote(noteContent.trim());
      setNoteContent("");
    } catch (error) {
      console.error("Failed to create note:", error);
      alert("Failed to create note");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-gray-500">Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          disabled={isSubmitting}
          placeholder="Add a note..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isSubmitting || !noteContent.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Adding..." : "Add Note"}
        </button>
      </form>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-gray-500 text-sm">No notes yet</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
