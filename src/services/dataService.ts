import { 
  Organization, 
  Branch, 
  Employee, 
  AttendanceDailySummary, 
  AttendanceCorrection, 
  LeaveRequest, 
  Shift, 
  AttendanceDevice, 
  PayrollRun, 
  PayrollItem, 
  AppNotification 
} from '../types/database.types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  DEMO_ORGANIZATION, 
  DEMO_BRANCHES, 
  DEMO_EMPLOYEES, 
  DEMO_SUMMARIES, 
  DEMO_CORRECTIONS, 
  DEMO_LEAVE_REQUESTS, 
  DEMO_SHIFTS, 
  DEMO_DEVICES, 
  DEMO_NOTIFICATIONS 
} from '../data/demoData';

export interface IDataService {
  isLiveMode(): boolean;
  getOrganizations(): Promise<Organization[]>;
  getBranches(organizationId: string): Promise<Branch[]>;
  getEmployees(organizationId: string, branchId?: string): Promise<Employee[]>;
  createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee>;
  updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee>;
  getAttendanceSummaries(organizationId: string, date?: string): Promise<AttendanceDailySummary[]>;
  getAttendanceCorrections(organizationId: string): Promise<AttendanceCorrection[]>;
  createAttendanceCorrection(correction: Omit<AttendanceCorrection, 'id' | 'created_at' | 'updated_at'>): Promise<AttendanceCorrection>;
  updateCorrectionStatus(id: string, status: 'approved' | 'rejected', notes?: string, approvedBy?: string): Promise<AttendanceCorrection>;
  getLeaveRequests(organizationId: string, employeeId?: string): Promise<LeaveRequest[]>;
  createLeaveRequest(request: Omit<LeaveRequest, 'id' | 'created_at'>): Promise<LeaveRequest>;
  updateLeaveRequestStatus(id: string, status: 'approved' | 'rejected', approvedBy?: string, notes?: string): Promise<LeaveRequest>;
  getShifts(organizationId: string): Promise<Shift[]>;
  createShift(shift: Omit<Shift, 'id' | 'created_at'>): Promise<Shift>;
  getDevices(organizationId: string): Promise<AttendanceDevice[]>;
  createDevice(device: Omit<AttendanceDevice, 'id' | 'created_at' | 'updated_at'>): Promise<AttendanceDevice>;
  getPayrollRuns(organizationId: string): Promise<PayrollRun[]>;
  getPayrollItems(payrollRunId: string): Promise<PayrollItem[]>;
}

/**
 * In-memory Mock Service for safe demo and offline testing.
 * Reactively updates internal collections to simulate a full backend.
 */
class DemoDataService implements IDataService {
  private organizations: Organization[] = [DEMO_ORGANIZATION];
  private branches: Branch[] = [...DEMO_BRANCHES];
  private employees: Employee[] = [...DEMO_EMPLOYEES];
  private summaries: AttendanceDailySummary[] = [...DEMO_SUMMARIES];
  private corrections: AttendanceCorrection[] = [...DEMO_CORRECTIONS];
  private leaveRequests: LeaveRequest[] = [...DEMO_LEAVE_REQUESTS];
  private shifts: Shift[] = [...DEMO_SHIFTS];
  private devices: AttendanceDevice[] = [...DEMO_DEVICES];
  private payrollRuns: PayrollRun[] = [];
  private payrollItems: PayrollItem[] = [];

  isLiveMode(): boolean {
    return false;
  }

  async getOrganizations(): Promise<Organization[]> {
    return [...this.organizations];
  }

  async getBranches(organizationId: string): Promise<Branch[]> {
    return this.branches.filter(b => b.organization_id === organizationId);
  }

  async getEmployees(organizationId: string, branchId?: string): Promise<Employee[]> {
    return this.employees.filter(e => {
      if (e.organization_id !== organizationId) return false;
      if (branchId && branchId !== 'all' && e.branch_id !== branchId) return false;
      return true;
    });
  }

  async createEmployee(employeeData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
    const newEmp: Employee = {
      ...employeeData,
      id: `emp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.employees.unshift(newEmp);
    return newEmp;
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee> {
    const idx = this.employees.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Employee not found');
    this.employees[idx] = { ...this.employees[idx], ...updates, updated_at: new Date().toISOString() };
    return this.employees[idx];
  }

  async getAttendanceSummaries(organizationId: string, date?: string): Promise<AttendanceDailySummary[]> {
    return this.summaries.filter(s => {
      if (s.organization_id !== organizationId) return false;
      if (date && s.work_date !== date) return false;
      return true;
    });
  }

  async getAttendanceCorrections(organizationId: string): Promise<AttendanceCorrection[]> {
    return this.corrections.filter(c => c.organization_id === organizationId);
  }

  async createAttendanceCorrection(correctionData: Omit<AttendanceCorrection, 'id' | 'created_at' | 'updated_at'>): Promise<AttendanceCorrection> {
    const newCorr: AttendanceCorrection = {
      ...correctionData,
      id: `corr-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.corrections.unshift(newCorr);
    return newCorr;
  }

  async updateCorrectionStatus(id: string, status: 'approved' | 'rejected', notes?: string, approvedBy?: string): Promise<AttendanceCorrection> {
    const idx = this.corrections.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Correction not found');
    this.corrections[idx] = {
      ...this.corrections[idx],
      status,
      decision_notes: notes,
      approved_by: approvedBy || 'usr-owner',
      updated_at: new Date().toISOString(),
    };
    return this.corrections[idx];
  }

  async getLeaveRequests(organizationId: string, employeeId?: string): Promise<LeaveRequest[]> {
    return this.leaveRequests.filter(l => {
      if (l.organization_id !== organizationId) return false;
      if (employeeId && l.employee_id !== employeeId) return false;
      return true;
    });
  }

  async createLeaveRequest(requestData: Omit<LeaveRequest, 'id' | 'created_at'>): Promise<LeaveRequest> {
    const newReq: LeaveRequest = {
      ...requestData,
      id: `leave-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.leaveRequests.unshift(newReq);
    return newReq;
  }

  async updateLeaveRequestStatus(id: string, status: 'approved' | 'rejected', approvedBy?: string, notes?: string): Promise<LeaveRequest> {
    const idx = this.leaveRequests.findIndex(l => l.id === id);
    if (idx === -1) throw new Error('Leave request not found');
    this.leaveRequests[idx] = {
      ...this.leaveRequests[idx],
      status,
      approved_by: approvedBy || 'usr-owner',
    };
    return this.leaveRequests[idx];
  }

  async getShifts(organizationId: string): Promise<Shift[]> {
    return this.shifts.filter(s => s.organization_id === organizationId);
  }

  async createShift(shiftData: Omit<Shift, 'id' | 'created_at'>): Promise<Shift> {
    const newShift: Shift = {
      ...shiftData,
      id: `shift-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.shifts.push(newShift);
    return newShift;
  }

  async getDevices(organizationId: string): Promise<AttendanceDevice[]> {
    return this.devices.filter(d => d.organization_id === organizationId);
  }

  async createDevice(deviceData: Omit<AttendanceDevice, 'id' | 'created_at' | 'updated_at'>): Promise<AttendanceDevice> {
    const newDevice: AttendanceDevice = {
      ...deviceData,
      id: `dev-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.devices.push(newDevice);
    return newDevice;
  }

  async getPayrollRuns(organizationId: string): Promise<PayrollRun[]> {
    return this.payrollRuns.filter(r => r.organization_id === organizationId);
  }

  async getPayrollItems(payrollRunId: string): Promise<PayrollItem[]> {
    return this.payrollItems.filter(i => i.payroll_run_id === payrollRunId);
  }
}

/**
 * Production-ready Supabase implementation of IDataService.
 * Executes queries through Row-Level Security policies.
 */
class SupabaseDataService implements IDataService {
  isLiveMode(): boolean {
    return true;
  }

  private getClient() {
    if (!supabase) {
      throw new Error('Supabase client is not initialized');
    }
    return supabase;
  }

  async getOrganizations(): Promise<Organization[]> {
    const { data, error } = await this.getClient()
      .from('organizations')
      .select('*')
      .order('name');
    if (error) throw new Error(`Failed to fetch organizations: ${error.message}`);
    return data as Organization[];
  }

  async getBranches(organizationId: string): Promise<Branch[]> {
    const { data, error } = await this.getClient()
      .from('branches')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');
    if (error) throw new Error(`Failed to fetch branches: ${error.message}`);
    return data as Branch[];
  }

  async getEmployees(organizationId: string, branchId?: string): Promise<Employee[]> {
    let query = this.getClient()
      .from('employees')
      .select('*')
      .eq('organization_id', organizationId);
    
    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('first_name');
    if (error) throw new Error(`Failed to fetch employees: ${error.message}`);
    return data as Employee[];
  }

  async createEmployee(employeeData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
    const { data, error } = await this.getClient()
      .from('employees')
      .insert([employeeData])
      .select()
      .single();
    if (error) throw new Error(`Failed to create employee: ${error.message}`);
    return data as Employee;
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee> {
    const { data, error } = await this.getClient()
      .from('employees')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update employee: ${error.message}`);
    return data as Employee;
  }

  async getAttendanceSummaries(organizationId: string, date?: string): Promise<AttendanceDailySummary[]> {
    let query = this.getClient()
      .from('attendance_daily_summaries')
      .select('*')
      .eq('organization_id', organizationId);
    
    if (date) {
      query = query.eq('work_date', date);
    }

    const { data, error } = await query.order('work_date', { ascending: false });
    if (error) throw new Error(`Failed to fetch daily summaries: ${error.message}`);
    return data as AttendanceDailySummary[];
  }

  async getAttendanceCorrections(organizationId: string): Promise<AttendanceCorrection[]> {
    const { data, error } = await this.getClient()
      .from('attendance_corrections')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to fetch attendance corrections: ${error.message}`);
    return data as AttendanceCorrection[];
  }

  async createAttendanceCorrection(correctionData: Omit<AttendanceCorrection, 'id' | 'created_at' | 'updated_at'>): Promise<AttendanceCorrection> {
    const { data, error } = await this.getClient()
      .from('attendance_corrections')
      .insert([correctionData])
      .select()
      .single();
    if (error) throw new Error(`Failed to submit attendance correction: ${error.message}`);
    return data as AttendanceCorrection;
  }

  async updateCorrectionStatus(id: string, status: 'approved' | 'rejected', notes?: string, approvedBy?: string): Promise<AttendanceCorrection> {
    const { data, error } = await this.getClient()
      .from('attendance_corrections')
      .update({
        status,
        decision_notes: notes,
        approved_by: approvedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update correction status: ${error.message}`);
    return data as AttendanceCorrection;
  }

  async getLeaveRequests(organizationId: string, employeeId?: string): Promise<LeaveRequest[]> {
    let query = this.getClient()
      .from('leave_requests')
      .select('*')
      .eq('organization_id', organizationId);
    
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    const { data, error } = await query.order('start_date', { ascending: false });
    if (error) throw new Error(`Failed to fetch leave requests: ${error.message}`);
    return data as LeaveRequest[];
  }

  async createLeaveRequest(requestData: Omit<LeaveRequest, 'id' | 'created_at'>): Promise<LeaveRequest> {
    const { data, error } = await this.getClient()
      .from('leave_requests')
      .insert([requestData])
      .select()
      .single();
    if (error) throw new Error(`Failed to apply for leave: ${error.message}`);
    return data as LeaveRequest;
  }

  async updateLeaveRequestStatus(id: string, status: 'approved' | 'rejected', approvedBy?: string, notes?: string): Promise<LeaveRequest> {
    const { data, error } = await this.getClient()
      .from('leave_requests')
      .update({
        status,
        approved_by: approvedBy,
        decision_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update leave request: ${error.message}`);
    return data as LeaveRequest;
  }

  async getShifts(organizationId: string): Promise<Shift[]> {
    const { data, error } = await this.getClient()
      .from('shifts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');
    if (error) throw new Error(`Failed to fetch shifts: ${error.message}`);
    return data as Shift[];
  }

  async createShift(shiftData: Omit<Shift, 'id' | 'created_at'>): Promise<Shift> {
    const { data, error } = await this.getClient()
      .from('shifts')
      .insert([shiftData])
      .select()
      .single();
    if (error) throw new Error(`Failed to create shift: ${error.message}`);
    return data as Shift;
  }

  async getDevices(organizationId: string): Promise<AttendanceDevice[]> {
    const { data, error } = await this.getClient()
      .from('attendance_devices')
      .select('*')
      .eq('organization_id', organizationId)
      .order('device_name');
    if (error) throw new Error(`Failed to fetch devices: ${error.message}`);
    return data as AttendanceDevice[];
  }

  async createDevice(deviceData: Omit<AttendanceDevice, 'id' | 'created_at' | 'updated_at'>): Promise<AttendanceDevice> {
    const { data, error } = await this.getClient()
      .from('attendance_devices')
      .insert([deviceData])
      .select()
      .single();
    if (error) throw new Error(`Failed to create device: ${error.message}`);
    return data as AttendanceDevice;
  }

  async getPayrollRuns(organizationId: string): Promise<PayrollRun[]> {
    const { data, error } = await this.getClient()
      .from('payroll_runs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('period_start', { ascending: false });
    if (error) throw new Error(`Failed to fetch payroll runs: ${error.message}`);
    return data as PayrollRun[];
  }

  async getPayrollItems(payrollRunId: string): Promise<PayrollItem[]> {
    const { data, error } = await this.getClient()
      .from('payroll_items')
      .select('*')
      .eq('payroll_run_id', payrollRunId);
    if (error) throw new Error(`Failed to fetch payroll items: ${error.message}`);
    return data as PayrollItem[];
  }
}

// Single instance provider
let dataServiceInstance: IDataService | null = null;

export function getDataService(): IDataService {
  if (!dataServiceInstance) {
    if (isSupabaseConfigured) {
      dataServiceInstance = new SupabaseDataService();
    } else {
      dataServiceInstance = new DemoDataService();
    }
  }
  return dataServiceInstance;
}
