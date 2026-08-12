import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function StoreManagerInsightsScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/store_manager');
  }, []);

  return null;
}
