/**
 * AttendEase — Universal Attendance & Payroll SaaS
 * Client: Jinson Chit Fund (Initial Deployment)
 * Milestone 2 Implementation: Senior-Friendly Workflows & Configurable Policies
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AttendanceSummaryCards } from './components/AttendanceSummaryCards';
import { NotificationsCard } from './components/NotificationsCard';
import { QuickLinks } from './components/QuickLinks';
import { AttendanceDetailView } from './components/AttendanceDetailView';
import { EmployeesView } from './components/EmployeesView';
import { DeviceManagementView } from './components/DeviceManagementView';
import { PayrollView } from './components/PayrollView';
import { ReportsView } from './components/ReportsView';
import { CorrectionsManager } from './components/CorrectionsManager';
import { LeaveManagementView } from './components/LeaveManagementView';
import { ShiftsAndRulesView } from './components/ShiftsAndRulesView';
import { PocChecklistModal } from './components/PocChecklistModal';
import { DocsViewerModal } from './components/DocsViewerModal';
import { AttendanceCorrectionModal } from './components/AttendanceCorrectionModal';

import { getDataService } from './services/dataService';
import { authService, AuthUser } from './services/authService';
import { 
  Employee, 
  AttendanceDailySummary, 
  AttendanceCorrection, 
  LeaveRequest, 
  Shift,
  Branch,
  AttendanceDevice,
  AppNotification 
} from './types/database.types';
import { 
  Building2, 
  Clock, 
  AlertTriangle, 
  ArrowLeft, 
  CheckCircle2, 
  PhoneCall,
  SunMedium,
  Check,
  FileEdit,
  ShieldCheck
} from 'lucide-react';

export default function App() {
  const dataService = getDataService();
  const isLive = dataService.isLiveMode();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [organizationName, setOrganizationName] = useState<string>('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [attendanceFilter, setAttendanceFilter] = useState<string>('all');
  const [isSeniorMode, setIsSeniorMode] = useState<boolean>(true); // Senior mode on by default for 70+ year old owner
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authService.getCurrentUser());

  // Core application states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summaries, setSummaries] = useState<AttendanceDailySummary[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Time & date
  const [currentTime, setCurrentTime] = useState<string>('');

  // Modals
  const [isPocModalOpen, setIsPocModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [activeDocType, setActiveDocType] = useState<'feasibility' | 'setup' | 'legacy-pc'>('feasibility');
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionTargetEmpId, setCorrectionTargetEmpId] = useState<string | undefined>(undefined);

  const activeBranch = branches.find(b => b.id === selectedBranchId) || branches[0];
  const activeOrganizationId = currentUser?.organizationId || '';
  const primaryDevice = devices[0];

  // Toast feedback helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Auth subscriber
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(user => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Load data only after the live user and their organization membership are resolved.
  // Live mode never falls back to synthetic demo records after a failed request.
  useEffect(() => {
    let isMounted = true;

    if (!currentUser) {
      setBranches([]);
      setDevices([]);
      setEmployees([]);
      setSummaries([]);
      setCorrections([]);
      setLeaveRequests([]);
      setShifts([]);
      setNotifications([]);
      setSelectedBranchId('');
      return () => { isMounted = false; };
    }

    const organizationId = activeOrganizationId;
    if (!organizationId) return () => { isMounted = false; };

    async function loadData() {
      try {
        const [organizationRows, branchRows, employeeRows, summaryRows, correctionRows, leaveRows, shiftRows, deviceRows] = await Promise.all([
          dataService.getOrganizations(),
          dataService.getBranches(organizationId),
          dataService.getEmployees(organizationId, currentUser?.assignedBranchId || (selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : undefined)),
          dataService.getAttendanceSummaries(organizationId),
          dataService.getAttendanceCorrections(organizationId),
          dataService.getLeaveRequests(organizationId),
          dataService.getShifts(organizationId),
          dataService.getDevices(organizationId),
        ]);

        if (!isMounted) return;
        const visibleEmployeeRows = currentUser?.role === 'employee' && currentUser.employeeId
          ? employeeRows.filter(employee => employee.id === currentUser.employeeId)
          : employeeRows;
        const employeeBranchId = currentUser?.role === 'employee'
          ? visibleEmployeeRows[0]?.branch_id
          : currentUser?.assignedBranchId;
        const visibleBranches = employeeBranchId
          ? branchRows.filter(branch => branch.id === employeeBranchId)
          : branchRows;
        const selectedOrganization = organizationRows.find(org => org.id === organizationId);
        setOrganizationName(selectedOrganization?.name || '');
        setBranches(visibleBranches);
        setEmployees(visibleEmployeeRows);
        const visibleEmployeeIds = new Set(visibleEmployeeRows.map(employee => employee.id));
        setSummaries(summaryRows.filter(summary => visibleEmployeeIds.has(summary.employee_id)));
        setCorrections(correctionRows.filter(correction => visibleEmployeeIds.has(correction.employee_id)));
        setLeaveRequests(leaveRows.filter(request => visibleEmployeeIds.has(request.employee_id)));
        setShifts(shiftRows);
        setDevices(deviceRows.filter(device => !selectedBranchId || device.branch_id === selectedBranchId));
        setNotifications([]);
        if (visibleBranches.length > 0) {
          const preferredBranch = currentUser?.assignedBranchId;
          setSelectedBranchId(previous => {
            if (previous && visibleBranches.some(branch => branch.id === previous)) return previous;
            return preferredBranch && visibleBranches.some(branch => branch.id === preferredBranch)
              ? preferredBranch
              : visibleBranches[0].id;
          });
        } else {
          setSelectedBranchId('');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[DataService] Failed to load organization data:', msg);
        if (isMounted) {
          setBranches([]);
          setDevices([]);
          setEmployees([]);
          setSummaries([]);
          setCorrections([]);
          setLeaveRequests([]);
          setShifts([]);
          setNotifications([]);
        }
        showToast(`Unable to load organization data: ${msg}`);
      }
    }

    void loadData();
    return () => { isMounted = false; };
  }, [dataService, isLive, activeOrganizationId, currentUser?.id, currentUser?.assignedBranchId, selectedBranchId]);

  // Real-time IST Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Summary counts
  const totalEmployees = employees.length;
  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const todaySummaries = summaries.filter(summary => summary.work_date === todayIst);
  const presentCount = todaySummaries.filter(s => s.status === 'present').length;
  const lateCount = todaySummaries.filter(s => s.status === 'late' || s.is_late).length;
  const absentCount = todaySummaries.filter(s => s.status === 'absent').length;
  const onLeaveCount = todaySummaries.filter(s => s.status === 'on_leave').length;
  const missingCheckoutCount = todaySummaries.filter(s => s.is_missing_checkout).length;

  // Workflow 1: Add new employee
  const handleAddEmployee = async (newEmpData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const created = await dataService.createEmployee(newEmpData);
      setEmployees(prev => [...prev, created]);

      // A new employee starts with no attendance. Only real device events or authorized corrections create records.

      showToast(`Staff member "${created.display_name}" registered successfully!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Error registering employee: ${msg}`);
    }
  };

  // Workflow 2: Activate / Deactivate employee
  const handleToggleEmployeeStatus = async (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    const nextActive = !emp.is_active;

    try {
      await dataService.updateEmployee(id, {
        is_active: nextActive,
        employment_status: nextActive ? 'active' : 'resigned',
      });
      setEmployees(prev => prev.map(e => {
        if (e.id === id) {
          return {
            ...e,
            is_active: nextActive,
            employment_status: nextActive ? 'active' : 'resigned',
          };
        }
        return e;
      }));
      showToast(`Staff member "${emp.display_name}" is now ${nextActive ? 'Active' : 'Deactivated'}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to update status: ${msg}`);
    }
  };

  // Workflow 3: Submit an attendance correction
  const handleSubmitCorrection = async (correctionData: Omit<AttendanceCorrection, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const created = await dataService.createAttendanceCorrection(correctionData);
      setCorrections(prev => [created, ...prev]);
      showToast('Correction request submitted! Ready for review in Corrections tab.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Error submitting correction: ${msg}`);
    }
  };

  // Workflow 4: Approve attendance correction (Updates summary & resolves missing checkout!)
  const handleApproveCorrection = async (correctionId: string) => {
    if (isLive) {
      showToast('Live correction approval is disabled until the adjustment and daily-summary recalculation are handled in one database transaction.');
      return;
    }
    const targetCorrection = corrections.find(c => c.id === correctionId);
    if (!targetCorrection) return;

    try {
      const updated = await dataService.updateCorrectionStatus(correctionId, 'approved', 'Approved by authorized manager', currentUser?.id);
      setCorrections(prev => prev.map(c => c.id === correctionId ? updated : c));

      // Apply adjusted summary to employee's daily record
      const adj = targetCorrection.adjusted_summary as Partial<AttendanceDailySummary>;
      setSummaries(prev => prev.map(s => {
        if (s.employee_id === targetCorrection.employee_id && s.work_date === targetCorrection.target_date) {
          return {
            ...s,
            ...adj,
            is_missing_checkout: false,
            is_approved: true,
            updated_at: new Date().toISOString(),
          } as AttendanceDailySummary;
        }
        return s;
      }));

      // Remove corresponding notification if it was missing checkout
      setNotifications(prev => prev.filter(n => n.related_entity_id !== targetCorrection.employee_id));

      const emp = employees.find(e => e.id === targetCorrection.employee_id);
      showToast(`✓ Correction approved for ${emp?.display_name || 'Staff'}. Missing checkout resolved!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to approve correction: ${msg}`);
    }
  };

  // Workflow 5: Reject attendance correction
  const handleRejectCorrection = async (correctionId: string) => {
    try {
      const updated = await dataService.updateCorrectionStatus(correctionId, 'rejected', 'Rejected by authorized manager', currentUser?.id);
      setCorrections(prev => prev.map(c => c.id === correctionId ? updated : c));
      showToast('Correction request rejected.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to reject correction: ${msg}`);
    }
  };

  // Workflow 6: Leave application and approval
  const handleApplyLeave = async (reqData: Omit<LeaveRequest, 'id' | 'created_at'>) => {
    try {
      const created = await dataService.createLeaveRequest(reqData);
      setLeaveRequests(prev => [created, ...prev]);
      showToast('Leave application submitted for approval.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Error applying for leave: ${msg}`);
    }
  };

  const handleApproveLeave = async (leaveId: string) => {
    const req = leaveRequests.find(l => l.id === leaveId);
    if (!req) return;

    try {
      const updated = await dataService.updateLeaveRequestStatus(leaveId, 'approved', currentUser?.id);
      setLeaveRequests(prev => prev.map(l => l.id === leaveId ? updated : l));

      // If leave covers today, update employee summary to on_leave
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      if (req.start_date <= today && req.end_date >= today) {
        setSummaries(prev => prev.map(s => {
          if (s.employee_id === req.employee_id && s.work_date === today) {
            return {
              ...s,
              status: 'on_leave',
              remarks: `Approved ${req.leave_type} leave`,
            };
          }
          return s;
        }));
      }

      const emp = employees.find(e => e.id === req.employee_id);
      showToast(isLive
        ? `Leave approved for ${emp?.display_name || 'staff'}. Daily attendance recalculation remains a separate pending workflow.`
        : `✓ Leave approved for ${emp?.display_name || 'Staff'}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to approve leave: ${msg}`);
    }
  };

  const handleRejectLeave = async (leaveId: string) => {
    try {
      const updated = await dataService.updateLeaveRequestStatus(leaveId, 'rejected', currentUser?.id);
      setLeaveRequests(prev => prev.map(l => l.id === leaveId ? updated : l));
      showToast('Leave application rejected.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to reject leave: ${msg}`);
    }
  };

  // Workflow 7: Shift parameters update
  const handleUpdateShiftRule = (updatedShift: Shift) => {
    if (isLive) {
      showToast('Live shift-rule editing is not enabled until persistent shift update and audit services are implemented.');
      return;
    }
    setShifts(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
    showToast('Shift working rules updated for branch.');
  };

  const handleDismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAllNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleCardFilterClick = (filterType: string) => {
    setAttendanceFilter(filterType);
    setCurrentTab('attendance');
  };

  const handleLiveSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    const result = await authService.signInWithPassword(loginEmail, loginPassword);
    setLoginBusy(false);
    if (!result.success) setLoginError(result.error || 'Unable to sign in.');
    else setLoginPassword('');
  };

  if (isLive && (!authReady || !currentUser)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <form onSubmit={handleLiveSignIn} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">AttendEase secure access</div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-600">Use the account created for your organization in Supabase Authentication.</p>
          </div>
          {!authReady && <p className="text-sm text-slate-600">Restoring your session…</p>}
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <input type="email" autoComplete="username" required value={loginEmail} onChange={event => setLoginEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Password
            <input type="password" autoComplete="current-password" required value={loginPassword} onChange={event => setLoginPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          {loginError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{loginError}</p>}
          <button disabled={!authReady || loginBusy} type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50">
            {loginBusy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-xs text-slate-500">If your account has no organization membership, ask the organization owner to provision it. Demo identities are not accepted in live mode.</p>
        </form>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased ${
      isSeniorMode ? 'text-base' : 'text-sm'
    }`}>
      {/* Top Bar Contract Navigation */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        organizationName={organizationName || 'AttendEase'}
        branchName={activeBranch?.name || 'No branch assigned'}
        isSeniorMode={isSeniorMode}
        onToggleSeniorMode={() => setIsSeniorMode(!isSeniorMode)}
      />

      {/* Toast Notification Bar */}
      {toastMessage && (
        <div className="bg-slate-900 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-lg sticky top-16 z-40 animate-in fade-in">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Subheader Toolbar with Branch Switcher and Live Clock */}
      <div className="bg-white border-b border-slate-200 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Branch:</span>
            </div>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500 hidden md:inline">
              · {activeBranch?.address || ''}{activeBranch?.city ? `, ${activeBranch.city}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            {isLive && currentUser && (
              <button
                type="button"
                onClick={() => void authService.signOut().catch(error => showToast(error instanceof Error ? error.message : 'Unable to sign out.'))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            )}
            <div className="flex items-center gap-2 font-mono tabular-nums bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
              <Clock className="w-4 h-4 text-slate-600" />
              <span className="font-bold text-slate-900 text-xs sm:text-sm">{currentTime || '—'}</span>
              <span className="text-[11px] text-slate-500 font-sans font-semibold">IST (Kerala)</span>
            </div>

            {currentTab !== 'dashboard' && (
              <button
                type="button"
                onClick={() => setCurrentTab('dashboard')}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 transition-colors px-2 py-1 bg-slate-100 rounded cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Senior-Friendly Greeting & Welcome */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                  {currentUser?.role === 'company_owner' ? 'Owner Overview' : 'Organization Overview'}
                </span>
                <h1 className={`font-bold tracking-tight text-slate-900 ${
                  isSeniorMode ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                }`}>
                  Good day, {currentUser?.fullName || 'there'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  {activeBranch?.name || 'Your branch'} · Organization attendance overview
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSeniorMode(!isSeniorMode)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isSeniorMode 
                      ? 'bg-amber-100 text-amber-950 border-amber-300' 
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <SunMedium className="w-4 h-4 text-amber-600" />
                  <span>{isSeniorMode ? 'Senior View: On' : 'Standard View'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPocModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Hardware Testing Guide</span>
                </button>
              </div>
            </div>

            {/* Senior Missing Checkout Action Banner */}
            {missingCheckoutCount > 0 && (
              <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-2xl text-orange-950 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-200/80 flex items-center justify-center text-orange-800 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base leading-tight">
                      Attention: {missingCheckoutCount} Staff Member{missingCheckoutCount === 1 ? '' : 's'} Has No Check-out Scan Today
                    </h3>
                    <p className="text-xs text-orange-800 mt-0.5">
                      {employees.find(employee => summaries.find(summary => summary.employee_id === employee.id && summary.is_missing_checkout))?.display_name || 'A staff member'} has a missing checkout scan.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCorrectionTargetEmpId(summaries.find(summary => summary.is_missing_checkout)?.employee_id);
                    setIsCorrectionModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-orange-800 hover:bg-orange-900 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <FileEdit className="w-4 h-4" />
                  <span>Review &amp; Fix Check-Out</span>
                </button>
              </div>
            )}

            {/* Attendance KPI Cards */}
            <AttendanceSummaryCards
              total={totalEmployees}
              present={presentCount}
              absent={absentCount}
              late={lateCount}
              onLeave={onLeaveCount}
              missingCheckout={missingCheckoutCount}
              isSeniorMode={isSeniorMode}
              onCardClick={handleCardFilterClick}
            />

            {/* Middle Section: Device Health & Payroll Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-900">Device status</h3>
                <p className="mt-1 text-sm text-slate-600">{primaryDevice ? 'Registered device details are available in Device Management. Live connectivity has not been independently verified.' : 'No attendance device has been registered for this branch.'}</p>
                <button type="button" onClick={() => setCurrentTab('devices')} className="mt-3 text-sm font-semibold underline">Open device management</button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-900">Payroll readiness</h3>
                <p className="mt-1 text-sm text-slate-600">Payroll totals remain unavailable until salary data and customer-approved payroll rules are configured.</p>
                <button type="button" onClick={() => setCurrentTab('payroll')} className="mt-3 text-sm font-semibold underline">Open payroll</button>
              </div>
            </div>

            {/* Bottom Section: Action Items & Quick Links */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <NotificationsCard
                notifications={notifications}
                onDismiss={handleDismissNotification}
                onClearAll={handleClearAllNotifications}
              />

              <QuickLinks
                onSelectTab={setCurrentTab}
                onOpenPocModal={() => setIsPocModalOpen(true)}
              />
            </div>
          </div>
        )}

        {currentTab === 'attendance' && (
          <AttendanceDetailView
            summaries={summaries}
            employees={employees}
            initialFilter={attendanceFilter}
            onRequestCorrection={(empId) => {
              setCorrectionTargetEmpId(empId);
              setIsCorrectionModalOpen(true);
            }}
          />
        )}

        {currentTab === 'corrections' && (
          <>
            {isLive && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                Live correction requests can be submitted and reviewed. Approval and rejection remain disabled until the database workflow atomically records the decision and recalculates the daily attendance summary.
              </div>
            )}
            <CorrectionsManager
              corrections={corrections}
              employees={employees}
              onApprove={isLive ? () => showToast('Live correction approval is not enabled yet.') : handleApproveCorrection}
              onReject={isLive ? () => showToast('Live correction rejection is not enabled yet.') : handleRejectCorrection}
              onOpenNewModal={() => {
                setCorrectionTargetEmpId(undefined);
                setIsCorrectionModalOpen(true);
              }}
            />
          </>
        )}

        {currentTab === 'leave' && (
          <>
            {isLive && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                Live leave applications are saved. Approval decisions are temporarily disabled until approved leave can be applied to attendance summaries atomically and audited.
              </div>
            )}
            <LeaveManagementView
              organizationId={activeOrganizationId}
              canDecideRequests={!isLive}
              leaveRequests={leaveRequests}
              employees={employees}
              onApplyLeave={handleApplyLeave}
              onApproveLeave={handleApproveLeave}
              onRejectLeave={handleRejectLeave}
            />
          </>
        )}

        {currentTab === 'employees' && (
          isLive && !['company_owner', 'company_admin', 'branch_manager', 'employee'].includes(currentUser?.role || '') ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
              <h2 className="font-bold">Employee records are restricted</h2>
              <p className="mt-1 text-sm">Your organization role does not permit employee-directory access.</p>
            </div>
          ) : (
            <EmployeesView
              organizationId={activeOrganizationId}
              canManage={!isLive || currentUser?.role === 'company_owner' || currentUser?.role === 'company_admin'}
              employees={employees}
              shifts={shifts}
              branches={branches}
              onAddEmployee={handleAddEmployee}
              onToggleStatus={handleToggleEmployeeStatus}
            />
          )
        )}

        {currentTab === 'shifts' && (
          isLive ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
              <h2 className="font-bold">Live shift-rule editing is not enabled</h2>
              <p className="mt-1 text-sm">The demo screen edits local state only. Persistent shift configuration and audit logging must be completed before editing live shift rules.</p>
            </div>
          ) : <ShiftsAndRulesView shifts={shifts} onUpdateShiftRule={handleUpdateShiftRule} />
        )}

        {currentTab === 'devices' && (
          isLive ? (
            <section className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
                <h2 className="font-bold">Hardware connector not yet verified</h2>
                <p className="mt-1 text-sm">This screen shows devices registered in the database only. Live connectivity tests, attendance retrieval and synchronization remain disabled until the branch Edge Connector is implemented and physically tested with the terminal.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-bold text-slate-900">Registered devices</h3>
                {devices.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No devices are registered for the selected branch.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {devices.map(device => (
                      <li key={device.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">{device.device_name}</div>
                          <div className="text-xs text-slate-500">{device.manufacturer} · {device.model} · Serial: {device.serial_number}</div>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">Database status: {device.status.replaceAll('_', ' ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ) : (
            <DeviceManagementView devices={devices} onOpenPocModal={() => setIsPocModalOpen(true)} />
          )
        )}

        {currentTab === 'payroll' && (
          isLive ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
              <h2 className="font-bold">Live payroll workflow is not enabled</h2>
              <p className="mt-1 text-sm">The current repository contains a payroll preview, but payroll calculation, approval and immutable database persistence have not yet been connected end to end. Do not use this screen to calculate or pay real salaries.</p>
            </div>
          ) : <PayrollView employees={employees} />
        )}

        {currentTab === 'reports' && (
          <ReportsView
            summaries={summaries}
            employees={employees}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-700">AttendEase SaaS</span> · Universal Attendance &amp; Payroll Platform
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span>{isLive ? 'Authenticated organization workspace' : 'Live organization workspace'}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                setActiveDocType('feasibility');
                setIsDocsModalOpen(true);
              }}
              className="hover:text-slate-900 underline cursor-pointer"
            >
              Hikvision Spec
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                setActiveDocType('legacy-pc');
                setIsDocsModalOpen(true);
              }}
              className="hover:text-slate-900 underline cursor-pointer"
            >
              Legacy PC Plan
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                setActiveDocType('setup');
                setIsDocsModalOpen(true);
              }}
              className="hover:text-slate-900 underline cursor-pointer"
            >
              Setup Guide
            </button>
          </div>
        </div>
      </footer>

      {/* Hardware POC Checklist Modal */}
      <PocChecklistModal
        isOpen={isPocModalOpen}
        onClose={() => setIsPocModalOpen(false)}
      />

      {/* Documentation Viewer Modal */}
      <DocsViewerModal
        isOpen={isDocsModalOpen}
        initialDoc={activeDocType}
        onClose={() => setIsDocsModalOpen(false)}
      />

      {/* Attendance Correction Modal */}
      <AttendanceCorrectionModal
        organizationId={activeOrganizationId}
        requestedByUserId={currentUser?.id || ''}
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        employees={employees}
        summaries={summaries}
        preSelectedEmployeeId={correctionTargetEmpId}
        onSubmit={handleSubmitCorrection}
      />
    </div>
  );
}
