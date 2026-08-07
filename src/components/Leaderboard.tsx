import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Search, Medal, User, Award, RefreshCw } from 'lucide-react';
import { getEmployees, type Employee } from '../api/employees';
import { useVariPoints } from '../hooks/useVariPoints';

interface RankedEmployee extends Employee {
  rank: number;
}

export const Leaderboard: React.FC = () => {
  const [employees, setEmployees] = useState<RankedEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  
  const { currentRole } = useVariPoints();
  
  // A crude way to identify the current user using currentRole logic since we don't have a real auth context right now.
  // In a real app, you'd compare employee.id to currentUser.id.
  const isCurrentUser = (emp: Employee) => {
    if (currentRole === 'Admin' && emp.role === 'Admin') return true;
    if (currentRole === 'HR' && emp.role === 'HR') return true;
    if (currentRole === 'Reporting Manager' && emp.role === 'Reporting Manager') return true;
    if (currentRole === 'Employee' && emp.role === 'Employee') return true;
    if (currentRole === 'Field Employee' && emp.role === 'Field Employee') return true;
    return false;
  };

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setIsLoading(true);
        const data = await getEmployees();
        // Sort by variPoints descending
        const sorted = data.sort((a, b) => (b.variPoints || 0) - (a.variPoints || 0));
        
        // Add rank
        const ranked: RankedEmployee[] = sorted.map((emp, index) => ({
          ...emp,
          rank: index + 1
        }));
        
        setEmployees(ranked);
      } catch (err) {
        console.error("Failed to load leaderboard data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const departments = useMemo(() => {
    const deps = new Set(employees.map(e => e.department));
    return ['All', ...Array.from(deps)];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.fullName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = departmentFilter === 'All' || emp.department === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [employees, searchQuery, departmentFilter]);

  const top3 = filteredEmployees.slice(0, 3);
  const rest = filteredEmployees.slice(3);

  const getPodiumColor = (rank: number) => {
    switch(rank) {
      case 1: return 'from-yellow-300 to-yellow-500 border-yellow-400 text-yellow-700 shadow-yellow-200';
      case 2: return 'from-gray-300 to-gray-400 border-gray-300 text-gray-700 shadow-gray-200';
      case 3: return 'from-amber-600 to-amber-700 border-amber-600 text-amber-100 shadow-amber-900/30';
      default: return 'from-white to-gray-50 border-gray-200';
    }
  };

  const getMedalColor = (rank: number) => {
    switch(rank) {
      case 1: return 'text-yellow-500';
      case 2: return 'text-gray-400';
      case 3: return 'text-amber-700';
      default: return 'text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin text-varistor-lime"><RefreshCw size={32} /></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-varistor shadow-sm border border-varistor-border overflow-hidden">
      <div className="bg-gradient-to-r from-varistor-dark to-varistor-darker p-6 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="text-yellow-400" />
            Points Leaderboard
          </h2>
          <p className="text-varistor-muted mt-1 text-sm">Top performers across the organization</p>
        </div>
      </div>

      <div className="p-6 bg-varistor-pageBg">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-varistor-lime/50 text-sm"
            />
          </div>
          <div className="flex-1 md:max-w-xs">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-4 py-2 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-varistor-lime/50 text-sm bg-white"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Podium Top 3 */}
        {top3.length > 0 && (
          <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-8 mb-12 mt-8 h-auto md:h-64 px-4">
            
            {/* Rank 2 (Silver) */}
            {top3[1] && (
              <div className={`order-2 md:order-1 flex flex-col items-center flex-1 max-w-[200px] w-full transform transition-transform hover:-translate-y-2 ${isCurrentUser(top3[1]) ? 'ring-4 ring-varistor-lime/50 rounded-xl' : ''}`}>
                <div className="relative mb-4">
                  <div className={`w-20 h-20 rounded-full border-4 shadow-lg flex items-center justify-center bg-gradient-to-br ${getPodiumColor(2)}`}>
                    <User size={32} className="opacity-75" />
                  </div>
                  <div className="absolute -bottom-3 -right-2 bg-white rounded-full p-1 shadow-sm">
                    <Medal size={24} className={getMedalColor(2)} />
                  </div>
                </div>
                <div className={`w-full bg-gradient-to-t ${getPodiumColor(2)} h-24 md:h-32 rounded-t-xl shadow-lg border flex flex-col items-center justify-start pt-4 px-2 text-center`}>
                  <span className="font-black text-2xl opacity-50 absolute top-2 left-2">2</span>
                  <h3 className="font-bold text-sm truncate w-full">{top3[1].fullName}</h3>
                  <p className="text-[10px] opacity-80 uppercase tracking-wider mb-2">{top3[1].department}</p>
                  <div className="bg-white/30 backdrop-blur-sm rounded-full px-3 py-1 font-black text-sm flex items-center gap-1">
                    <Award size={14} /> {top3[1].variPoints}
                  </div>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold) */}
            <div className={`order-1 md:order-2 flex flex-col items-center flex-1 max-w-[220px] w-full transform transition-transform hover:-translate-y-2 z-10 ${isCurrentUser(top3[0]) ? 'ring-4 ring-varistor-lime/50 rounded-xl' : ''}`}>
              <div className="relative mb-4">
                <Trophy size={32} className="text-yellow-500 absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce" />
                <div className={`w-24 h-24 rounded-full border-4 shadow-xl flex items-center justify-center bg-gradient-to-br ${getPodiumColor(1)}`}>
                  <User size={40} className="opacity-75" />
                </div>
                <div className="absolute -bottom-3 -right-2 bg-white rounded-full p-1 shadow-sm">
                  <Medal size={28} className={getMedalColor(1)} />
                </div>
              </div>
              <div className={`w-full bg-gradient-to-t ${getPodiumColor(1)} h-32 md:h-44 rounded-t-xl shadow-2xl border flex flex-col items-center justify-start pt-6 px-2 text-center relative overflow-hidden`}>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
                <span className="font-black text-3xl opacity-50 absolute top-2 left-3">1</span>
                <h3 className="font-bold text-base truncate w-full relative z-10">{top3[0].fullName}</h3>
                <p className="text-xs opacity-80 uppercase tracking-wider mb-3 relative z-10">{top3[0].department}</p>
                <div className="bg-white/30 backdrop-blur-md rounded-full px-4 py-1.5 font-black text-base flex items-center gap-1 relative z-10 shadow-inner">
                  <Award size={16} /> {top3[0].variPoints}
                </div>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            {top3[2] && (
              <div className={`order-3 md:order-3 flex flex-col items-center flex-1 max-w-[200px] w-full transform transition-transform hover:-translate-y-2 ${isCurrentUser(top3[2]) ? 'ring-4 ring-varistor-lime/50 rounded-xl' : ''}`}>
                <div className="relative mb-4">
                  <div className={`w-20 h-20 rounded-full border-4 shadow-lg flex items-center justify-center bg-gradient-to-br ${getPodiumColor(3)}`}>
                    <User size={32} className="opacity-75" />
                  </div>
                  <div className="absolute -bottom-3 -right-2 bg-white rounded-full p-1 shadow-sm">
                    <Medal size={24} className={getMedalColor(3)} />
                  </div>
                </div>
                <div className={`w-full bg-gradient-to-t ${getPodiumColor(3)} h-20 md:h-24 rounded-t-xl shadow-lg border flex flex-col items-center justify-start pt-3 px-2 text-center`}>
                  <span className="font-black text-xl opacity-50 absolute top-2 left-2">3</span>
                  <h3 className="font-bold text-sm truncate w-full">{top3[2].fullName}</h3>
                  <p className="text-[10px] opacity-80 uppercase tracking-wider mb-2">{top3[2].department}</p>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 font-black text-sm flex items-center gap-1">
                    <Award size={14} /> {top3[2].variPoints}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scrollable List for Rank 4+ */}
        {rest.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold text-gray-500 w-16 text-center">Rank</th>
                    <th className="px-6 py-4 font-bold text-gray-500">Employee</th>
                    <th className="px-6 py-4 font-bold text-gray-500">Department</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-right">Vari Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rest.map((emp) => (
                    <tr 
                      key={emp.id} 
                      className={`hover:bg-gray-50 transition-colors ${isCurrentUser(emp) ? 'bg-varistor-lime/5' : ''}`}
                    >
                      <td className="px-6 py-4 font-bold text-gray-400 text-center">#{emp.rank}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-500 ${isCurrentUser(emp) ? 'ring-2 ring-varistor-lime' : ''}`}>
                            <User size={16} />
                          </div>
                          <div>
                            <div className="font-bold text-varistor-dark flex items-center gap-2">
                              {emp.fullName}
                              {isCurrentUser(emp.fullName) && <span className="bg-varistor-lime text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">You</span>}
                            </div>
                            <div className="text-xs text-gray-400">{emp.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{emp.department}</td>
                      <td className="px-6 py-4 font-black text-varistor-dark text-right flex items-center justify-end gap-1">
                        <Award size={16} className="text-varistor-lime" /> {emp.variPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Trophy className="mx-auto text-gray-300 mb-3" size={48} />
            <h3 className="text-lg font-bold text-gray-500">No employees found</h3>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your search or department filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};
