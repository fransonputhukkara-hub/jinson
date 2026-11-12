/**
 * AttendEase — Universal Attendance & Payroll SaaS
 * Client: Jinson Chit Fund (Initial Deployment)
 * Milestone 2 Implementation: Senior-Friendly Workflows & Configurable Policies
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DemoBanner } from './components/DemoBanner';
import { AttendanceSummaryCards } from './components/AttendanceSummaryCards';
import { DeviceHealthCard } from './components/DeviceHealthCard';
import { PayrollStatusCard } from './components/PayrollStatusCard';
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

import { 
  DEMO_ORGANIZATION, 
  DEMO_BRANCHES, 
  DEMO_SHIFTS, 
  DEMO_EMPLOYEES, 
  DEMO_DEVICES, 
  DEMO_SUMMARIES, 
  DEMO_NOTIFICATIONS,
  DEMO_CORRECTIONS,
  DEMO_LEAVE_REQUESTS
} from './data/demoData';
import { getDataService } from './services/dataService';
import { authService, AuthUser } from './services/authService';
import { 
  Employee, 
  AttendanceDailySummary, 
  AttendanceCorrection, 
  LeaveRequest, 
  Shift,
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
  const [selectedBranchId, setSelectedBranchId] = useState<string>(DEMO_BRANCHES[0].id);
  const [attendanceFilter, setAttendanceFilter] = useState<string>('all');
  const [isSeniorMode, setIsSeniorMode] = useState<boolean>(true); // Senior mode on by default for 70+ year old owner
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authService.getCurrentUser());

  // Core application states
  const [employees, setEmployees] = useState<Employee[]>(DEMO_EMPLOYEES);
  const [summaries, setSummaries] = useState<AttendanceDailySummary[]>(DEMO_SUMMARIES);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>(DEMO_CORRECTIONS);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(DEMO_LEAVE_REQUESTS);
  const [shifts, setShifts] = useState<Shift[]>(DEMO_SHIFTS);
  const [notifications, setNotifications] = useState<AppNotification[]>(DEMO_NOTIFICATIONS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Time & date
  const [currentTime, setCurrentTime] = useState<string>('');

  // Modals
  const [isPocModalOpen, setIsPocModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [activeDocType, setActiveDocType] = useState<'feasibility' | 'setup' | 'legacy-pc'>('feasibility');
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionTargetEmpId, setCorrectionTargetEmpId] = useState<string | undefined>(undefined);

  const activeBranch = DEMO_BRANCHES.find(b => b.id === selectedBranchId) || DEMO_BRANCHES[0];
  const primaryDevice = DEMO_DEVICES[0]; // Hikvision DS-K1T320MFWX

  // Toast feedback helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Auth subscriber
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(user => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Async data loader from dataService
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [emps, sums, corrs, leaves, shs] = await Promise.all([
          dataService.getEmployees('org-jinson-chit-fund'),
          dataService.getAttendanceSummaries('org-jinson-chit-fund'),
          dataService.getAttendanceCorrections('org-jinson-chit-fund'),
          dataService.getLeaveRequests('org-jinson-chit-fund'),
          dataService.getShifts('org-jinson-chit-fund'),
        ]);
        if (isMounted) {
          if (emps.length > 0) setEmployees(emps);
          if (sums.length > 0) setSummaries(sums);
          if (corrs.length > 0) setCorrections(corrs);
          if (leaves.length > 0) setLeaveRequests(leaves);
          if (shs.length > 0) setShifts(shs);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[DataService] Error loading data:', msg);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [dataService]);

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
  const presentCount = summaries.filter(s => s.status === 'present').length;
  const lateCount = summaries.filter(s => s.status === 'late' || s.is_late).length;
  const absentCount = summaries.filter(s => s.status === 'absent').length;
  const onLeaveCount = summaries.filter(s => s.status === 'on_leave').length;
  const missingCheckoutCount = summaries.filter(s => s.is_missing_checkout).length;

  // Workflow 1: Add new employee
  const handleAddEmployee = async (newEmpData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const created = await dataService.createEmployee(newEmpData);
      setEmployees(prev => [...prev, created]);

      // Create an initial summary record for today
      const newSummary: AttendanceDailySummary = {
        id: `sum-${created.id}-2026-10-15`,
        organization_id: 'org-jinson-chit-fund',
        employee_id: created.id,
        work_date: '2026-10-15',
        total_work_minutes: 0,
        total_break_minutes: 0,
        overtime_minutes: 0,
        status: 'present',
        is_late: false,
        late_minutes: 0,
        is_early_departure: false,
        early_departure_minutes: 0,
        is_missing_checkout: false,
        first_check_in: '2026-10-15T09:30:00+05:30',
        is_approved: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setSummaries(prev => [...prev, newSummary]);

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
      if (req.start_date <= '2026-10-15' && req.end_date >= '2026-10-15') {
        setSummaries(prev => prev.map(s => {
          if (s.employee_id === req.employee_id && s.work_date === '2026-10-15') {
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
      showToast(`✓ Leave approved for ${emp?.display_name || 'Staff'}.`);
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

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased ${
      isSeniorMode ? 'text-base' : 'text-sm'
    }`}>
      {/* Top Bar Contract Navigation */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        organizationName={DEMO_ORGANIZATION.name}
        branchName={activeBranch.name}
        isSeniorMode={isSeniorMode}
        onToggleSeniorMode={() => setIsSeniorMode(!isSeniorMode)}
      />

      {/* Prominent Demo / Live Mode Banner */}
      <DemoBanner
        isLiveMode={isLive}
        onOpenPocDoc={() => {
          setActiveDocType('feasibility');
          setIsDocsModalOpen(true);
        }}
        onOpenSetupDoc={() => {
          setActiveDocType('setup');
          setIsDocsModalOpen(true);
        }}
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
              {DEMO_BRANCHES.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500 hidden md:inline">
              · {activeBranch.address}, {activeBranch.city}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-mono tabular-nums bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
              <Clock className="w-4 h-4 text-slate-600" />
              <span className="font-bold text-slate-900 text-xs sm:text-sm">{currentTime || '09:30:00 AM'}</span>
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
                  Owner Overview
                </span>
                <h1 className={`font-bold tracking-tight text-slate-900 ${
                  isSeniorMode ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                }`}>
                  Good day, Mr. Jinson Varghese
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Thrissur Main Office · General Shift: 09:30 AM to 06:00 PM (15 min grace period)
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
                      Attention: 1 Staff Member Has No Check-out Scan Today
                    </h3>
                    <p className="text-xs text-orange-800 mt-0.5">
                      Rahul Menon (Auction Officer) scanned In at 09:35 AM but has no Out punch recorded.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCorrectionTargetEmpId('emp-004'); // Rahul Menon
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
              <DeviceHealthCard
                device={primaryDevice}
                onOpenManagement={() => setCurrentTab('devices')}
              />

              <PayrollStatusCard
                currentPeriod="October 2026"
                currentStatus="draft"
                eligibleEmployeesCount={totalEmployees}
                totalGrossEstimate={224000}
                previousPeriod="September 2026"
                previousStatus="locked"
                onOpenPayroll={() => setCurrentTab('payroll')}
              />
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
          <CorrectionsManager
            corrections={corrections}
            employees={employees}
            onApprove={handleApproveCorrection}
            onReject={handleRejectCorrection}
            onOpenNewModal={() => {
              setCorrectionTargetEmpId(undefined);
              setIsCorrectionModalOpen(true);
            }}
          />
        )}

        {currentTab === 'leave' && (
          <LeaveManagementView
            leaveRequests={leaveRequests}
            employees={employees}
            onApplyLeave={handleApplyLeave}
            onApproveLeave={handleApproveLeave}
            onRejectLeave={handleRejectLeave}
          />
        )}

        {currentTab === 'employees' && (
          <EmployeesView
            employees={employees}
            shifts={shifts}
            branches={DEMO_BRANCHES}
            onAddEmployee={handleAddEmployee}
            onToggleStatus={handleToggleEmployeeStatus}
          />
        )}

        {currentTab === 'shifts' && (
          <ShiftsAndRulesView
            shifts={shifts}
            onUpdateShiftRule={handleUpdateShiftRule}
          />
        )}

        {currentTab === 'devices' && (
          <DeviceManagementView
            devices={DEMO_DEVICES}
            onOpenPocModal={() => setIsPocModalOpen(true)}
          />
        )}

        {currentTab === 'payroll' && (
          <PayrollView employees={employees} />
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
            <span>Milestone 2 Verified Demo</span>
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
