import { Suspense } from "react";
import LibraryPageClient from "./LibraryPageClient";

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="text-sm text-secondary">Loading library...</div>}>
      <LibraryPageClient />
    </Suspense>
  );
}
