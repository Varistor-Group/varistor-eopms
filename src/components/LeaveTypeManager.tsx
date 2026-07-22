import React, { useState, useEffect } from 'react';
import { getLeaveTypes, createLeaveType, deleteLeaveType } from '../api/leaves';
import type { LeaveTypeModel } from '../types';

export const LeaveTypeManager: React.FC = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultAllocation, setDefaultAllocation] = useState<number>(0);
  const [message, setMessage] = useState('');

  const fetchLeaveTypes = async () => {
    setLoading(true);
    const types = await getLeaveTypes();
    setLeaveTypes(types);
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!name.trim()) return;

    const newType = await createLeaveType({
      name,
      description,
      default_allocation: defaultAllocation,
    });

    if (newType) {
      setMessage('Leave type created successfully.');
      setName('');
      setDescription('');
      setDefaultAllocation(0);
      fetchLeaveTypes();
    } else {
      setMessage('Error creating leave type. Ensure the name is unique.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}? This might break existing balances tied to it.`)) {
      const success = await deleteLeaveType(id);
      if (success) {
        setMessage(`Deleted ${name} successfully.`);
        fetchLeaveTypes();
      } else {
        setMessage(`Error deleting ${name}.`);
      }
    }
  };

  return (
    <div className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor">
      <h3 className="text-lg font-bold text-varistor-dark mb-4">Custom Leave Types</h3>
      
      <div className="mb-6 border-b border-varistor-border pb-6">
        <h4 className="text-sm font-bold text-varistor-muted mb-3 uppercase">Create New Type</h4>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-bold text-varistor-muted mb-1.5 uppercase">Leave Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-varistor-border rounded px-3 py-2 bg-varistor-surface focus:outline-none focus:ring-1 focus:ring-varistor-lime"
              placeholder="e.g. Maternity Leave"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-varistor-muted mb-1.5 uppercase">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full text-sm border border-varistor-border rounded px-3 py-2 bg-varistor-surface focus:outline-none focus:ring-1 focus:ring-varistor-lime"
              placeholder="Description of the policy..."
              rows={2}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-varistor-muted mb-1.5 uppercase">Default Yearly Allocation (Days)</label>
            <input
              type="number"
              min="0"
              value={defaultAllocation}
              onChange={e => setDefaultAllocation(Number(e.target.value))}
              className="w-full text-sm border border-varistor-border rounded px-3 py-2 bg-varistor-surface focus:outline-none focus:ring-1 focus:ring-varistor-lime"
              required
            />
          </div>
          
          {message && (
            <div className={`p-3 rounded text-xs font-semibold ${message.includes('Error') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            className="px-4 py-2 bg-varistor-lime text-white rounded-lg hover:bg-[#65a30d] text-sm font-semibold transition-colors"
          >
            Create Leave Type
          </button>
        </form>
      </div>

      <div>
        <h4 className="text-sm font-bold text-varistor-muted mb-3 uppercase">Existing Leave Types</h4>
        {loading ? (
          <div className="text-sm text-varistor-muted">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-varistor-pageBg border-b border-varistor-border text-xs text-varistor-muted uppercase">
                <tr>
                  <th className="px-4 py-2 font-bold">Name</th>
                  <th className="px-4 py-2 font-bold">Description</th>
                  <th className="px-4 py-2 font-bold">Default Allocation</th>
                  <th className="px-4 py-2 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map(lt => (
                  <tr key={lt.id} className="border-b border-varistor-border last:border-0 hover:bg-varistor-pageBg">
                    <td className="px-4 py-3 font-semibold">{lt.name}</td>
                    <td className="px-4 py-3 text-varistor-muted">{lt.description}</td>
                    <td className="px-4 py-3">{lt.default_allocation} days</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => handleDelete(lt.id, lt.name)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {leaveTypes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-varistor-muted">No custom leave types found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
