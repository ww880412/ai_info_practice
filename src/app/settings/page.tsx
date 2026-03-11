"use client";

import { CredentialList } from "@/components/settings/CredentialList";

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-secondary mt-1">Manage your AI provider credentials</p>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">AI Providers</h2>
        <CredentialList />
      </section>
    </div>
  );
}
