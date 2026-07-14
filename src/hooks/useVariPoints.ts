import { useContext } from 'react';
import { EopmsContext } from '../context/EopmsContext';

export const useVariPoints = () => {
  const context = useContext(EopmsContext);
  if (!context) {
    throw new Error('useVariPoints must be used within an EopmsProvider');
  }
  
  return context;
};
