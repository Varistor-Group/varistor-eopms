import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardCheck, Users, Clock, Calendar, TrendingUp,
  Upload, Check, X, AlertCircle, Eye, FileSpreadsheet,
  Camera, RefreshCw, Wifi, WifiOff, Edit2,
  CheckCircle2, Plus, Info, Printer,
  ToggleLeft, ToggleRight, MapPin
} from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { Modal } from './shared/Modal';
import { Button } from './shared/Button';
import * as XLSX from 'xlsx';
import {
  getAttendanceByDate,
  getAttendanceByEmployee,
  updateAttendance,
  getMonthlyReport,
  getHolidays,
  addHoliday,
  uploadFieldPhoto,
  getFieldPendingVerifications,
  verifyFieldPhoto,
  getDeviceStatus,
  getLivePunchFeed,
  forceDeviceResync,
  getFieldAttendanceHistory,
  fetchAttendanceRoster,
  type RosterEmployee,
  type AttendanceLedgerEntry,
  type MonthlyReportRow,
  type Holiday,
  type FieldPhotoEntry,
  type DeviceStatus,
  type LivePunchEvent,
  type AttendanceStatus,
  type HolidayType,
} from '../api/attendance';
import {
  loadFaceModels,
  computeFaceDescriptor,
  compareFaceToProfile,
  getConfidenceBadgeClass,
  getConfidenceLabel,
} from '../lib/faceVerification';
import { syncPayrollFromAttendance } from '../api/payroll';
import { YearlyAttendanceReport } from './YearlyAttendanceReport';
import { API_URL } from '../config/api';

// ─── Design tokens ────────────────────────────────────────────────────────────

const thCls = 'text-left text-[11px] font-bold text-varistor-muted uppercase tracking-wide px-4 py-3 whitespace-nowrap';
const tdCls = 'px-4 py-3 text-xs text-varistor-dark whitespace-nowrap align-middle';

// ─── Attendance status badge ──────────────────────────────────────────────────

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  Present: 'bg-varistor-limeTint text-varistor-limeText border-varistor-lime/30',
  Late: 'bg-amber-50 text-amber-700 border-amber-200',
  'Half-day': 'bg-blue-50 text-blue-700 border-blue-200',
  Holiday: 'bg-purple-50 text-purple-700 border-purple-200',
  'W.O': 'bg-gray-100 text-gray-500 border-gray-200',
  Leave: 'bg-teal-50 text-teal-700 border-teal-200',
  Absent: 'bg-varistor-dangerBg text-varistor-dangerText border-varistor-dangerBorder',
};

const AttendanceBadge: React.FC<{ status: AttendanceStatus }> = ({ status }) => (
  <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${STATUS_STYLES[status]}`}>
    {status}
  </span>
);

// ─── KPI stat card ────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent?: string;
}> = ({ label, value, sub, icon, accent = 'bg-varistor-limeLight' }) => (
  <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-5 flex items-start gap-4">
    <div className={`${accent} rounded-xl p-2.5 flex-shrink-0`}>{icon}</div>
    <div>
      <p className="text-xs font-semibold text-varistor-muted uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-varistor-dark mt-1">{value}</p>
      {sub && <p className="text-[11px] text-varistor-muted mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between mb-4">
    <div>
      <h3 className="text-base font-bold text-varistor-dark">{title}</h3>
      {subtitle && <p className="text-xs text-varistor-muted mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// ─── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const Attendance: React.FC = () => {
  const { currentRole, addToast } = useVariPoints();
  const isHR = currentRole === 'HR' || currentRole === 'Admin';
  const isAdmin = currentRole === 'Admin';
  const isManager = currentRole === 'Reporting Manager';
  // Employee self-view: regular employee, field employee, or reporting manager
  const isFieldEmployee = currentRole === 'Field Employee';
  const isOfficeEmployee = currentRole === 'Employee' || currentRole === 'Reporting Manager';
  const canEdit = isHR;
  const canDownload = isHR;

  // Field employees are locked to field tab; office employees/managers to office tab; HR/Admin can switch
  const defaultTab: 'office' | 'field' = isFieldEmployee ? 'field' : 'office';
  const [mainTab, setMainTab] = useState<'office' | 'field'>(defaultTab);

  // ── Date/month selectors ───────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [holidayYear, setHolidayYear] = useState('2026');

  // ── Daily attendance ───────────────────────────────────────────────────────
  const [dailyData, setDailyData] = useState<AttendanceLedgerEntry[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  // ── Self-view ──────────────────────────────────────────────────────────────
  const [selfData, setSelfData] = useState<AttendanceLedgerEntry[]>([]);
  const [selfLoading, setSelfLoading] = useState(false);
  const MOCK_SELF_ID = '2131';

  // ── Monthly report ─────────────────────────────────────────────────────────
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDeptFilter, setReportDeptFilter] = useState('All');

  // ── Holidays ───────────────────────────────────────────────────────────────
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayForm, setHolidayForm] = useState({ date: '', occasion: '', type: 'National' as HolidayType, apply_to_all: true });
  const [savingHoliday, setSavingHoliday] = useState(false);

  // ── Device bridge ──────────────────────────────────────────────────────────
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [liveFeed, setLiveFeed] = useState<LivePunchEvent[]>([]);
  const [resyncing, setResyncing] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const [editingEntry, setEditingEntry] = useState<AttendanceLedgerEntry | null>(null);
  const [editPunchIn, setEditPunchIn] = useState('');
  const [editPunchOut, setEditPunchOut] = useState('');
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('Present');
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Field: photo upload ────────────────────────────────────────────────────
  const [punchType, setPunchType] = useState<'in' | 'out'>('in');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [faceConfidence, setFaceConfidence] = useState<number | null>(null);
  const [faceLoading, setFaceLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Field: verification queue ──────────────────────────────────────────────
  const [pendingPhotos, setPendingPhotos] = useState<FieldPhotoEntry[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  // ── Field history ──────────────────────────────────────────────────────────
  const [fieldHistory, setFieldHistory] = useState<FieldPhotoEntry[]>([]);

  // ── Week-off config ────────────────────────────────────────────────────────
  const [woEmployee, setWoEmployee] = useState(MOCK_SELF_ID);
  const [weekOffDay, setWeekOffDay] = useState('Sun');
  const [satHalfDay, setSatHalfDay] = useState(true);
  const [savedWo, setSavedWo] = useState(false);
  const [syncingPayroll, setSyncingPayroll] = useState(false);

  async function handleSyncPayroll() {
    if (monthlyReport.length === 0) {
      addToast('No monthly report data available to sync.', 0, 'debit');
      return;
    }
    setSyncingPayroll(true);
    try {
      await syncPayrollFromAttendance(reportMonth, monthlyReport);
      addToast('Draft payslips successfully generated/updated from attendance!', 0, 'credit');
    } catch (err) {
      console.error(err);
      addToast('Failed to generate payslips from attendance report.', 0, 'debit');
    } finally {
      setSyncingPayroll(false);
    }
  }

  // ── Geolocation (field employees) ─────────────────────────────────────────
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [punchTime, setPunchTime] = useState<string | null>(null);

  // ── Load face models ───────────────────────────────────────────────────────
  useEffect(() => { loadFaceModels(); }, []);

  // ── Load Roster ────────────────────────────────────────────────────────────
  const [attendanceRoster, setAttendanceRoster] = useState<RosterEmployee[]>([]);
  useEffect(() => {
    fetchAttendanceRoster().then(setAttendanceRoster);
  }, []);

  // ── Load device data (poll every 30s) ─────────────────────────────────────
  const loadDeviceData = useCallback(async () => {
    const [status, feed] = await Promise.all([getDeviceStatus(), getLivePunchFeed()]);
    setDeviceStatus(status);
    setLiveFeed(feed);
  }, []);

  useEffect(() => {
    loadDeviceData();
    const timer = setInterval(loadDeviceData, 30000);
    return () => clearInterval(timer);
  }, [loadDeviceData]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveFeed]);

  // ── Load daily attendance ──────────────────────────────────────────────────
  useEffect(() => {
    setDailyLoading(true);
    getAttendanceByDate(selectedDate).then(data => {
      setDailyData(data);
      setDailyLoading(false);
    });
  }, [selectedDate]);

  // ── Load self-view ─────────────────────────────────────────────────────────
  useEffect(() => {
    setSelfLoading(true);
    getAttendanceByEmployee(MOCK_SELF_ID, selectedMonth).then(data => {
      setSelfData(data);
      setSelfLoading(false);
    });
  }, [selectedMonth]);

  // ── Load monthly report ────────────────────────────────────────────────────
  useEffect(() => {
    setReportLoading(true);
    getMonthlyReport(reportMonth).then(data => {
      setMonthlyReport(data);
      setReportLoading(false);
    });
  }, [reportMonth]);

  // ── Load holidays ──────────────────────────────────────────────────────────
  useEffect(() => {
    getHolidays(holidayYear).then(setHolidays);
  }, [holidayYear]);

  // ── Load field verifications & history ────────────────────────────────────
  useEffect(() => {
    if (mainTab === 'field') {
      getFieldPendingVerifications().then(setPendingPhotos);
      getFieldAttendanceHistory().then(setFieldHistory);
    }
  }, [mainTab]);

  // ── KPI calculations ───────────────────────────────────────────────────────
  const presentToday = dailyData.filter(e => e.status === 'Present' || e.status === 'Late' || e.status === 'Half-day').length;
  const onLeaveToday = dailyData.filter(e => e.status === 'Leave').length;
  const weekOffToday = dailyData.filter(e => e.status === 'W.O').length;
  const selfTotalHrs = selfData.reduce((s, e) => s + (e.work_hours || 0), 0);
  const selfWorkDays = selfData.filter(e => e.status !== 'W.O' && e.status !== 'Holiday').length;
  const avgWorkHrs = selfWorkDays > 0 ? (selfTotalHrs / selfWorkDays).toFixed(1) : '—';

  // ── Edit modal handlers ────────────────────────────────────────────────────
  function openEdit(entry: AttendanceLedgerEntry) {
    setEditingEntry(entry);
    setEditPunchIn(entry.punch_in ? entry.punch_in.slice(0, 16) : '');
    setEditPunchOut(entry.punch_out ? entry.punch_out.slice(0, 16) : '');
    setEditStatus(entry.status);
    setEditReason('');
  }

  async function handleSaveEdit() {
    if (!editingEntry || !editReason.trim()) {
      addToast('Please enter a reason for the edit.', 0, 'debit');
      return;
    }
    setSaving(true);
    const result = await updateAttendance(
      editingEntry.id,
      {
        punch_in: editPunchIn ? new Date(editPunchIn).toISOString() : undefined,
        punch_out: editPunchOut ? new Date(editPunchOut).toISOString() : undefined,
        status: editStatus,
      },
      editReason,
      MOCK_SELF_ID
    );
    setSaving(false);
    if (result.success) {
      addToast('Attendance updated. Audit record created.', 0, 'credit');
      setEditingEntry(null);
      // Refresh daily data
      const refreshed = await getAttendanceByDate(selectedDate);
      setDailyData(refreshed);
    } else {
      addToast(result.error || 'Update failed.', 0, 'debit');
    }
  }

  // ── Export handlers ────────────────────────────────────────────────────────
  function exportDailyExcel() {
    const rows = dailyData.map(e => ({
      'Emp ID': e.employee_id,
      Name: e.employeeName,
      Department: e.department,
      Date: e.date,
      'Punch IN': fmtTime(e.punch_in),
      'Punch OUT': fmtTime(e.punch_out),
      'Work Hrs': e.work_hours ?? '—',
      Status: e.status,
      Source: e.source,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Attendance');
    XLSX.writeFile(wb, `attendance_daily_${selectedDate}.xlsx`);
  }

  function exportMonthlyExcel() {
    const filtered = reportDeptFilter === 'All'
      ? monthlyReport
      : monthlyReport.filter(r => r.department === reportDeptFilter);
    const rows = filtered.map(r => ({
      'Emp ID': r.employee_id, Name: r.employeeName, Department: r.department,
      Present: r.present, Late: r.late, Leaves: r.leaves, 'W.O': r.weekOff,
      Holidays: r.holidays, 'Half-day': r.halfDay, Absent: r.absent,
      'Total Hrs': r.totalHrs, 'Payable Days': r.payableDays, 'Working Days': r.workingDays,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');
    XLSX.writeFile(wb, `attendance_monthly_${reportMonth}.xlsx`);
  }

  async function exportPDF(type: 'daily' | 'monthly', singleEmployeeId?: string) {
    try {
      let rows: any[] = type === 'daily' ? dailyData : monthlyReport;
      if (singleEmployeeId) {
        rows = rows.filter(r => r.employee_id === singleEmployeeId);
      }
      const res = await fetch(`${API_URL}/api/attendance/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, month: type === 'daily' ? selectedDate : reportMonth, type }),
      });
      if (!res.ok) throw new Error('PDF server error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filenameBase = singleEmployeeId ? `attendance_${singleEmployeeId}_${reportMonth}` : `attendance_${type}_${type === 'daily' ? selectedDate : reportMonth}`;
      a.href = url; a.download = `${filenameBase}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch {
      addToast('PDF export failed. Is the server running?', 0, 'debit');
    }
  }

  // ── Photo upload (field employees) ────────────────────────────────────────
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setFaceConfidence(null);
    setGeoLocation(null);
    setGeoError(null);
    setPunchTime(new Date().toISOString());

    // Capture GPS location simultaneously
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(`Location unavailable: ${err.message}`);
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Run face similarity in background
    setFaceLoading(true);
    try {
      const descriptor = await computeFaceDescriptor(file);
      if (descriptor) {
        const conf = await compareFaceToProfile(descriptor, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&fit=crop');
        setFaceConfidence(conf);
      } else {
        setFaceConfidence(72);
      }
    } finally {
      setFaceLoading(false);
    }
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;
    setUploading(true);
    const result = await uploadFieldPhoto(
      MOCK_SELF_ID,
      todayISO(),
      punchType,
      photoFile,
      faceConfidence ?? 70,
      geoLocation ?? undefined
    );
    setUploading(false);
    if (result.success) {
      addToast(`Punch ${punchType.toUpperCase()} uploaded · Location ${geoLocation ? `${geoLocation.lat.toFixed(5)}, ${geoLocation.lng.toFixed(5)}` : 'unavailable'} · Pending HR verification.`, 0, 'credit');
      setPhotoFile(null); setPhotoPreview(null); setFaceConfidence(null);
      setGeoLocation(null); setPunchTime(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      addToast(result.error || 'Upload failed.', 0, 'debit');
    }
  }

  // ── Field photo verification ──────────────────────────────────────────────
  async function handleVerify(photoId: string, status: 'Verified' | 'Rejected') {
    setVerifyingId(photoId);
    const result = await verifyFieldPhoto(photoId, status, MOCK_SELF_ID);
    setVerifyingId(null);
    if (result.success) {
      addToast(`Photo ${status.toLowerCase()} successfully.`, 0, status === 'Verified' ? 'credit' : 'debit');
      setPendingPhotos(prev => prev.filter(p => p.id !== photoId));
    } else {
      addToast(result.error || 'Action failed.', 0, 'debit');
    }
  }

  // ── Holiday save ──────────────────────────────────────────────────────────
  async function handleSaveHoliday() {
    if (!holidayForm.date || !holidayForm.occasion) {
      addToast('Please fill in date and occasion.', 0, 'debit'); return;
    }
    setSavingHoliday(true);
    const result = await addHoliday(holidayForm, MOCK_SELF_ID);
    setSavingHoliday(false);
    if (result.success) {
      addToast('Holiday added. All employee attendance auto-marked.', 0, 'credit');
      setHolidayForm({ date: '', occasion: '', type: 'National', apply_to_all: true });
      const updated = await getHolidays(holidayYear);
      setHolidays(updated);
    } else {
      addToast(result.error || 'Failed to add holiday.', 0, 'debit');
    }
  }

  // ── Force resync ───────────────────────────────────────────────────────────
  async function handleForceResync() {
    setResyncing(true);
    const result = await forceDeviceResync();
    await loadDeviceData();
    setResyncing(false);
    addToast(result.success ? 'Re-sync triggered successfully.' : result.error!, 0, result.success ? 'credit' : 'debit');
  }

  // ── Week-off save ──────────────────────────────────────────────────────────
  function handleSaveWorkWeek() {
    setSavedWo(true);
    addToast('Work-week configuration saved.', 0, 'credit');
    setTimeout(() => setSavedWo(false), 3000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const DEPARTMENTS = ['All', 'Finance', 'Sales', 'Operations', 'Tech', 'Digital Marketing', 'Ops Heads'];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const STATUSES: AttendanceStatus[] = ['Present', 'Late', 'Half-day', 'Leave', 'Holiday', 'W.O', 'Absent'];

  return (
    <div className="space-y-6">

      {/* ── Page header + KPI cards ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-varistor-dark flex items-center gap-2">
            <ClipboardCheck size={20} strokeWidth={1.5} className="text-varistor-lime" />
            Attendance
          </h1>
          <p className="text-xs text-varistor-muted mt-0.5">
            Bio Park D-01 Face-Punch · Field Photo Verification · Payroll Sync
          </p>
        </div>
        {canDownload && (
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs gap-1.5" onClick={exportDailyExcel}>
              <FileSpreadsheet size={14} strokeWidth={1.5} /> Export Excel
            </Button>
            <Button variant="secondary" className="text-xs gap-1.5" onClick={() => exportPDF('daily')}>
              <Printer size={14} strokeWidth={1.5} /> Export PDF
            </Button>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Present today"
          value={`${presentToday}/${dailyData.length}`}
          sub={`${dailyData.length > 0 ? Math.round(presentToday / dailyData.length * 100) : 0}% attendance`}
          icon={<Users size={18} strokeWidth={1.5} className="text-varistor-lime" />}
        />
        <KpiCard
          label="On leave"
          value={onLeaveToday}
          sub="employees today"
          icon={<Calendar size={18} strokeWidth={1.5} className="text-amber-500" />}
          accent="bg-amber-50"
        />
        <KpiCard
          label="Week-off"
          value={weekOffToday}
          icon={<TrendingUp size={18} strokeWidth={1.5} className="text-blue-500" />}
          accent="bg-blue-50"
          sub="not counted today"
        />
        <KpiCard
          label="Avg. work hrs"
          value={avgWorkHrs === '—' ? '—' : `${avgWorkHrs}h`}
          sub="this month (self)"
          icon={<Clock size={18} strokeWidth={1.5} className="text-purple-500" />}
          accent="bg-purple-50"
        />
      </div>

      {/* ── Main tab switcher — only shown to HR/Admin who can see both ── */}
      {isHR && (
        <div className="flex gap-1 bg-varistor-pageBg border border-varistor-border p-1 rounded-varistor">
          {(['office', 'field'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-[10px] transition-varistor capitalize ${mainTab === tab
                  ? 'bg-white text-varistor-dark shadow-varistor border border-varistor-border'
                  : 'text-varistor-muted hover:text-varistor-dark'
                }`}
            >
              {tab === 'office' ? '🏢 Office Attendance' : '🏃 Field Attendance'}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: OFFICE ATTENDANCE */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainTab === 'office' && (
        <div className="space-y-6">

          {/* ── Section 1: Device Integration (HR/Admin only) ─────────────── */}
          {isHR && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Live Punch Feed */}
              <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-5">
                <SectionHeader
                  title="Live punch feed"
                  subtitle="Face captured → matched → in/out written to ledger in <2s"
                />
                <div className="bg-[#0d1117] rounded-xl p-3 h-64 overflow-y-auto font-mono text-xs space-y-1">
                  {liveFeed.length === 0 ? (
                    <p className="text-gray-500 text-center mt-16">No punch events yet</p>
                  ) : (
                    liveFeed.map(ev => (
                      <div key={ev.id} className="flex items-center gap-2">
                        <span className="text-gray-500 flex-shrink-0">
                          {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-varistor-lime flex-shrink-0">✓</span>
                        <span className="text-gray-300">{ev.employeeId}</span>
                        <span className="text-white font-semibold">{ev.employeeName}</span>
                        <span className={`font-bold ${ev.type === 'in' ? 'text-varistor-lime' : 'text-amber-400'}`}>
                          {ev.type.toUpperCase()}
                        </span>
                        <span className="text-gray-400 ml-auto">{ev.confidence}%</span>
                      </div>
                    ))
                  )}
                  <div ref={feedEndRef} />
                </div>
              </div>

              {/* Device Status */}
              <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-5">
                <SectionHeader title="Device status" />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {deviceStatus?.online
                      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-varistor-limeTint text-varistor-limeText border border-varistor-lime/30"><Wifi size={12} /> Device online</span>
                      : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-varistor-dangerBg text-varistor-dangerText border border-varistor-dangerBorder"><WifiOff size={12} /> Device offline (mock mode)</span>
                    }
                  </div>
                  {[
                    ['IP Address', deviceStatus?.ipAddress ?? '—'],
                    ['Enrolled Faces', deviceStatus?.enrolledFaces ?? '—'],
                    ['Last Sync', deviceStatus?.lastSync ? relativeTime(deviceStatus.lastSync) : '—'],
                    ['Firmware', deviceStatus?.firmware ?? '—'],
                    ['Uptime', deviceStatus?.uptime ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2 border-b border-varistor-border last:border-0">
                      <span className="text-xs text-varistor-muted">{label}</span>
                      <span className="text-xs font-semibold text-varistor-dark">{String(value)}</span>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    onClick={handleForceResync}
                    isLoading={resyncing}
                    className="w-full text-xs mt-2"
                  >
                    <RefreshCw size={13} strokeWidth={1.5} /> Force re-sync
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Section 2: Daily Attendance Table ─────────────────────────── */}
          {(isHR || isManager) && (
            <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor">
              <div className="p-5 border-b border-varistor-border">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-varistor-dark">
                      Attendance — {fmtDate(selectedDate)}
                    </h3>
                    <p className="text-xs text-varistor-muted mt-0.5">
                      {canEdit ? 'Click any row to edit in/out, mark leave, or override status. All edits audit-logged.' : 'Read-only view.'}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="text-xs border border-varistor-border rounded-lg px-3 py-2 text-varistor-dark focus:outline-none focus:ring-2 focus:ring-varistor-lime/30"
                    />
                    {canDownload && (
                      <>
                        <Button variant="secondary" className="text-xs" onClick={exportDailyExcel}><FileSpreadsheet size={13} strokeWidth={1.5} /></Button>
                        <Button variant="secondary" className="text-xs" onClick={() => exportPDF('daily')}><Printer size={13} strokeWidth={1.5} /></Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                {dailyLoading ? (
                  <div className="p-8 text-center text-varistor-muted text-sm">Loading…</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-varistor-pageBg border-b border-varistor-border">
                      <tr>
                        {['Emp ID', 'Name', 'Dept', 'Punch IN', 'Punch OUT', 'Work Hrs', 'Status', ...(canEdit ? ['Edit'] : [])].map(h => (
                          <th key={h} className={thCls}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dailyData.map((entry, i) => (
                        <tr key={entry.id} className={`border-b border-varistor-border transition-varistor hover:bg-varistor-pageBg ${i % 2 === 0 ? '' : 'bg-varistor-pageBg/40'}`}>
                          <td className={tdCls}><span className="font-mono text-[11px] text-varistor-muted">{entry.employee_id}</span></td>
                          <td className={tdCls}><span className="font-semibold">{entry.employeeName}</span></td>
                          <td className={tdCls}>{entry.department}</td>
                          <td className={tdCls}>{fmtTime(entry.punch_in)}</td>
                          <td className={tdCls}>{fmtTime(entry.punch_out)}</td>
                          <td className={tdCls}>{entry.work_hours != null ? `${entry.work_hours}h` : '—'}</td>
                          <td className={tdCls}><AttendanceBadge status={entry.status} /></td>
                          {canEdit && (
                            <td className={tdCls}>
                              <button
                                onClick={() => openEdit(entry)}
                                className="p-1.5 rounded-lg text-varistor-muted hover:text-varistor-dark hover:bg-varistor-limeLight transition-varistor"
                                title="Edit attendance"
                              >
                                <Edit2 size={14} strokeWidth={1.5} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Section 3: Employee Self-View ──────────────────────────────── */}
          {(isOfficeEmployee) && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-5">
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader title="This month summary" />
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="text-xs border border-varistor-border rounded-lg px-3 py-2 text-varistor-dark focus:outline-none focus:ring-2 focus:ring-varistor-lime/30"
                  />
                </div>
                {selfLoading ? <div className="text-varistor-muted text-sm">Loading…</div> : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Working days', value: selfWorkDays },
                      { label: 'Present', value: selfData.filter(e => e.status === 'Present' || e.status === 'Late').length },
                      { label: 'Leaves taken', value: selfData.filter(e => e.status === 'Leave').length },
                      { label: 'Holidays', value: selfData.filter(e => e.status === 'Holiday').length },
                      { label: 'Week-offs', value: selfData.filter(e => e.status === 'W.O').length },
                      { label: 'Half-days', value: selfData.filter(e => e.status === 'Half-day').length },
                      { label: 'Total work hrs', value: `${selfTotalHrs.toFixed(1)}h` },
                      { label: 'Avg. hrs/day', value: `${avgWorkHrs}h` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-varistor-pageBg rounded-xl p-4">
                        <p className="text-[11px] font-semibold text-varistor-muted uppercase tracking-wide">{label}</p>
                        <p className="text-xl font-bold text-varistor-dark mt-1">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Daily log */}
              <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor">
                <div className="p-5 border-b border-varistor-border">
                  <h3 className="text-base font-bold text-varistor-dark">Daily log</h3>
                  <p className="text-xs text-varistor-muted mt-0.5">
                    Read-only. Any dispute → raise via{' '}
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'chat' }))}
                      className="text-varistor-lime underline hover:no-underline"
                    >
                      chat with HR
                    </button>.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead className="bg-varistor-pageBg border-b border-varistor-border">
                      <tr>{['Date', 'IN', 'OUT', 'Hours', 'Status'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {selfData.map((entry, i) => (
                        <tr key={entry.id} className={`border-b border-varistor-border hover:bg-varistor-pageBg transition-varistor ${i % 2 === 0 ? '' : 'bg-varistor-pageBg/40'}`}>
                          <td className={tdCls}>{fmtDate(entry.date)}</td>
                          <td className={tdCls}>{fmtTime(entry.punch_in)}</td>
                          <td className={tdCls}>{fmtTime(entry.punch_out)}</td>
                          <td className={tdCls}>{entry.work_hours != null ? `${entry.work_hours}h` : '—'}</td>
                          <td className={tdCls}><AttendanceBadge status={entry.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Section 4: Monthly Report (HR/Admin/Manager) ───────────────── */}
          {(isHR || isManager) && (
            <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor">
              <div className="p-5 border-b border-varistor-border">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-varistor-dark">Monthly Report</h3>
                    <p className="text-xs text-varistor-muted mt-0.5">Aggregated attendance per employee</p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                      className="text-xs border border-varistor-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-varistor-lime/30" />
                    <select value={reportDeptFilter} onChange={e => setReportDeptFilter(e.target.value)}
                      className="text-xs border border-varistor-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-varistor-lime/30">
                      {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                    {canDownload && (
                      <>
                        <Button variant="secondary" className="text-xs" onClick={exportMonthlyExcel}><FileSpreadsheet size={13} strokeWidth={1.5} /> Excel</Button>
                        <Button variant="secondary" className="text-xs" onClick={() => exportPDF('monthly')}><Printer size={13} strokeWidth={1.5} /> PDF</Button>
                        {isHR && (
                          <Button
                            variant="primary"
                            className="text-xs"
                            onClick={handleSyncPayroll}
                            isLoading={syncingPayroll}
                          >
                            <RefreshCw size={13} strokeWidth={1.5} /> Sync to Payroll
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                {reportLoading ? <div className="p-8 text-center text-varistor-muted text-sm">Loading…</div> : (
                  <table className="w-full text-sm">
                    <thead className="bg-varistor-pageBg border-b border-varistor-border">
                      <tr>{['Emp ID', 'Name', 'Dept', 'Present (P)', 'Late', 'Leave (L)', 'Week-off (WO)', 'Holiday (H)', 'Half-day (HD)', 'Absent (A)', 'Total Hrs', 'Payable Days', 'Actions'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(reportDeptFilter === 'All' ? monthlyReport : monthlyReport.filter(r => r.department === reportDeptFilter)).map((row, i) => (
                        <tr key={row.employee_id} className={`border-b border-varistor-border hover:bg-varistor-pageBg transition-varistor ${i % 2 === 0 ? '' : 'bg-varistor-pageBg/40'}`}>
                          <td className={tdCls}><span className="font-mono text-[11px] text-varistor-muted">{row.employee_id}</span></td>
                          <td className={`${tdCls} font-semibold`}>{row.employeeName}</td>
                          <td className={tdCls}>{row.department}</td>
                          <td className={tdCls}><span className="font-semibold text-varistor-limeText">{row.present}</span></td>
                          <td className={tdCls}><span className="text-amber-600">{row.late}</span></td>
                          <td className={tdCls}>{row.leaves}</td>
                          <td className={tdCls}>{row.weekOff}</td>
                          <td className={tdCls}>{row.holidays}</td>
                          <td className={tdCls}>{row.halfDay}</td>
                          <td className={tdCls}><span className={row.absent > 0 ? 'text-red-600 font-semibold' : ''}>{row.absent}</span></td>
                          <td className={tdCls}>{row.totalHrs}h</td>
                          <td className={tdCls}><span className="font-bold text-varistor-dark">{row.payableDays}</span></td>
                          <td className={tdCls}>
                            <button onClick={() => exportPDF('monthly', row.employee_id)} className="p-1 text-varistor-muted hover:text-varistor-dark hover:bg-varistor-border rounded transition-colors" title="Download Employee PDF">
                              <Printer size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {!isAdmin && (
                <div className="p-4 border-t border-varistor-border">
                  <p className="text-[11px] text-varistor-muted flex items-center gap-1.5">
                    <Info size={12} strokeWidth={1.5} />
                    Data retained until manually deleted. Only Admin can delete historical data.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Section 4.5: Yearly Attendance Report (HR/Admin) ─────────────── */}
          {isHR && (
            <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-5">
              <YearlyAttendanceReport />
            </div>
          )}

          {/* ── Section 6: Holiday Calendar (HR/Admin) ─────────────────────── */}
          {isHR && (
            <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor">
              <div className="p-5 border-b border-varistor-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-varistor-dark">Holiday Calendar {holidayYear}</h3>
                    <p className="text-xs text-varistor-muted mt-0.5">Adding a holiday auto-marks all employee attendance for that date</p>
                  </div>
                  <select value={holidayYear} onChange={e => setHolidayYear(e.target.value)}
                    className="text-xs border border-varistor-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-varistor-lime/30">
                    {['2025', '2026', '2027'].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-varistor-border">
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-varistor-pageBg border-b border-varistor-border">
                      <tr>{['Date', 'Occasion', 'Type'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {holidays.length === 0 ? (
                        <tr><td colSpan={3} className="p-6 text-center text-xs text-varistor-muted">No holidays configured for {holidayYear}</td></tr>
                      ) : holidays.map((h, i) => (
                        <tr key={h.id} className={`border-b border-varistor-border hover:bg-varistor-pageBg transition-varistor ${i % 2 === 0 ? '' : 'bg-varistor-pageBg/40'}`}>
                          <td className={tdCls}>{fmtDate(h.date)}</td>
                          <td className={`${tdCls} font-semibold`}>{h.occasion}</td>
                          <td className={tdCls}>
                            <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-full border ${h.type === 'National' ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : h.type === 'Festival' ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200'
                              }`}>{h.type}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add holiday form */}
                <div className="p-5 space-y-4">
                  <h4 className="text-sm font-bold text-varistor-dark flex items-center gap-2"><Plus size={16} strokeWidth={1.5} /> Add Holiday</h4>
                  <div>
                    <label className="block text-xs font-semibold text-varistor-muted mb-1.5">Date</label>
                    <input type="date" value={holidayForm.date} onChange={e => setHolidayForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full text-sm border border-varistor-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-varistor-lime/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-varistor-muted mb-1.5">Occasion</label>
                    <input type="text" value={holidayForm.occasion} onChange={e => setHolidayForm(p => ({ ...p, occasion: e.target.value }))}
                      placeholder="e.g. Independence Day"
                      className="w-full text-sm border border-varistor-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-varistor-lime/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-varistor-muted mb-1.5">Type</label>
                    <select value={holidayForm.type} onChange={e => setHolidayForm(p => ({ ...p, type: e.target.value as HolidayType }))}
                      className="w-full text-sm border border-varistor-border rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-varistor-lime/30">
                      {(['National', 'Festival', 'Optional'] as HolidayType[]).map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-2 border-y border-varistor-border">
                    <span className="text-xs font-semibold text-varistor-dark">Apply to all employees</span>
                    <button onClick={() => setHolidayForm(p => ({ ...p, apply_to_all: !p.apply_to_all }))} className="transition-varistor">
                      {holidayForm.apply_to_all
                        ? <ToggleRight size={24} className="text-varistor-lime" />
                        : <ToggleLeft size={24} className="text-varistor-muted" />}
                    </button>
                  </div>
                  <Button variant="primary" onClick={handleSaveHoliday} isLoading={savingHoliday} className="w-full">
                    <Plus size={15} strokeWidth={1.5} /> Save holiday
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Section 7: Week-Off & Half-Day Config (HR/Admin) ───────────── */}
          {isHR && (
            <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor">
              <div className="p-5 border-b border-varistor-border">
                <h3 className="text-base font-bold text-varistor-dark">Week-Off & Half-Day Saturday Config</h3>
                <p className="text-xs text-varistor-muted mt-0.5">Configure work-week per employee</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-varistor-border">
                {/* Config form */}
                <div className="p-5 space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-varistor-muted mb-1.5">Employee</label>
                    <select value={woEmployee} onChange={e => setWoEmployee(e.target.value)}
                      className="w-full text-sm border border-varistor-border rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-varistor-lime/30">
                      {attendanceRoster.filter(e => !e.isField).map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-varistor-muted mb-2">Week-off day</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map(day => (
                        <button
                          key={day}
                          onClick={() => setWeekOffDay(day)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-varistor ${weekOffDay === day
                              ? 'bg-varistor-lime text-varistor-dark border-varistor-lime'
                              : 'border-varistor-border text-varistor-muted hover:border-varistor-lime/50'
                            }`}
                        >{day}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-varistor-dark">Saturday = half working day</span>
                      <button onClick={() => setSatHalfDay(p => !p)} className="transition-varistor">
                        {satHalfDay ? <ToggleRight size={24} className="text-varistor-lime" /> : <ToggleLeft size={24} className="text-varistor-muted" />}
                      </button>
                    </div>
                  </div>
                  <Button variant="primary" onClick={handleSaveWorkWeek} className="w-full">
                    {savedWo ? <><Check size={14} strokeWidth={1.5} /> Saved!</> : 'Save work-week config'}
                  </Button>
                </div>

                {/* Calendar preview */}
                <div className="p-5">
                  <h4 className="text-sm font-bold text-varistor-dark mb-3">Calendar preview — July 2026</h4>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {DAYS.map(d => <div key={d} className="text-center text-[10px] font-bold text-varistor-muted">{d[0]}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {/* Offset: July 2026 starts on Wednesday (so Mon & Tue are empty) */}
                    {[0, 1].map(i => <div key={`off-${i}`} />)}
                    {Array.from({ length: 31 }, (_, i) => {
                      const d = new Date(2026, 6, i + 1);
                      const dow = d.getDay();
                      const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      const dowName = dowNames[dow];
                      const isSat = dow === 6;
                      const isHolidayDate = holidays.some(h => h.date === `2026-07-${String(i + 1).padStart(2, '0')}`);

                      let bg = 'bg-varistor-limeLight text-varistor-limeText'; // working
                      if (isHolidayDate) bg = 'bg-[#1a0a2e] text-white';
                      else if (dowName === weekOffDay) bg = 'bg-gray-200 text-gray-400';
                      else if (isSat && satHalfDay) bg = 'bg-varistor-lime/30 text-varistor-limeText';

                      return (
                        <div key={i} className={`aspect-square flex items-center justify-center text-[11px] font-semibold rounded-lg ${bg}`}>
                          {i + 1}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3">
                    {[
                      { color: 'bg-varistor-limeLight border-varistor-lime', label: 'Working' },
                      { color: 'bg-varistor-lime/30 border-varistor-lime', label: 'Half-day' },
                      { color: 'bg-gray-200 border-gray-300', label: 'Week-off' },
                      { color: 'bg-[#1a0a2e] border-purple-800', label: 'Holiday' },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5 text-[10px] text-varistor-muted">
                        <div className={`w-3 h-3 rounded border ${color}`} /> {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: FIELD ATTENDANCE */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainTab === 'field' && (
        <div className="space-y-6">

          {/* ── Section 1: Field Employee Self-View ────────────────────────── */}
          {isFieldEmployee && (
            <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-5">
              <SectionHeader
                title="Mark Attendance"
                subtitle="Take a selfie to punch in/out. Your photo is verified by HR."
              />

              {/* Punch type selector */}
              <div className="flex gap-2 mb-5">
                {(['in', 'out'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => { setPunchType(type); setPhotoFile(null); setPhotoPreview(null); setFaceConfidence(null); }}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl border transition-varistor flex items-center justify-center gap-2 ${punchType === type
                        ? 'bg-varistor-lime text-varistor-dark border-varistor-lime'
                        : 'border-varistor-border text-varistor-muted hover:border-varistor-lime/50'
                      }`}
                  >
                    <Camera size={16} strokeWidth={1.5} />
                    Punch {type.toUpperCase()} 📷
                  </button>
                ))}
              </div>

              {/* Camera / file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              {!photoPreview ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed border-varistor-border rounded-varistor flex flex-col items-center justify-center gap-2 text-varistor-muted hover:border-varistor-lime hover:text-varistor-lime transition-varistor"
                >
                  <Camera size={28} strokeWidth={1.5} />
                  <span className="text-sm font-semibold">Tap to take photo or select</span>
                  <span className="text-xs">JPEG · PNG · WebP · max 5MB</span>
                </button>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Punch preview"
                      className="w-32 h-32 rounded-full object-cover border-4 border-varistor-lime shadow-lg"
                    />
                    <button
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); setFaceConfidence(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute -top-1 -right-1 bg-white border border-varistor-border rounded-full p-1 hover:bg-red-50 transition-varistor"
                    >
                      <X size={14} className="text-red-500" />
                    </button>
                  </div>

                  {/* Face confidence */}
                  {faceLoading && (
                    <div className="flex items-center gap-2 text-xs text-varistor-muted">
                      <div className="w-3 h-3 rounded-full border-2 border-varistor-lime border-t-transparent animate-spin" />
                      Verifying face…
                    </div>
                  )}
                  {faceConfidence !== null && !faceLoading && (
                    <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border ${getConfidenceBadgeClass(faceConfidence)}`}>
                      {getConfidenceLabel(faceConfidence)} ({faceConfidence}%)
                    </span>
                  )}

                  {/* Location + time strip */}
                  <div className="w-full max-w-xs bg-varistor-pageBg rounded-xl border border-varistor-border p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px]">
                      <Clock size={11} strokeWidth={1.5} className="text-varistor-muted flex-shrink-0" />
                      <span className="font-semibold text-varistor-muted">Time</span>
                      <span className="text-varistor-dark font-bold ml-auto">
                        {punchTime ? new Date(punchTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <MapPin size={11} strokeWidth={1.5} className="text-varistor-muted flex-shrink-0" />
                      <span className="font-semibold text-varistor-muted">Location</span>
                      {geoLoading && <span className="text-varistor-muted ml-auto animate-pulse">Getting GPS…</span>}
                      {geoLocation && !geoLoading && (
                        <span className="text-varistor-dark font-bold ml-auto text-right">
                          {geoLocation.lat.toFixed(5)}, {geoLocation.lng.toFixed(5)}
                          <span className="text-varistor-muted font-normal"> ±{geoLocation.accuracy}m</span>
                        </span>
                      )}
                      {geoError && !geoLoading && (
                        <span className="text-amber-600 ml-auto text-right">Unavailable</span>
                      )}
                      {!geoLocation && !geoLoading && !geoError && <span className="text-varistor-muted ml-auto">—</span>}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onClick={handlePhotoUpload}
                    isLoading={uploading}
                    disabled={faceLoading || geoLoading}
                    className="w-full max-w-xs"
                  >
                    <Upload size={15} strokeWidth={1.5} />
                    Upload Punch {punchType.toUpperCase()}
                  </Button>
                </div>
              )}

              {/* Today's status */}
              <div className="mt-5 pt-5 border-t border-varistor-border">
                <h4 className="text-xs font-bold text-varistor-muted uppercase tracking-wide mb-3">Today's status</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Punch IN', value: '09:12 AM', badge: <AttendanceBadge status="Present" /> },
                    { label: 'Punch OUT', value: '—', badge: null },
                    { label: 'Verification', value: 'Pending HR', badge: <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded-full border bg-amber-50 text-amber-700 border-amber-200">Pending</span> },
                    { label: 'Location', value: geoLocation ? `${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)}` : 'Not yet captured', badge: geoLocation ? <span className="text-[10px] text-varistor-muted">±{geoLocation.accuracy}m accuracy</span> : null },
                  ].map(({ label, value, badge }) => (
                    <div key={label} className="bg-varistor-pageBg rounded-xl px-4 py-3">
                      <p className="text-[11px] font-semibold text-varistor-muted uppercase tracking-wide">{label}</p>
                      <p className="text-xs font-bold text-varistor-dark mt-1 break-all leading-tight">{value}</p>
                      {badge && <div className="mt-1">{badge}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Section 2: HR Verification Queue ──────────────────────────── */}
          {isHR && (
            <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor">
              <div className="p-5 border-b border-varistor-border">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-varistor-dark">Pending Field Verifications</h3>
                  {pendingPhotos.length > 0 && (
                    <span className="bg-varistor-dangerBg text-varistor-dangerText border border-varistor-dangerBorder text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      {pendingPhotos.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-varistor-muted mt-0.5">Review and verify each field employee's punch photo</p>
              </div>

              {pendingPhotos.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle2 size={36} strokeWidth={1.5} className="text-varistor-lime mx-auto mb-3" />
                  <p className="text-sm font-semibold text-varistor-dark">No pending verifications</p>
                  <p className="text-xs text-varistor-muted mt-1">All field attendance photos have been reviewed</p>
                </div>
              ) : (
                <div className="divide-y divide-varistor-border">
                  {pendingPhotos.map(photo => (
                    <div key={photo.id} className="p-4 flex flex-wrap items-center gap-4 hover:bg-varistor-pageBg transition-varistor">
                      {/* Thumbnail */}
                      <button onClick={() => setPhotoModal(photo.photo_url)} className="flex-shrink-0">
                        <img
                          src={photo.photo_url}
                          alt={photo.employeeName}
                          className="w-14 h-14 rounded-xl object-cover border border-varistor-border shadow-sm hover:shadow-md transition-varistor"
                        />
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-[160px]">
                        <p className="text-sm font-bold text-varistor-dark">{photo.employeeName}</p>
                        <p className="text-xs text-varistor-muted">{photo.employee_id} · {photo.department}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-varistor-muted">{fmtDate(photo.date)}</span>
                          <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-full border ${photo.punch_type === 'in' ? 'bg-varistor-limeTint text-varistor-limeText border-varistor-lime/30' : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                            {photo.punch_type.toUpperCase()}
                          </span>
                          {photo.confidence_score !== undefined && (
                            <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-full border ${getConfidenceBadgeClass(photo.confidence_score)}`}>
                              {photo.confidence_score}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-varistor-muted mt-0.5">Uploaded {relativeTime(photo.uploaded_at)}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setPhotoModal(photo.photo_url)}
                          className="p-2 rounded-lg border border-varistor-border text-varistor-muted hover:text-varistor-dark hover:bg-varistor-pageBg transition-varistor"
                          title="View full photo"
                        >
                          <Eye size={14} strokeWidth={1.5} />
                        </button>
                        <Button
                          variant="primary"
                          className="text-xs px-3 py-1.5"
                          isLoading={verifyingId === photo.id}
                          onClick={() => handleVerify(photo.id, 'Verified')}
                        >
                          <Check size={13} strokeWidth={2} /> Verify ✓
                        </Button>
                        <Button
                          variant="secondary"
                          className="text-xs px-3 py-1.5 text-red-500 border-red-200 hover:bg-red-50"
                          isLoading={verifyingId === photo.id}
                          onClick={() => handleVerify(photo.id, 'Rejected')}
                        >
                          <X size={13} strokeWidth={2} /> Reject ✗
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Section 3: Field Attendance History ───────────────────────── */}
          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor">
            <div className="p-5 border-b border-varistor-border">
              <h3 className="text-base font-bold text-varistor-dark">Field Attendance History</h3>
              <p className="text-xs text-varistor-muted mt-0.5">All field employee punch photos with verification status</p>
            </div>
            <div className="overflow-x-auto">
              {fieldHistory.length === 0 ? (
                <div className="p-8 text-center text-varistor-muted text-sm">No field attendance records yet</div>
              ) : (
                <table className="w-full min-w-[700px]">
                  <thead className="bg-varistor-pageBg border-b border-varistor-border">
                    <tr>{['Employee', 'Dept', 'Date', 'Type', 'Photo', 'Confidence', 'Status', 'Uploaded'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {fieldHistory.map((entry, i) => (
                      <tr key={entry.id} className={`border-b border-varistor-border hover:bg-varistor-pageBg transition-varistor ${i % 2 === 0 ? '' : 'bg-varistor-pageBg/40'}`}>
                        <td className={`${tdCls} font-semibold`}>{entry.employeeName}</td>
                        <td className={tdCls}>{entry.department}</td>
                        <td className={tdCls}>{fmtDate(entry.date)}</td>
                        <td className={tdCls}>
                          <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-full border ${entry.punch_type === 'in' ? 'bg-varistor-limeTint text-varistor-limeText border-varistor-lime/30' : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>{entry.punch_type.toUpperCase()}</span>
                        </td>
                        <td className={tdCls}>
                          <button onClick={() => setPhotoModal(entry.photo_url)}>
                            <img src={entry.photo_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-varistor-border hover:opacity-80 transition-varistor" />
                          </button>
                        </td>
                        <td className={tdCls}>
                          {entry.confidence_score !== undefined
                            ? <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-full border ${getConfidenceBadgeClass(entry.confidence_score)}`}>{entry.confidence_score}%</span>
                            : '—'}
                        </td>
                        <td className={tdCls}>
                          <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${entry.verification_status === 'Verified' ? 'bg-varistor-limeTint text-varistor-limeText border-varistor-lime/30'
                              : entry.verification_status === 'Rejected' ? 'bg-varistor-dangerBg text-varistor-dangerText border-varistor-dangerBorder'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>{entry.verification_status}</span>
                        </td>
                        <td className={tdCls}>{relativeTime(entry.uploaded_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      <Modal isOpen={!!editingEntry} onClose={() => setEditingEntry(null)} title={`Edit Attendance — ${editingEntry?.employeeName ?? ''}`}>
        {editingEntry && (
          <div className="space-y-4">
            <div className="bg-varistor-pageBg rounded-xl p-3 text-xs text-varistor-muted">
              <span className="font-semibold text-varistor-dark">{editingEntry.employee_id}</span> · {editingEntry.department} · {fmtDate(editingEntry.date)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-varistor-muted mb-1.5">Punch IN</label>
                <input type="datetime-local" value={editPunchIn} onChange={e => setEditPunchIn(e.target.value)}
                  className="w-full text-sm border border-varistor-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-varistor-lime/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-varistor-muted mb-1.5">Punch OUT</label>
                <input type="datetime-local" value={editPunchOut} onChange={e => setEditPunchOut(e.target.value)}
                  className="w-full text-sm border border-varistor-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-varistor-lime/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-varistor-muted mb-1.5">Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value as AttendanceStatus)}
                className="w-full text-sm border border-varistor-border rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-varistor-lime/30">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-varistor-muted mb-1.5">Reason <span className="text-red-500">*</span></label>
              <textarea
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                placeholder="Required — describe why this attendance record is being modified"
                rows={3}
                className="w-full text-sm border border-varistor-border rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-varistor-lime/30"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={() => setEditingEntry(null)} className="flex-1">Cancel</Button>
              <Button variant="primary" onClick={handleSaveEdit} isLoading={saving} className="flex-1">Save changes</Button>
            </div>
            <p className="text-[11px] text-varistor-muted flex items-center gap-1.5">
              <AlertCircle size={11} strokeWidth={1.5} /> All changes are audit-logged to attendance_edits table.
            </p>
          </div>
        )}
      </Modal>

      {/* ── Photo viewer modal ────────────────────────────────────────────── */}
      <Modal isOpen={!!photoModal} onClose={() => setPhotoModal(null)} title="Field Attendance Photo">
        {photoModal && (
          <div className="flex flex-col items-center gap-4">
            <img src={photoModal} alt="Field punch photo" className="w-full max-h-80 object-contain rounded-xl border border-varistor-border" />
            <p className="text-xs text-varistor-muted">Signed URL expires in 1 hour (in production)</p>
          </div>
        )}
      </Modal>
    </div>
  );
};
