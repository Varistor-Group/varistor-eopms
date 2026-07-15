import React, { useState, useEffect } from 'react';
import { getAllEmployeeBalances, updateEmployeeBalance, getLeaveTypes } from '../api/leaves';
import type { EmployeeLeaveBalance, LeaveTypeModel } from '../types';

export const LeaveBalanceManager: React.FC = () => {
  const [balances, setBalances] = useState<EmployeeLeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTotal, setEditTotal] = useState<number>(0);
  const [editUsed, setEditUsed] = useState<number>(0);
  
  // New balance state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newLeaveType, setNewLeaveType] = useState('');
  const [newTotal, setNewTotal] = useState<number>(0);

  const fetchData = async () => {
    setLoading(true);
    const [bals, types] = await Promise.all([
      getAllEmployeeBalances(),
      getLeaveTypes()
    ]);
    setBalances(bals);
    setLeaveTypes(types);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveEdit = async (bal: EmployeeLeaveBalance) => {
    await updateEmployeeBalance(bal.employee_id, bal.leave_type_name, editTotal, editUsed);
    setEditingId(null);
    fetchData();
  };

  const handleAddNewBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeId || !newLeaveType) return;
    
    await updateEmployeeBalance(newEmployeeId, newLeaveType, newTotal, 0);
    setShowAddForm(false);
    setNewEmployeeId('');
    setNewLeaveType('');
    setNewTotal(0);
    fetchData();
  };

  return (
    <div className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor">
      <div className="flex justify-between items-center mb-6 border-b border-varistor-border pb-4">
        <h3 className="text-lg font-bold text-varistor-dark">Employee Leave Balances</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-varistor-dark text-white rounded-lg hover:bg-gray-800 text-sm font-semibold transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Add Employee Balance'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddNewBalance} className="mb-6 bg-varistor-surfaceMuted p-4 rounded-lg border border-varistor-border flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-varistor-muted mb-1.5 uppercase">Employee ID</label>
            <input
              type="text"
              value={newEmployeeId}
              onChange={e => setNewEmployeeId(e.target.value)}
              className="w-full text-sm border border-varistor-border rounded px-3 py-2 bg-varistor-surface"
              placeholder="e.g. VAR-024"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-varistor-muted mb-1.5 uppercase">Leave Type</label>
            <select
              value={newLeaveType}
              onChange={e => {
                setNewLeaveType(e.target.value);
                const t = leaveTypes.find(lt => lt.name === e.target.value);
                if (t) setNewTotal(t.default_allocation);
              }}
              className="w-full text-sm border border-varistor-border rounded px-3 py-2 bg-varistor-surface"
              required
            >
              <option value="">Select Type</option>
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.name}>{lt.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-varistor-muted mb-1.5 uppercase">Total Allocation</label>
            <input
              type="number"
              min="0"
              value={newTotal}
              onChange={e => setNewTotal(Number(e.target.value))}
              className="w-full text-sm border border-varistor-border rounded px-3 py-2 bg-varistor-surface"
              required
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-varistor-lime text-white rounded hover:bg-[#65a30d] text-sm font-semibold h-10">
            Save
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-varistor-muted">Loading balances...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-varistor-pageBg border-b border-varistor-border text-xs text-varistor-muted uppercase">
              <tr>
                <th className="px-4 py-2 font-bold">Employee ID</th>
                <th className="px-4 py-2 font-bold">Leave Type</th>
                <th className="px-4 py-2 font-bold text-center">Total Allocated</th>
                <th className="px-4 py-2 font-bold text-center">Days Used</th>
                <th className="px-4 py-2 font-bold text-center">Remaining</th>
                <th className="px-4 py-2 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {balances.map(bal => {
                const isEditing = editingId === bal.id;
                return (
                  <tr key={bal.id} className="border-b border-varistor-border hover:bg-varistor-pageBg">
                    <td className="px-4 py-3 font-semibold">{bal.employee_id}</td>
                    <td className="px-4 py-3 text-varistor-muted">{bal.leave_type_name}</td>
                    
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input type="number" className="w-16 border border-varistor-border bg-varistor-surface rounded px-1 text-center" value={editTotal} onChange={e => setEditTotal(Number(e.target.value))} />
                      ) : (
                        bal.total
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input type="number" className="w-16 border border-varistor-border bg-varistor-surface rounded px-1 text-center" value={editUsed} onChange={e => setEditUsed(Number(e.target.value))} />
                      ) : (
                        bal.used
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-varistor-dark">
                      {(isEditing ? editTotal : bal.total) - (isEditing ? editUsed : bal.used)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-800">Cancel</button>
                          <button onClick={() => handleSaveEdit(bal)} className="text-xs text-varistor-lime hover:text-[#65a30d] font-bold">Save</button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setEditingId(bal.id);
                            setEditTotal(bal.total);
                            setEditUsed(bal.used);
                          }} 
                          className="text-xs text-blue-500 hover:text-blue-700 font-semibold"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {balances.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-varistor-muted">No balances recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
