import { useContext } from 'react';
import { EopmsContext } from '../context/EopmsContext';

export const useKanbanTasks = () => {
  const context = useContext(EopmsContext);
  if (!context) {
    throw new Error('useKanbanTasks must be used within an EopmsProvider');
  }
  
  return {
    tasks: context.tasks,
    currentRole: context.currentRole,
    currentUser: context.currentUser,
    moveTask: context.moveTask,
    approveTask: context.approveTask,
    rejectTask: context.rejectTask,
    createTask: context.createTask,
    requestTask: context.requestTask,
    approveTaskRequest: context.approveTaskRequest,
    rejectTaskRequest: context.rejectTaskRequest,
    cancelTaskRequest: context.cancelTaskRequest,
    updateTaskDetails: context.updateTaskDetails,
    addComment: context.addComment,
    toggleChecklistItem: context.toggleChecklistItem,
    addChecklistItem: context.addChecklistItem,
    addAttachment: context.addAttachment,
  };
};
