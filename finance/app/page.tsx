'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('finance_token');
    if (token) {
      router.push('/finance');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-moss border-t-transparent animate-spin"></div>
        <p className="text-moss font-medium">Loading SahYogi Finance...</p>
      </div>
    </div>
  );
}
