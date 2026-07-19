'use client';

import { Suspense } from 'react';
import WorkspaceWhiteboardsListPage from './whiteboards-inner';

export default function WorkspaceWhiteboardsRoute() {
  return (
    <Suspense fallback={<div className="page-container p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto" /></div>}>
      <WorkspaceWhiteboardsListPage />
    </Suspense>
  );
}
