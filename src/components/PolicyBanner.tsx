import React, { useEffect, useState } from 'react';
import { useVariPoints } from '../hooks/useVariPoints';
import { Megaphone, X } from 'lucide-react';

export const PolicyBanner: React.FC = () => {
  const { announcements } = useVariPoints();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activePolicy, setActivePolicy] = useState<any | null>(null);

  useEffect(() => {
    // Find the latest active Policy announcement
    const policies = announcements.filter(a => a.type === 'Policy');
    if (policies.length === 0) {
      setActivePolicy(null);
      return;
    }

    // Sort by newest
    const latestPolicy = policies.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    // Check if dismissed in localStorage
    const dismissedIds = JSON.parse(localStorage.getItem('dismissed_policies') || '[]');
    if (!dismissedIds.includes(latestPolicy.id)) {
      setActivePolicy(latestPolicy);
    } else {
      setActivePolicy(null);
    }
  }, [announcements]);

  if (!activePolicy) return null;

  const handleDismiss = () => {
    const dismissedIds = JSON.parse(localStorage.getItem('dismissed_policies') || '[]');
    dismissedIds.push(activePolicy.id);
    localStorage.setItem('dismissed_policies', JSON.stringify(dismissedIds));
    setActivePolicy(null);
  };

  return (
    <div className="bg-gradient-to-r from-varistor-lime to-varistor-green text-white px-4 py-3 flex items-center justify-between shadow-md z-50 relative">
      <div className="flex items-center gap-3">
        <Megaphone size={20} className="animate-pulse" />
        <p className="text-sm font-semibold">
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider mr-2">New Policy</span>
          {activePolicy.title}
        </p>
      </div>
      <button 
        onClick={handleDismiss} 
        className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
        title="Dismiss"
      >
        <X size={18} />
      </button>
    </div>
  );
};
