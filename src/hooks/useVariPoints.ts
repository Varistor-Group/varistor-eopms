import { useContext } from 'react';
import { EopmsContext } from '../context/EopmsContext';

export const useVariPoints = () => {
  const context = useContext(EopmsContext);
  if (!context) {
    throw new Error('useVariPoints must be used within an EopmsProvider');
  }
  
  return {
    ledger: context.ledger,
    toasts: context.toasts,
    pointsBalance: context.pointsBalance,
    currentRole: context.currentRole,
    setCurrentRole: context.setCurrentRole,
    assertAdministrativePenalty: context.assertAdministrativePenalty,
    addToast: context.addToast,
    dismissToast: context.dismissToast,
    announcements: context.announcements,
    reactToAnnouncement: context.reactToAnnouncement,
    readAnnouncement: context.readAnnouncement,
    addAnnouncement: context.addAnnouncement,
  };
};
