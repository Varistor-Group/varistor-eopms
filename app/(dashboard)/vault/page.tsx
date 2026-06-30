'use client';
import React, { useState, useEffect } from 'react';
import { Lock, FileText, Download, Eye, Trash2, ShieldCheck, Clock } from 'lucide-react';
import { getVaultDocuments, trackDocumentAction } from '@/lib/mock/vault';

export default function DocumentVaultPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock fetching for an employee
  useEffect(() => {
    getVaultDocuments('VAR-024').then(docs => {
      setDocuments(docs);
      setIsLoading(false);
    });
  }, []);

  const handleAction = (docId: string, actionName: string) => {
    trackDocumentAction('admin@varistor.in', actionName, docId);
    console.log(`[Audit Log] admin@varistor.in performed ${actionName} on document ${docId}`);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* Header Profile Summary */}
      <div className="bg-white rounded-[12px] p-6 lg:p-8 border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink mb-1">Aarav Patel · VAR-024</h1>
          <p className="text-gray-500 font-medium text-sm">Operations Department</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-semibold border border-red-100">
            <Lock size={12} />
            Encrypted
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a4d2e] text-white rounded-full text-xs font-semibold">
            <ShieldCheck size={12} />
            Audit log on
          </div>
        </div>
      </div>

      {/* Document Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-gray-100 rounded-[12px]"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-[12px] p-5 border border-gray-100 shadow-sm flex flex-col group hover:shadow-md transition-shadow">
              <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center mb-4 border border-dashed border-gray-200">
                <FileText className="text-gray-300" size={40} />
              </div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-brand-ink text-sm mb-1">{doc.name}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-2 font-medium">
                  {doc.type} · {doc.size}
                </p>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide
                  ${doc.status === 'Verified' ? 'bg-brand-lime-tint text-[#3f5c12]' : 'bg-gray-100 text-gray-500'}
                `}>
                  {doc.status}
                </div>
                
                <div className="flex gap-3 text-xs font-semibold text-gray-500">
                  <button 
                    onClick={() => handleAction(doc.id, 'View')}
                    className="hover:text-brand-ink flex items-center gap-1 transition-colors"
                  >
                    View
                  </button>
                  <span className="text-gray-300">·</span>
                  <button 
                    onClick={() => handleAction(doc.id, 'Download')}
                    className="hover:text-brand-ink flex items-center gap-1 transition-colors"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
