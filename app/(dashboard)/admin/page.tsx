'use client';
import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/shared/Input';
import { Button } from '@/components/shared/Button';
import { createEmployee } from '@/lib/mock/employees';

export default function AdminPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    employeeId: '',
    username: '',
    personalEmail: '',
    phone: '',
    department: '',
    reportingManager: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ show: boolean, message: string }>({ show: false, message: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await createEmployee(formData);
      
      // Reset form
      setFormData({
        fullName: '', employeeId: '', username: '', personalEmail: '',
        phone: '', department: '', reportingManager: ''
      });
      
      // Show Toast
      setToast({ show: true, message: 'Employee credentials created and sent.' });
      setTimeout(() => setToast({ show: false, message: '' }), 4000);
      
    } catch (err) {
      alert('Error creating employee');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto relative pb-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-brand-ink">Create new employee</h1>
        <div className="px-3 py-1 bg-[#1a4d2e] text-white text-xs font-semibold rounded-full">
          Admin only
        </div>
      </div>

      <div className="bg-white rounded-[12px] p-6 lg:p-8 border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input 
            label="Full name" 
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required 
          />
          <Input 
            label="Employee ID" 
            name="employeeId"
            value={formData.employeeId}
            onChange={handleChange}
            required 
          />
          <Input 
            label="Username" 
            name="username"
            value={formData.username}
            onChange={handleChange}
            required 
          />
          <Input 
            label="Temporary password" 
            name="password"
            placeholder="Auto-generated if left blank"
            disabled
          />
          <Input 
            label="Personal email" 
            type="email"
            name="personalEmail"
            value={formData.personalEmail}
            onChange={handleChange}
            required 
          />
          <Input 
            label="Phone" 
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required 
          />
          
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-brand-ink">Department</label>
            <select 
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              className="px-3 py-2 border border-gray-200 rounded-xl outline-none transition-all duration-200 focus:ring-2 focus:ring-brand-lime/50 focus:border-brand-lime bg-white"
            >
              <option value="" disabled>Select...</option>
              <option value="Finance">Finance</option>
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
              <option value="Ops Heads">Ops Heads</option>
              <option value="Tech">Tech</option>
              <option value="Digital Marketing">Digital Marketing</option>
            </select>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Finance', 'Sales', 'Operations', 'Ops Heads', 'Tech', 'Digital Marketing'].map(dept => (
                <span key={dept} className="px-2 py-1 bg-brand-lime-tint text-[10px] font-semibold text-[#3f5c12] rounded-md">
                  {dept}
                </span>
              ))}
            </div>
          </div>

          <Input 
            label="Reporting manager" 
            name="reportingManager"
            value={formData.reportingManager}
            onChange={handleChange}
            required 
          />

          <div className="md:col-span-2 flex justify-end gap-3 pt-6 mt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => window.history.back()}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create & send credentials
            </Button>
          </div>
        </form>
      </div>

      {/* Success Toast */}
      <div className={`fixed bottom-6 right-6 transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="bg-brand-lime-tint border border-[#dcf0a8] text-brand-ink px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <CheckCircle2 size={20} className="text-[#3f5c12]" />
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}
