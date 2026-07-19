'use client';

import { Suspense } from 'react';
import TicketBoardPage from './board-inner';

export default function TicketBoardRoute() {
  return (
    <Suspense fallback={<div className="page-container p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto" /></div>}>
      <TicketBoardPage />
    </Suspense>
  );
}
