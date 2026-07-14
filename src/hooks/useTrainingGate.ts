import { useCallback, useEffect, useState } from 'react';
import { trainingApi } from '../api/training';
import type { UserRole } from '../types';

interface TrainingGateResult {
  /** True while the employee still has incomplete required training and must be confined to the Training tab. */
  locked: boolean;
  loading: boolean;
  refresh: () => void;
}

// HR/Admin manage training themselves and must never be locked out of the app by it.
const EXEMPT_ROLES: UserRole[] = ['HR', 'Admin'];

export function useTrainingGate(employeeId: string | undefined, role: UserRole | undefined): TrainingGateResult {
  const exempt = !role || EXEMPT_ROLES.includes(role);
  // Optimistic default (unlocked) avoids flashing a lockout for already-compliant users while the
  // first fetch is in flight; a genuinely incomplete employee gets redirected the moment it resolves.
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(!exempt);

  const refresh = useCallback(() => {
    if (exempt || !employeeId) {
      setLocked(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    trainingApi
      .fetchModulesWithStatus(employeeId, role)
      .then(modules => {
        const allComplete = modules.length === 0 || modules.every(m => m.status === 'completed');
        setLocked(!allComplete);
      })
      .finally(() => setLoading(false));
  }, [employeeId, role, exempt]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { locked, loading, refresh };
}
