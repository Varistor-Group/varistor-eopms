import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, ChevronDown, ChevronUp,
  FileSpreadsheet, X, Info
} from 'lucide-react';
import { Button } from './shared/Button';
import {
  getYearlyAttendanceReport,
  getEmployeeYearlySummaries,
  fetchAttendanceRoster,
  type EmployeeYearlyReport,
  type EmployeeYearlySummary,
  type DayCode,
} from '../api/attendance';
import { getEmployeeBalances } from '../api/leaves';
import * as XLSX from 'xlsx';

// ─── Code colours ────────────────────────────────────────────────────────────

const CODE_STYLE: Record<DayCode, string> = {
  P:  'bg-varistor-limeTint text-varistor-limeText border border-varistor-lime/30 font-bold',
  L:  'bg-teal-100 text-teal-800 border border-teal-200 font-bold',
  A:  'bg-red-100 text-red-700 border border-red-200 font-bold',
  H:  'bg-purple-100 text-purple-700 border border-purple-200 font-semibold',
  WO: 'bg-gray-100 text-gray-500 border border-gray-200 font-semibold',
  HD: 'bg-blue-100 text-blue-700 border border-blue-200 font-semibold',
  '-': 'bg-varistor-pageBg text-varistor-muted border border-transparent font-normal',
};

const DAY_HEADERS = ['M','T','W','T','F','S','S'];

// ─── Summary badge ────────────────────────────────────────────────────────────

const SummaryBadge: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className={`flex flex-col items-center px-3 py-2 rounded-xl border ${color}`}>
    <span className="text-xs font-semibold opacity-70">{label}</span>
    <span className="text-lg font-bold">{value}</span>
  </div>
);

// ─── Month grid ───────────────────────────────────────────────────────────────

const MonthGrid: React.FC<{
  monthData: EmployeeYearlyReport['months'][0];
}> = ({ monthData }) => {
  // Find what day of week the 1st falls on (0=Sun, recalc to Mon=0)
  const firstDate = new Date(monthData.days[0].date + 'T00:00:00');
  const firstDow = firstDate.getDay(); // 0=Sun, 1=Mon...6=Sat
  const offset = firstDow === 0 ? 6 : firstDow - 1; // convert to Mon-first

  return (
    <div className="min-w-[200px]">
      <p className="text-xs font-bold text-varistor-dark mb-2 text-center">{monthData.monthLabel}</p>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {DAY_HEADERS.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-varistor-muted">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {/* Empty offset cells */}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`off-${i}`} />
        ))}
        {monthData.days.map((day) => {
          const tooltip = day.code === 'L'
            ? 'Paid Leave'
            : day.code === 'A' && day.status === 'Leave'
            ? 'Absent (Leave balance exhausted)'
            : day.code === 'A'
            ? 'Absent'
            : day.code === 'P'
            ? 'Present'
            : day.code === 'H'
            ? 'Holiday'
            : day.code === 'WO'
            ? 'Week Off'
            : day.code === 'HD'
            ? 'Half Day'
            : 'Future';

          return (
            <div
              key={day.date}
              title={`${day.date}: ${tooltip}`}
              className={`aspect-square flex items-center justify-center text-[9px] rounded cursor-default select-none ${CODE_STYLE[day.code]}`}
            >
              {day.code === '-' ? '' : day.code === 'WO' ? '' : day.code === 'HD' ? '½' : day.code}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Per-employee detail panel ─────────────────────────────────────────────────

const EmployeeYearDetail: React.FC<{
  employeeId: string;
  employeeName: string;
  department: string;
  year: string;
  onClose: () => void;
}> = ({ employeeId, employeeName, department, year, onClose }) => {
  const [report, setReport] = useState<EmployeeYearlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getEmployeeBalances(employeeId),
    ]).then(([balance]) => {
      return getYearlyAttendanceReport(year, employeeId, balance);
    }).then(r => {
      setReport(r);
      setLoading(false);
    }).catch(() => {
      getYearlyAttendanceReport(year, employeeId).then(r => {
        setReport(r);
        setLoading(false);
      });
    });
  }, [employeeId, year]);

  function exportEmployeeExcel() {
    if (!report) return;
    const rows: Record<string, string>[] = [];
    report.months.forEach(m => {
      m.days.forEach(d => {
        if (d.code !== '-') {
          rows.push({
            Date: d.date,
            Month: m.monthLabel,
            Code: d.code,
            Status: d.status,
            'Leave Balance Used': d.isLeavePaidOut ? 'Yes' : 'No',
          });
        }
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${employeeName} ${year}`);
    XLSX.writeFile(wb, `attendance_${employeeId}_${year}.xlsx`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
      <div className="bg-white dark:bg-varistor-surface w-full max-w-6xl rounded-2xl border border-varistor-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-varistor-border">
          <div>
            <h2 className="text-base font-bold text-varistor-dark flex items-center gap-2">
              <CalendarDays size={18} className="text-varistor-lime" />
              {employeeName} — Yearly Attendance {year}
            </h2>
            <p className="text-xs text-varistor-muted mt-0.5">{department}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="text-xs gap-1.5" onClick={exportEmployeeExcel}>
              <FileSpreadsheet size={13} /> Export Excel
            </Button>
            <button onClick={onClose} className="p-2 rounded-lg border border-varistor-border hover:bg-varistor-pageBg transition-varistor">
              <X size={16} className="text-varistor-muted" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-varistor-lime border-t-transparent rounded-full animate-spin" />
          </div>
        ) : report ? (
          <div className="p-5 space-y-6">
            {/* Totals row */}
            <div className="flex flex-wrap gap-3">
              <SummaryBadge label="Present" value={report.totals.present} color="bg-varistor-limeTint text-varistor-limeText border-varistor-lime/30" />
              <SummaryBadge label="Paid Leave (L)" value={report.totals.paidLeave} color="bg-teal-50 text-teal-700 border-teal-200" />
              <SummaryBadge label="Unpaid Leave→A" value={report.totals.unpaidLeave} color="bg-orange-50 text-orange-700 border-orange-200" />
              <SummaryBadge label="Absent (A)" value={report.totals.absent} color="bg-red-50 text-red-700 border-red-200" />
              <SummaryBadge label="Half-day" value={report.totals.halfDay} color="bg-blue-50 text-blue-700 border-blue-200" />
              <SummaryBadge label="Holidays" value={report.totals.holidays} color="bg-purple-50 text-purple-700 border-purple-200" />
              <SummaryBadge label="Week-off" value={report.totals.weekOff} color="bg-gray-50 text-gray-600 border-gray-200" />
              <div className="flex flex-col items-center px-3 py-2 rounded-xl border bg-amber-50 text-amber-700 border-amber-200">
                <span className="text-xs font-semibold opacity-70">Leave Balance</span>
                <span className="text-lg font-bold">{report.totals.usedLeaveBalance}/{report.totals.totalLeaveBalance}</span>
              </div>
            </div>

            {/* Leave balance warning */}
            {report.totals.unpaidLeave > 0 && (
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                <Info size={14} className="text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">
                  <span className="font-bold">{report.totals.unpaidLeave} day(s)</span> marked as <span className="font-mono font-bold">A</span> because leave balance was exhausted.
                  These will affect payroll deductions.
                </p>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 items-center">
              {([
                { code: 'P' as DayCode, label: 'Present' },
                { code: 'L' as DayCode, label: 'Paid Leave' },
                { code: 'A' as DayCode, label: 'Absent / No-Balance Leave' },
                { code: 'H' as DayCode, label: 'Holiday' },
                { code: 'WO' as DayCode, label: 'Week Off' },
                { code: 'HD' as DayCode, label: 'Half Day' },
                { code: '-' as DayCode, label: 'Future' },
              ]).map(({ code, label }) => (
                <div key={code} className="flex items-center gap-1.5 text-[10px] text-varistor-muted">
                  <div className={`w-5 h-5 flex items-center justify-center rounded text-[9px] ${CODE_STYLE[code]}`}>
                    {code === '-' ? '' : code === 'WO' ? '·' : code === 'HD' ? '½' : code}
                  </div>
                  {label}
                </div>
              ))}
            </div>

            {/* Month grids */}
            <div className="overflow-x-auto pb-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5">
                {report.months.map(m => (
                  <MonthGrid key={m.month} monthData={m} />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface YearlyAttendanceReportProps {
  year?: string;
}

export const YearlyAttendanceReport: React.FC<YearlyAttendanceReportProps> = ({ year: defaultYear }) => {
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState(defaultYear ?? currentYear);
  const [summaries, setSummaries] = useState<EmployeeYearlySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [deptFilter, setDeptFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string; dept: string } | null>(null);
  const [sortKey, setSortKey] = useState<keyof EmployeeYearlySummary>('employeeName');
  const [sortAsc, setSortAsc] = useState(true);

  const [departments, setDepartments] = useState<string[]>(['All']);

  useEffect(() => {
    fetchAttendanceRoster().then(roster => {
      const depts = Array.from(new Set(roster.map(e => e.dept))).sort();
      setDepartments(['All', ...depts]);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    getEmployeeYearlySummaries(selectedYear).then(data => {
      setSummaries(data);
      setLoading(false);
    });
  }, [selectedYear]);

  useEffect(() => { load(); }, [load]);

  function toggleSort(key: keyof EmployeeYearlySummary) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  const filtered = summaries
    .filter(s => deptFilter === 'All' || s.department === deptFilter)
    .filter(s => s.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || s.employee_id.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const va = a[sortKey]; const vb = b[sortKey];
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

  function exportAllExcel() {
    const rows = filtered.map(s => ({
      'Emp ID': s.employee_id,
      Name: s.employeeName,
      Department: s.department,
      Present: s.present,
      'Paid Leave (L)': s.paidLeave,
      'Unpaid Leave→A': s.unpaidLeave,
      Absent: s.absent,
      'Half-day': s.halfDay,
      Holidays: s.holidays,
      'Week-off': s.weekOff,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Yearly ${selectedYear}`);
    XLSX.writeFile(wb, `attendance_yearly_${selectedYear}.xlsx`);
  }

  const SortIcon: React.FC<{ col: keyof EmployeeYearlySummary }> = ({ col }) => (
    <span className="inline-flex ml-1">
      {sortKey === col
        ? sortAsc ? <ChevronUp size={11} className="inline" /> : <ChevronDown size={11} className="inline" />
        : <ChevronDown size={11} className="inline opacity-30" />
      }
    </span>
  );

  const columns: { key: keyof EmployeeYearlySummary; label: string; color?: string }[] = [
    { key: 'employee_id', label: 'ID' },
    { key: 'employeeName', label: 'Name' },
    { key: 'department', label: 'Dept' },
    { key: 'present', label: 'Present (P)', color: 'text-varistor-limeText' },
    { key: 'paidLeave', label: 'Leave (L)', color: 'text-teal-600' },
    { key: 'unpaidLeave', label: 'L→A (Unpaid)', color: 'text-orange-500' },
    { key: 'absent', label: 'Absent (A)', color: 'text-red-600' },
    { key: 'halfDay', label: 'Half-day (HD)', color: 'text-blue-600' },
    { key: 'holidays', label: 'Holiday (H)', color: 'text-purple-600' },
    { key: 'weekOff', label: 'Week-off (WO)', color: 'text-gray-500' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-varistor-dark flex items-center gap-2">
            <CalendarDays size={18} className="text-varistor-lime" />
            Yearly Attendance Report
          </h3>
          <p className="text-xs text-varistor-muted mt-0.5">
            Full-year P / L / A per employee — leave balance enforced
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="text-xs border border-varistor-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-varistor-lime/30"
          >
            {['2024', '2025', '2026', '2027'].map(y => <option key={y}>{y}</option>)}
          </select>
          <Button variant="secondary" className="text-xs gap-1.5" onClick={exportAllExcel}>
            <FileSpreadsheet size={13} /> Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search employee…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="text-xs border border-varistor-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-varistor-lime/30 min-w-[180px]"
        />
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="text-xs border border-varistor-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-varistor-lime/30"
        >
          {departments.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 items-center bg-varistor-pageBg rounded-xl px-4 py-2.5 border border-varistor-border">
        <span className="text-[10px] font-bold text-varistor-muted uppercase tracking-wide">Legend:</span>
        {[
          { code: 'P', label: 'Present', color: 'bg-varistor-limeTint text-varistor-limeText border-varistor-lime/30' },
          { code: 'L', label: 'Paid Leave', color: 'bg-teal-100 text-teal-800 border-teal-200' },
          { code: 'L→A', label: 'Balance exhausted', color: 'bg-orange-100 text-orange-700 border-orange-200' },
          { code: 'A', label: 'Absent', color: 'bg-red-100 text-red-700 border-red-200' },
          { code: 'HD', label: 'Half-day', color: 'bg-blue-100 text-blue-700 border-blue-200' },
          { code: 'H', label: 'Holiday', color: 'bg-purple-100 text-purple-700 border-purple-200' },
          { code: 'WO', label: 'Week-off', color: 'bg-gray-100 text-gray-500 border-gray-200' },
        ].map(({ code, label, color }) => (
          <div key={code} className="flex items-center gap-1.5 text-[10px] text-varistor-muted">
            <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded border ${color}`}>{code}</span>
            {label}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-varistor-border">
        <table className="w-full text-sm">
          <thead className="bg-varistor-surfaceMuted border-b border-varistor-border">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`text-left text-[11px] font-bold uppercase tracking-wide px-4 py-3 cursor-pointer whitespace-nowrap hover:text-varistor-dark transition-varistor select-none ${col.color ?? 'text-varistor-muted'}`}
                >
                  {col.label}<SortIcon col={col.key} />
                </th>
              ))}
              <th className="text-left text-[11px] font-bold text-varistor-muted uppercase tracking-wide px-4 py-3 whitespace-nowrap">Detail</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-12 text-center">
                  <div className="w-7 h-7 border-2 border-varistor-lime border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-varistor-muted">Loading {selectedYear} report…</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-10 text-center text-xs text-varistor-muted">
                  No employees found
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => (
                <tr
                  key={s.employee_id}
                  className={`border-b border-varistor-border hover:bg-varistor-pageBg transition-varistor ${i % 2 === 1 ? 'bg-varistor-pageBg/40' : ''}`}
                >
                  <td className="px-4 py-3 text-xs text-varistor-muted font-mono">{s.employee_id}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-varistor-dark whitespace-nowrap">{s.employeeName}</td>
                  <td className="px-4 py-3 text-xs text-varistor-muted">{s.department}</td>
                  <td className="px-4 py-3 text-xs font-bold text-varistor-limeText">{s.present}</td>
                  <td className="px-4 py-3 text-xs font-bold text-teal-600">{s.paidLeave}</td>
                  <td className="px-4 py-3 text-xs font-bold text-orange-600">
                    {s.unpaidLeave > 0
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 border border-orange-200 text-[10px]">{s.unpaidLeave} ⚠</span>
                      : <span className="text-varistor-muted">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-red-600">{s.absent}</td>
                  <td className="px-4 py-3 text-xs text-blue-600 font-semibold">{s.halfDay}</td>
                  <td className="px-4 py-3 text-xs text-purple-600 font-semibold">{s.holidays}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-semibold">{s.weekOff}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedEmployee({ id: s.employee_id, name: s.employeeName, dept: s.department })}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-varistor-lime hover:text-varistor-limeText transition-varistor border border-varistor-lime/40 rounded-lg px-2.5 py-1 hover:bg-varistor-limeLight"
                    >
                      <CalendarDays size={11} /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Employee detail modal */}
      {selectedEmployee && (
        <EmployeeYearDetail
          employeeId={selectedEmployee.id}
          employeeName={selectedEmployee.name}
          department={selectedEmployee.dept}
          year={selectedYear}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
};
