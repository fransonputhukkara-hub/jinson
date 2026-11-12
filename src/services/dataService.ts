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
      throw new Error('Live Supabase configuration is required. Demo data mode has been removed.');
    }
  }
  return dataServiceInstance;
}
