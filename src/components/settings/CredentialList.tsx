"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { CredentialCard } from "./CredentialCard";
import { CredentialForm } from "./CredentialForm";
import type { ApiCredential } from "@prisma/client";

interface CredentialFormData {
  provider: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
  validate: boolean;
}

export function CredentialList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingCredential, setEditingCredential] = useState<ApiCredential | null>(null);


  // Fetch credentials
  const { data, isLoading, error } = useQuery({
    queryKey: ["credentials"],
    queryFn: async () => {
      const res = await fetch("/api/settings/credentials");
      if (!res.ok) throw new Error("Failed to fetch credentials");
      const json = await res.json();
      return json.data as ApiCredential[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (formData: CredentialFormData) => {
      const res = await fetch("/api/settings/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to create credential");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      setShowForm(false);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CredentialFormData }) => {
      const res = await fetch(`/api/settings/credentials/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to update credential");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      setEditingCredential(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/credentials/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to delete credential");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });

    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/credentials/${id}/validate`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to validate credential");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (credential: ApiCredential) => {
      const res = await fetch(`/api/settings/credentials/${credential.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: credential.provider,
          name: credential.name,
          isDefault: true,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to set default");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
    },
  });

  const handleCreate = async (formData: CredentialFormData) => {
    await createMutation.mutateAsync(formData);
  };

  const handleUpdate = async (formData: CredentialFormData) => {
    if (!editingCredential) return;
    await updateMutation.mutateAsync({ id: editingCredential.id, data: formData });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this credential?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleTest = (id: string) => {
    testMutation.mutate(id);
  };

  const handleSetDefault = (credential: ApiCredential) => {
    setDefaultMutation.mutate(credential);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
        <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-red-900 dark:text-red-100">Failed to load credentials</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  const credentials = data || [];

  return (
    <div className="space-y-4">
      {/* Credential List */}
      {credentials.length === 0 && !showForm && !editingCredential ? (
        <div className="text-center py-12 bg-muted rounded-lg border border-dashed border-border">
          <p className="text-secondary mb-4">No API providers configured yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus size={18} />
            Add Your First Provider
          </button>
        </div>
      ) : (
        <>
          {credentials.map((credential) => (
            <CredentialCard
              key={credential.id}
              credential={credential}
              onEdit={() => setEditingCredential(credential)}
              onDelete={() => handleDelete(credential.id)}
              onTest={() => handleTest(credential.id)}
              onSetDefault={() => handleSetDefault(credential)}
            />
          ))}

          {!showForm && !editingCredential && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-3 border-2 border-dashed border-border rounded-lg hover:bg-accent flex items-center justify-center gap-2 text-secondary hover:text-foreground"
            >
              <Plus size={18} />
              Add Provider
            </button>
          )}
        </>
      )}

      {/* Create Form */}
      {showForm && (
        <CredentialForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Edit Form */}
      {editingCredential && (
        <CredentialForm
          mode="edit"
          credential={editingCredential}
          onSubmit={handleUpdate}
          onCancel={() => setEditingCredential(null)}
        />
      )}
    </div>
  );
}
