"use client";

import { useState, useRef, useEffect } from "react";
import {
  FolderOpen,
  FolderClosed,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Pencil,
} from "lucide-react";
import {
  useGroups,
  useCreateGroup,
  useRenameGroup,
  useDeleteGroup,
  type GroupNode,
} from "@/hooks/useGroups";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

export interface GroupSidebarProps {
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

interface GroupItemProps {
  group: GroupNode;
  depth: number;
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

function GroupItem({ group, depth, selectedGroupId, onGroupSelect }: GroupItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(group.name);
  const [showChildCreate, setShowChildCreate] = useState(false);
  const [childName, setChildName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<HTMLInputElement>(null);

  const rename = useRenameGroup();
  const deleteGroup = useDeleteGroup();
  const createGroup = useCreateGroup();

  const isSelected = selectedGroupId === group.id;
  const hasChildren = group.children.length > 0;

  useEffect(() => {
    if (editing && editRef.current) editRef.current.focus();
  }, [editing]);

  useEffect(() => {
    if (showChildCreate && childInputRef.current) childInputRef.current.focus();
  }, [showChildCreate]);

  function handleRenameSubmit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== group.name) {
      rename.mutate({ id: group.id, name: trimmed });
    }
    setEditing(false);
  }

  function handleDelete() {
    setShowDeleteConfirm(true);
  }

  function confirmDelete() {
    if (isSelected) onGroupSelect(null);
    deleteGroup.mutate(group.id);
    setShowDeleteConfirm(false);
  }

  function handleChildCreate() {
    const trimmed = childName.trim();
    if (!trimmed) return;
    createGroup.mutate(
      { name: trimmed, parentId: group.id },
      {
        onSuccess: () => {
          setChildName("");
          setShowChildCreate(false);
          setExpanded(true);
        },
      }
    );
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm select-none
          ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent text-foreground"}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (!editing) onGroupSelect(isSelected ? null : group.id);
        }}
        onDoubleClick={() => {
          setEditing(true);
          setEditValue(group.name);
        }}
      >
        {/* Expand toggle */}
        <button
          className="shrink-0 text-secondary hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="w-[14px] inline-block" />
          )}
        </button>

        {/* Folder icon */}
        <span className="shrink-0 text-secondary">
          {isSelected || expanded ? <FolderOpen size={14} /> : <FolderClosed size={14} />}
        </span>

        {/* Name or edit input */}
        {editing ? (
          <input
            ref={editRef}
            className="flex-1 bg-background border border-border rounded px-1 text-sm outline-none"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") { setEditing(false); setEditValue(group.name); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate">{group.name}</span>
        )}

        {/* Entry count badge */}
        {group.entryCount > 0 && (
          <span className="shrink-0 text-xs text-secondary bg-accent rounded-full px-1.5">
            {group.entryCount}
          </span>
        )}

        {/* Action buttons (visible on hover) */}
        {hovered && !editing && (
          <span className="shrink-0 flex items-center gap-0.5">
            {depth < 1 && (
              <button
                title="Add sub-group"
                className="p-0.5 rounded hover:bg-accent-foreground/20 text-secondary hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChildCreate(true);
                  setExpanded(true);
                }}
              >
                <Plus size={12} />
              </button>
            )}
            <button
              title="Rename"
              className="p-0.5 rounded hover:bg-accent-foreground/20 text-secondary hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
                setEditValue(group.name);
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              title="Delete"
              className="p-0.5 rounded hover:bg-danger/20 text-secondary hover:text-danger"
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            >
              <X size={12} />
            </button>
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && (
        <div>
          {group.children.map((child) => (
            <GroupItem
              key={child.id}
              group={child}
              depth={depth + 1}
              selectedGroupId={selectedGroupId}
              onGroupSelect={onGroupSelect}
            />
          ))}

          {/* Inline child create */}
          {showChildCreate && (
            <div
              className="flex items-center gap-1 px-2 py-1"
              style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
            >
              <span className="w-[14px] inline-block shrink-0" />
              <FolderClosed size={14} className="shrink-0 text-secondary" />
              <input
                ref={childInputRef}
                className="flex-1 bg-background border border-border rounded px-1 text-sm outline-none"
                placeholder="Sub-group name"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleChildCreate();
                  if (e.key === "Escape") { setShowChildCreate(false); setChildName(""); }
                }}
                onBlur={() => { if (!childName.trim()) { setShowChildCreate(false); setChildName(""); } }}
              />
              <button
                className="shrink-0 text-xs text-primary hover:underline"
                onClick={handleChildCreate}
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Group"
        description={`Delete group "${group.name}"? This will also delete all sub-groups.`}
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

export default function GroupSidebar({ selectedGroupId, onGroupSelect }: GroupSidebarProps) {
  const { data: groups, isLoading, isError } = useGroups();
  const createGroup = useCreateGroup();
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCreate && inputRef.current) inputRef.current.focus();
  }, [showCreate]);

  function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createGroup.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setNewName("");
          setShowCreate(false);
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold text-secondary uppercase tracking-wide">
          Groups
        </span>
        <button
          title="New group"
          className="p-0.5 rounded hover:bg-accent text-secondary hover:text-foreground"
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* All entries option */}
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm select-none
          ${selectedGroupId === null ? "bg-primary/10 text-primary" : "hover:bg-accent text-foreground"}`}
        onClick={() => onGroupSelect(null)}
      >
        <FolderOpen size={14} className="shrink-0 text-secondary" />
        <span>All entries</span>
      </div>

      {/* Inline top-level create */}
      {showCreate && (
        <div className="flex items-center gap-1 px-2 py-1">
          <FolderClosed size={14} className="shrink-0 text-secondary" />
          <input
            ref={inputRef}
            className="flex-1 bg-background border border-border rounded px-1 text-sm outline-none"
            placeholder="Group name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setShowCreate(false); setNewName(""); }
            }}
            onBlur={() => { if (!newName.trim()) { setShowCreate(false); setNewName(""); } }}
          />
          <button className="shrink-0 text-xs text-primary hover:underline" onClick={handleCreate}>
            Add
          </button>
        </div>
      )}

      {/* Group tree */}
      {isLoading && (
        <p className="px-2 py-1 text-xs text-secondary">Loading...</p>
      )}
      {isError && (
        <p className="px-2 py-1 text-xs text-danger">Failed to load groups</p>
      )}
      {!isLoading && !isError && groups && groups.length === 0 && !showCreate && (
        <div className="px-2 py-3 text-center">
          <p className="text-xs text-secondary mb-1">No groups yet</p>
          <button
            className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={12} /> Create one
          </button>
        </div>
      )}
      {!isLoading && !isError && groups && groups.map((group) => (
        <GroupItem
          key={group.id}
          group={group}
          depth={0}
          selectedGroupId={selectedGroupId}
          onGroupSelect={onGroupSelect}
        />
      ))}
    </div>
  );
}
