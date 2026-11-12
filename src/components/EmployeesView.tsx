import React, { useEffect, useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Building2, 
  Briefcase, 
  Clock, 
  Fingerprint, 
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  PlusCircle,
  Edit2
} from 'lucide-react';
import { Employee, Shift, Branch } from '../types/database.types';

interface EmployeesViewProps {
  organizationId: string;
  canManage?: boolean;
  employees: Employee[];
  shifts: Shift[];
  branches: Branch[];
  onAddEmployee: (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => void;
  onToggleStatus: (id: string) => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  organizationId,
  canManage = true,
  employees,
  shifts,
  branches,
  onAddEmployee,
  onToggleStatus,
}) => {
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [shiftId, setShiftId] = useState(shifts[0]?.id || '');
  const [joiningDate, setJoiningDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));

  useEffect(() => { if (!branchId && branches[0]) setBranchId(branches[0].id); }, [branchId, branches]);
  useEffect(() => { if (!shiftId && shifts[0]) setShiftId(shifts[0].id); }, [shiftId, shifts]);

  const branchMap = new Map(branches.map(b => [b.id, b]));
  const shiftMap = new Map(shifts.map(s => [s.id, s]));

  const filtered = employees.filter(emp => {
    const matchesSearch = !search ||
      emp.display_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      emp.designation.toLowerCase().includes(search.toLowerCase());

    const matchesBranch = filterBranch === 'all' || emp.branch_id === filterBranch;
    return matchesSearch && matchesBranch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      alert('No authorized branch is available for this account. Ask your organization administrator to assign a branch.');
      return;
    }
    if (!firstName || !lastName || !employeeCode || !designation) {
      alert('Please fill all mandatory fields (First Name, Last Name, Employee Code, Designation).');
      return;
    }

    onAddEmployee({
      organization_id: organizationId,
      branch_id: branchId,
      employee_code: employeeCode,
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`,
      designation,
      phone,
      email,
      joining_date: joiningDate,
      employment_status: 'active',
      is_active: true,
      ...(shiftId ? { shift_id: shiftId } : {}),
    });

    // Reset
    setFirstName('');
    setLastName('');
    setEmployeeCode('');
    setDesignation('');
    setPhone('');
    setEmail('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee roster..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
            />
          </div>

          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setEmployeeCode(`JCF-00${employees.length + 1}`);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        )}
      </div>

      {/* Employees Grid / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Designation &amp; Role</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">Device Enrollment</th>
                <th className="py-3 px-3">Shift Timing</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => {
                const branch = branchMap.get(emp.branch_id);
                const shift = emp.shift_id ? shiftMap.get(emp.shift_id) : undefined;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {emp.display_name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Code: {emp.employee_code} · Joined: {emp.joining_date}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-800">{emp.designation}</div>
                      <div className="text-xs text-slate-500">{emp.phone || 'No phone'}</div>
                    </td>

                    <td className="py-3.5 px-3 text-slate-700">
                      <div className="font-medium">{branch?.name || 'Main Branch'}</div>
                      <div className="text-[11px] text-slate-400">{branch?.city}</div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700">
                        <Fingerprint className="w-3.5 h-3.5 text-slate-600" />
                        <span>Not linked</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-slate-600">
                      <div className="font-medium text-slate-800">{shift?.name || 'General Shift'}</div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500">
                        {shift?.start_time} - {shift?.end_time}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      {emp.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                          <XCircle className="w-3 h-3 text-slate-400" />
                          Deactivated
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => onToggleStatus(emp.id)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
                          emp.is_active
                            ? 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                          {emp.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      ) : <span className="text-xs text-slate-400">View only</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-slate-900" />
                <h3 className="text-lg font-bold text-slate-900">Add New Employee</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 font-semibold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Suresh"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Kumar"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Employee App Code *</label>
                <input
                  type="text"
                  required
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="e.g. JCF-008"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
                <p className="mt-1 text-xs text-slate-500">The terminal user ID is assigned and linked during physical device enrollment. This form does not create a hardware mapping.</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Designation &amp; Role *</label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Junior Chit Accounts Clerk"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Branch</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Shift</label>
                  <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.start_time}-{s.end_time})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Date of Joining</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs shadow-xs"
                >
                  Save Employee Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
