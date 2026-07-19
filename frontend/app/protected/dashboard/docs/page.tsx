'use client';

import { Suspense } from 'react';
import WorkspaceDocsListPage from './docs-inner';

export default function WorkspaceDocsRoute() {
  return (
    <Suspense fallback={<div className="page-container p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto" /></div>}>
      <WorkspaceDocsListPage />
    </Suspense>
  );
}
