import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText, Plus, Pencil, Trash2, ShieldAlert, Shield,
  Info, Calendar, Tag, ChevronDown, ChevronUp, X, Check
} from 'lucide-react';
import {
  getPolicies, addPolicy, updatePolicy, deletePolicy,
  type Policy, type PolicySeverity, type PolicyCategory
} from '../api/policy';
import { useVariPoints } from '../hooks/useVariPoints';
import { Button } from './shared/Button';

// ── Config ────────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<PolicySeverity, {
  label: string; icon: React.ElementType;
  cardBorder: string; badgeCls: string; dotCls: string;
}> = {
  mandatory: {
    label: 'Mandatory',
    icon: ShieldAlert,
    cardBorder: 'border-red-200',
    badgeCls: 'bg-red-50 text-red-700 border border-red-200',
    dotCls: 'bg-red-500',
  },
  standard: {
    label: 'Standard',
    icon: Shield,
    cardBorder: 'border-varistor-border',
    badgeCls: 'bg-varistor-pendingBg text-varistor-pendingText border border-varistor-pendingBorder',
    dotCls: 'bg-amber-400',
  },
  advisory: {
    label: 'Advisory',
    icon: Info,
    cardBorder: 'border-blue-100',
    badgeCls: 'bg-blue-50 text-blue-600 border border-blue-100',
    dotCls: 'bg-blue-400',
  },
};

const CATEGORY_COLOURS: Record<string, string> = {
  HR:         'bg-purple-50 text-purple-700 border-purple-200',
  Operations: 'bg-orange-50 text-orange-700 border-orange-200',
  Legal:      'bg-slate-100 text-slate-700 border-slate-200',
  IT:         'bg-cyan-50 text-cyan-700 border-cyan-200',
  Finance:    'bg-green-50 text-green-700 border-green-200',
  General:    'bg-gray-100 text-gray-600 border-gray-200',
};

const ALL_CATEGORIES: PolicyCategory[] = ['HR', 'Operations', 'Legal', 'IT', 'Finance', 'General'];
const ALL_SEVERITIES: PolicySeverity[] = ['mandatory', 'standard', 'advisory'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Content is stored as pipe-separated bullets: "Rule 1|Rule 2|Rule 3" */
const toBullets = (content: string): string[] =>
  content.split('|').map(s => s.trim()).filter(Boolean);

const toContent = (bullets: string[]): string =>
  bullets.map(s => s.trim()).filter(Boolean).join('|');

// ── Sub-components ────────────────────────────────────────────────────────────

const SeverityBadge: React.FC<{ severity: PolicySeverity }> = ({ severity }) => {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.badgeCls}`}>
      <Icon size={10} strokeWidth={2} />
      {cfg.label}
    </span>
  );
};

const CategoryBadge: React.FC<{ category: string }> = ({ category }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${CATEGORY_COLOURS[category] ?? CATEGORY_COLOURS.General}`}>
    <Tag size={9} />
    {category}
  </span>
);

// ── Add / Edit Form ───────────────────────────────────────────────────────────

interface PolicyFormProps {
  initial?: Policy;
  onSave: (data: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

const EMPTY_BULLETS = ['', '', ''];

const PolicyForm: React.FC<PolicyFormProps> = ({ initial, onSave, onCancel, isSaving }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<PolicyCategory>(initial?.category ?? 'HR');
  const [severity, setSeverity] = useState<PolicySeverity>(initial?.severity ?? 'standard');
  const [effectiveDate, setEffectiveDate] = useState(initial?.effectiveDate ?? new Date().toISOString().split('T')[0]);
  const [bullets, setBullets] = useState<string[]>(
    initial ? toBullets(initial.content) : EMPTY_BULLETS
  );

  const updateBullet = (idx: number, val: string) =>
    setBullets(prev => prev.map((b, i) => i === idx ? val : b));

  const addBullet = () => setBullets(prev => [...prev, '']);

  const removeBullet = (idx: number) =>
    setBullets(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validBullets = bullets.filter(b => b.trim());
    if (!title.trim() || validBullets.length === 0) return;
    await onSave({ title: title.trim(), category, severity, content: toContent(validBullets), effectiveDate });
  };

  const inputCls = 'w-full bg-varistor-pageBg border border-varistor-border text-varistor-dark text-sm rounded-lg focus:ring-varistor-lime focus:border-varistor-lime p-2.5 font-medium';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-varistor border border-varistor-lime shadow-[0_0_0_3px_rgba(132,204,22,0.08)] p-6 space-y-5">
      <h3 className="text-sm font-bold text-varistor-dark">
        {initial ? 'Edit Policy' : 'Add New Policy'}
      </h3>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-varistor-dark">Policy Title <span className="text-red-500">*</span></label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Code of Conduct"
          required
          className={inputCls}
        />
      </div>

      {/* Category + Severity + Date in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-varistor-dark">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as PolicyCategory)} className={inputCls}>
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-varistor-dark">Severity</label>
          <select value={severity} onChange={e => setSeverity(e.target.value as PolicySeverity)} className={inputCls}>
            {ALL_SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-varistor-dark">Effective Date</label>
          <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Bullet Points */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-varistor-dark">
          Policy Rules <span className="text-red-500">*</span>
          <span className="ml-1 text-varistor-muted font-normal">(each line = one bullet point)</span>
        </label>
        <div className="space-y-2">
          {bullets.map((b, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-varistor-lime font-black text-base leading-none mt-px">•</span>
              <input
                value={b}
                onChange={e => updateBullet(idx, e.target.value)}
                placeholder={`Rule ${idx + 1}...`}
                className="flex-1 bg-varistor-pageBg border border-varistor-border text-varistor-dark text-sm rounded-lg focus:ring-varistor-lime focus:border-varistor-lime px-3 py-2 font-medium"
              />
              {bullets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBullet(idx)}
                  className="p-1 text-varistor-muted hover:text-red-500 transition-colors rounded"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addBullet}
          className="flex items-center gap-1.5 text-xs font-semibold text-varistor-limeText hover:text-varistor-dark transition-colors mt-1"
        >
          <Plus size={13} /> Add another rule
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-varistor-border">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex items-center gap-1.5">
          <X size={13} /> Cancel
        </Button>
        <Button type="submit" isLoading={isSaving} className="flex items-center gap-1.5">
          <Check size={13} /> {initial ? 'Save Changes' : 'Add Policy'}
        </Button>
      </div>
    </form>
  );
};

// ── Policy Card ───────────────────────────────────────────────────────────────

interface PolicyCardProps {
  policy: Policy;
  index: number;
  canEdit: boolean;
  onEdit: (p: Policy) => void;
  onDelete: (id: string) => void;
}

const PolicyCard: React.FC<PolicyCardProps> = ({ policy, index, canEdit, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(true);
  const bullets = toBullets(policy.content);
  const cfg = SEVERITY_CONFIG[policy.severity] ?? SEVERITY_CONFIG.standard;

  return (
    <div className={`bg-white rounded-varistor border-l-4 border border-varistor-border shadow-varistor overflow-hidden transition-shadow hover:shadow-md ${cfg.cardBorder}`}
      style={{ borderLeftColor: policy.severity === 'mandatory' ? '#ef4444' : policy.severity === 'advisory' ? '#60a5fa' : '#d1d5db' }}
    >
      {/* Card Header */}
      <div
        className="flex items-start justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Policy Number */}
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-varistor-pageBg border border-varistor-border flex items-center justify-center text-[11px] font-extrabold text-varistor-muted mt-0.5">
            {String(index + 1).padStart(2, '0')}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h3 className="text-sm font-bold text-varistor-dark tracking-tight">{policy.title}</h3>
              <SeverityBadge severity={policy.severity} />
              <CategoryBadge category={policy.category} />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-varistor-muted font-medium">
              <Calendar size={10} />
              Effective: {new Date(policy.effectiveDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
          {canEdit && (
            <>
              <button
                onClick={e => { e.stopPropagation(); onEdit(policy); }}
                className="p-1.5 rounded-md text-varistor-muted hover:text-varistor-dark hover:bg-varistor-pageBg transition-colors"
                title="Edit policy"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(policy.id); }}
                className="p-1.5 rounded-md text-varistor-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete policy"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          <button className="p-1.5 rounded-md text-varistor-muted hover:bg-varistor-pageBg transition-colors ml-1">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Bullet Points */}
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-varistor-border/50">
          <ul className="mt-4 space-y-2.5">
            {bullets.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-[6px] bg-varistor-lime" />
                <span className="text-sm font-semibold text-varistor-dark leading-snug">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export const PolicyPage: React.FC = () => {
  const { currentRole, addToast } = useVariPoints();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = currentRole === 'HR' || currentRole === 'Admin';

  const load = useCallback(() => {
    setIsLoading(true);
    getPolicies().then(data => { setPolicies(data); setIsLoading(false); });
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>) => {
    setIsSaving(true);
    if (editingPolicy) {
      const result = await updatePolicy(editingPolicy.id, data);
      if (result.success) {
        setPolicies(prev => prev.map(p => p.id === editingPolicy.id ? { ...p, ...data } : p));
        addToast('Policy updated successfully.', 0, 'credit');
      } else {
        addToast(`Failed: ${result.error}`, 0, 'debit');
      }
    } else {
      const result = await addPolicy(data);
      if (result.success && result.policy) {
        setPolicies(prev => [...prev, result.policy!]);
        addToast('Policy added successfully.', 0, 'credit');
      } else {
        addToast(`Failed: ${result.error}`, 0, 'debit');
      }
    }
    setIsSaving(false);
    setShowForm(false);
    setEditingPolicy(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this policy? This cannot be undone.')) return;
    const result = await deletePolicy(id);
    if (result.success) {
      setPolicies(prev => prev.filter(p => p.id !== id));
      addToast('Policy removed.', 0, 'credit');
    } else {
      addToast(`Failed to delete: ${result.error}`, 0, 'debit');
    }
  };

  const handleEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingPolicy(null);
  };

  // Group by severity for display order: mandatory first, then standard, then advisory
  const ordered = [
    ...policies.filter(p => p.severity === 'mandatory'),
    ...policies.filter(p => p.severity === 'standard'),
    ...policies.filter(p => p.severity === 'advisory'),
  ];

  return (
    <div className="space-y-6 animate-[fadeInPage_250ms_ease-out]">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ScrollText size={20} className="text-varistor-lime" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold text-varistor-dark">Company Policies</h1>
          </div>
          <p className="text-xs text-varistor-muted font-medium">
            Official policies governing workplace conduct, operations, and compliance.
          </p>
        </div>

        {canEdit && !showForm && (
          <Button onClick={() => { setEditingPolicy(null); setShowForm(true); }} className="flex items-center gap-2 shrink-0">
            <Plus size={14} />
            Add Policy
          </Button>
        )}
      </div>

      {/* Severity Legend */}
      <div className="flex flex-wrap items-center gap-3">
        {ALL_SEVERITIES.map(s => {
          const cfg = SEVERITY_CONFIG[s];
          const Icon = cfg.icon;
          const count = policies.filter(p => p.severity === s).length;
          return (
            <div key={s} className="flex items-center gap-1.5 text-xs text-varistor-muted font-medium">
              <span className={`w-2 h-2 rounded-full ${cfg.dotCls}`} />
              <Icon size={11} strokeWidth={2} />
              {cfg.label}
              <span className="font-bold text-varistor-dark">({count})</span>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <PolicyForm
          initial={editingPolicy ?? undefined}
          onSave={handleSave}
          onCancel={handleCancelForm}
          isSaving={isSaving}
        />
      )}

      {/* Policy Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-white rounded-varistor border border-varistor-border animate-pulse" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <div className="bg-white rounded-varistor border border-varistor-border p-12 text-center">
          <ScrollText size={32} className="text-varistor-border mx-auto mb-3" />
          <p className="text-sm text-varistor-muted font-medium">No policies published yet.</p>
          {canEdit && (
            <p className="text-xs text-varistor-muted mt-1">Click "Add Policy" to create the first one.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {ordered.map((policy, idx) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              index={idx}
              canEdit={canEdit}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

    </div>
  );
};
