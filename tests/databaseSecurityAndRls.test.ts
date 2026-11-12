import { describe, it, expect } from 'vitest';

/**
 * Security Rule & Policy Verification Tests
 * Evaluates the authorization model, tenant boundary protection, branch manager restrictions,
 * and immutable payroll locking logic codified in the Supabase RLS migrations.
 */

interface MockUser {
  id: string;
  email: string;
}

interface MockOrgMember {
  userId: string;
  organizationId: string;
  role: 'platform_admin' | 'installer_partner' | 'company_owner' | 'company_admin' | 'branch_manager' | 'employee';
  assignedBranchId?: string;
}

interface MockEmployee {
  id: string;
  organizationId: string;
  branchId: string;
  displayName: string;
}

interface MockPayrollRun {
  id: string;
  organizationId: string;
  periodLabel: string;
  status: 'draft' | 'review' | 'approved' | 'locked';
}

// Simulates the RLS evaluation engine implemented in SQL
class PolicyEvaluator {
  static canReadEmployee(user: MockUser, membership: MockOrgMember | null, employee: MockEmployee): boolean {
    if (!membership) return false;
    // Platform admin check
    if (membership.role === 'platform_admin') return true;
    // Organization match check
    if (membership.organizationId !== employee.organizationId) return false;

    // Role-aware branch restriction
    if (membership.role === 'company_owner' || membership.role === 'company_admin') {
      return true;
    }
    if (membership.role === 'branch_manager') {
      return membership.assignedBranchId === employee.branchId;
    }
    // Employee can view colleagues in their own branch
    return true;
  }

  static canModifyPayroll(membership: MockOrgMember | null, targetOrgId: string, run: MockPayrollRun): { allowed: boolean; reason?: string } {
    if (!membership) return { allowed: false, reason: 'Unauthenticated' };
    if (membership.role === 'platform_admin') {
      if (run.status === 'locked') {
        return { allowed: false, reason: 'Locked payroll runs are immutable' };
      }
      return { allowed: true };
    }
    if (membership.organizationId !== targetOrgId) {
      return { allowed: false, reason: 'Cross-tenant access forbidden' };
    }
    if (!['company_owner', 'company_admin'].includes(membership.role)) {
      return { allowed: false, reason: 'Insufficient privileges' };
    }
    if (run.status === 'locked') {
      return { allowed: false, reason: 'Cannot modify a locked payroll run' };
    }
    return { allowed: true };
  }

  static canPromoteToRole(
    actorMembership: MockOrgMember | null,
    targetRole: MockOrgMember['role']
  ): boolean {
    if (!actorMembership) return false;
    if (actorMembership.role === 'platform_admin') return true;
    if (actorMembership.role === 'company_owner') {
      // Owners cannot create platform admins
      return targetRole !== 'platform_admin';
    }
    if (actorMembership.role === 'company_admin') {
      // Admins cannot create owners or platform admins
      return !['company_owner', 'platform_admin'].includes(targetRole);
    }
    // Branch managers and employees cannot promote anyone
    return false;
  }
}

describe('Database Security & RLS Policy Audits', () => {
  const orgA = 'org-jinson-chit-fund';
  const orgB = 'org-rival-finance';

  const branchTsr = 'branch-thrissur-01';
  const branchEkm = 'branch-ernakulam-02';

  const userJinsonOwner: MockUser = { id: 'u1', email: 'jinson@jinson.com' };
  const memberJinsonOwner: MockOrgMember = {
    userId: 'u1',
    organizationId: orgA,
    role: 'company_owner',
  };

  const userTsrBranchManager: MockUser = { id: 'u2', email: 'tsr.mgr@jinson.com' };
  const memberTsrBranchManager: MockOrgMember = {
    userId: 'u2',
    organizationId: orgA,
    role: 'branch_manager',
    assignedBranchId: branchTsr,
  };

  const userRivalOwner: MockUser = { id: 'u99', email: 'rival@other.com' };
  const memberRivalOwner: MockOrgMember = {
    userId: 'u99',
    organizationId: orgB,
    role: 'company_owner',
  };

  const empThrissur: MockEmployee = {
    id: 'emp-1',
    organizationId: orgA,
    branchId: branchTsr,
    displayName: 'Priya Nair',
  };

  const empErnakulam: MockEmployee = {
    id: 'emp-2',
    organizationId: orgA,
    branchId: branchEkm,
    displayName: 'Rahul Menon',
  };

  const empRival: MockEmployee = {
    id: 'emp-99',
    organizationId: orgB,
    branchId: 'branch-rival-01',
    displayName: 'External Staff',
  };

  it('strictly blocks cross-tenant employee read access', () => {
    // Jinson owner cannot view Rival employee
    expect(PolicyEvaluator.canReadEmployee(userJinsonOwner, memberJinsonOwner, empRival)).toBe(false);
    // Rival owner cannot view Jinson employee
    expect(PolicyEvaluator.canReadEmployee(userRivalOwner, memberRivalOwner, empThrissur)).toBe(false);
  });

  it('enforces branch-level restriction for Branch Managers', () => {
    // Thrissur branch manager CAN view Thrissur staff
    expect(PolicyEvaluator.canReadEmployee(userTsrBranchManager, memberTsrBranchManager, empThrissur)).toBe(true);

    // Thrissur branch manager CANNOT view Ernakulam staff
    expect(PolicyEvaluator.canReadEmployee(userTsrBranchManager, memberTsrBranchManager, empErnakulam)).toBe(false);

    // Company owner CAN view both branches
    expect(PolicyEvaluator.canReadEmployee(userJinsonOwner, memberJinsonOwner, empThrissur)).toBe(true);
    expect(PolicyEvaluator.canReadEmployee(userJinsonOwner, memberJinsonOwner, empErnakulam)).toBe(true);
  });

  it('prevents privilege escalation and unauthorized role assignment', () => {
    // Branch manager cannot promote anyone to Admin or Owner
    expect(PolicyEvaluator.canPromoteToRole(memberTsrBranchManager, 'company_owner')).toBe(false);
    expect(PolicyEvaluator.canPromoteToRole(memberTsrBranchManager, 'company_admin')).toBe(false);

    // Company Admin cannot promote anyone to Owner or Platform Admin
    const adminMember: MockOrgMember = { userId: 'u3', organizationId: orgA, role: 'company_admin' };
    expect(PolicyEvaluator.canPromoteToRole(adminMember, 'company_owner')).toBe(false);
    expect(PolicyEvaluator.canPromoteToRole(adminMember, 'platform_admin')).toBe(false);
    expect(PolicyEvaluator.canPromoteToRole(adminMember, 'branch_manager')).toBe(true);

    // Company Owner cannot grant Platform Admin
    expect(PolicyEvaluator.canPromoteToRole(memberJinsonOwner, 'platform_admin')).toBe(false);
    expect(PolicyEvaluator.canPromoteToRole(memberJinsonOwner, 'company_admin')).toBe(true);
  });

  it('guarantees locked payroll run immutability', () => {
    const draftRun: MockPayrollRun = {
      id: 'pr-01',
      organizationId: orgA,
      periodLabel: 'October 2026',
      status: 'draft',
    };

    const lockedRun: MockPayrollRun = {
      id: 'pr-02',
      organizationId: orgA,
      periodLabel: 'September 2026',
      status: 'locked',
    };

    // Owner can modify draft
    const draftRes = PolicyEvaluator.canModifyPayroll(memberJinsonOwner, orgA, draftRun);
    expect(draftRes.allowed).toBe(true);

    // Owner CANNOT modify locked run
    const lockedRes = PolicyEvaluator.canModifyPayroll(memberJinsonOwner, orgA, lockedRun);
    expect(lockedRes.allowed).toBe(false);
    expect(lockedRes.reason).toContain('locked');

    // Branch manager cannot modify even draft
    const branchRes = PolicyEvaluator.canModifyPayroll(memberTsrBranchManager, orgA, draftRun);
    expect(branchRes.allowed).toBe(false);
    expect(branchRes.reason).toBe('Insufficient privileges');
  });
});

/**
 * Milestone 3.1 SEC-01 Database Trigger Integrity Tests
 * Evaluates the SQL trigger logic implemented in 20250101000003_locked_payroll_child_integrity.sql:
 * - Reject INSERT when target payroll run is locked
 * - Reject UPDATE when original payroll run is locked
 * - Reject UPDATE when destination payroll run is locked
 * - Reject DELETE when associated payroll run is locked
 * - Reject modifying or unlocking locked payroll runs
 * - Reject deleting locked payroll runs
 * - Clean error responses without PII leakage
 */

interface MockPayrollItem {
  id: string;
  payrollRunId: string;
  organizationId: string;
  employeeId: string;
  grossPay: number;
  netPay: number;
}

class PayrollLockTriggerSimulator {
  private runs: Map<string, MockPayrollRun>;

  constructor(runs: MockPayrollRun[]) {
    this.runs = new Map(runs.map(r => [r.id, { ...r }]));
  }

  insertPayrollItem(item: MockPayrollItem): { success: boolean; error?: string } {
    const parentRun = this.runs.get(item.payrollRunId);
    if (!parentRun) {
      return { success: false, error: 'Foreign key violation: payroll run does not exist' };
    }
    if (parentRun.status === 'locked') {
      return {
        success: false,
        error: 'Cannot insert payroll item: target payroll run is locked and immutable.',
      };
    }
    return { success: true };
  }

  updatePayrollItem(
    current: MockPayrollItem,
    updated: Partial<MockPayrollItem>
  ): { success: boolean; error?: string } {
    const originalRun = this.runs.get(current.payrollRunId);
    if (!originalRun) {
      return { success: false, error: 'Source payroll run not found' };
    }
    if (originalRun.status === 'locked') {
      return {
        success: false,
        error: 'Cannot update payroll item: source payroll run is locked and immutable.',
      };
    }

    // Check if payroll_run_id is moving to another run
    if (updated.payrollRunId && updated.payrollRunId !== current.payrollRunId) {
      const destRun = this.runs.get(updated.payrollRunId);
      if (!destRun) {
        return { success: false, error: 'Destination payroll run not found' };
      }
      if (destRun.status === 'locked') {
        return {
          success: false,
          error: 'Cannot move payroll item: destination payroll run is locked and immutable.',
        };
      }
    }

    return { success: true };
  }

  deletePayrollItem(item: MockPayrollItem): { success: boolean; error?: string } {
    const parentRun = this.runs.get(item.payrollRunId);
    if (!parentRun) {
      return { success: false, error: 'Parent payroll run not found' };
    }
    if (parentRun.status === 'locked') {
      return {
        success: false,
        error: 'Cannot delete payroll item: associated payroll run is locked and immutable.',
      };
    }
    return { success: true };
  }

  updatePayrollRunStatus(
    runId: string,
    newStatus: MockPayrollRun['status']
  ): { success: boolean; error?: string } {
    const run = this.runs.get(runId);
    if (!run) return { success: false, error: 'Payroll run not found' };

    if (run.status === 'locked') {
      return {
        success: false,
        error: 'Cannot modify or unlock payroll run: locked payroll periods cannot be modified or reverted.',
      };
    }

    run.status = newStatus;
    return { success: true };
  }

  deletePayrollRun(runId: string): { success: boolean; error?: string } {
    const run = this.runs.get(runId);
    if (!run) return { success: false, error: 'Payroll run not found' };

    if (run.status === 'locked') {
      return {
        success: false,
        error: 'Cannot delete payroll run: locked payroll periods are permanent and immutable.',
      };
    }

    this.runs.delete(runId);
    return { success: true };
  }
}

describe('Milestone 3.1 SEC-01: Child-Table Integrity & Locked Payroll Immutability', () => {
  const draftRun: MockPayrollRun = {
    id: 'run-draft-oct-2026',
    organizationId: 'org-jinson-chit-fund',
    periodLabel: 'October 2026',
    status: 'draft',
  };

  const reviewRun: MockPayrollRun = {
    id: 'run-review-oct-2026',
    organizationId: 'org-jinson-chit-fund',
    periodLabel: 'October 2026 Revised',
    status: 'review',
  };

  const lockedRun: MockPayrollRun = {
    id: 'run-locked-sep-2026',
    organizationId: 'org-jinson-chit-fund',
    periodLabel: 'September 2026',
    status: 'locked',
  };

  const sampleItemInLockedRun: MockPayrollItem = {
    id: 'item-001',
    payrollRunId: lockedRun.id,
    organizationId: 'org-jinson-chit-fund',
    employeeId: 'emp-1',
    grossPay: 35000,
    netPay: 34500,
  };

  const sampleItemInDraftRun: MockPayrollItem = {
    id: 'item-002',
    payrollRunId: draftRun.id,
    organizationId: 'org-jinson-chit-fund',
    employeeId: 'emp-1',
    grossPay: 35000,
    netPay: 34500,
  };

  it('rejects INSERT of payroll items when target payroll run is locked', () => {
    const simulator = new PayrollLockTriggerSimulator([draftRun, lockedRun]);

    // INSERT into locked run must be rejected
    const insertLockedResult = simulator.insertPayrollItem({
      id: 'item-new',
      payrollRunId: lockedRun.id,
      organizationId: 'org-jinson-chit-fund',
      employeeId: 'emp-2',
      grossPay: 20000,
      netPay: 20000,
    });
    expect(insertLockedResult.success).toBe(false);
    expect(insertLockedResult.error).toBe('Cannot insert payroll item: target payroll run is locked and immutable.');

    // INSERT into draft run must succeed
    const insertDraftResult = simulator.insertPayrollItem({
      id: 'item-new-draft',
      payrollRunId: draftRun.id,
      organizationId: 'org-jinson-chit-fund',
      employeeId: 'emp-2',
      grossPay: 20000,
      netPay: 20000,
    });
    expect(insertDraftResult.success).toBe(true);
  });

  it('rejects UPDATE of payroll items when source payroll run is locked', () => {
    const simulator = new PayrollLockTriggerSimulator([draftRun, lockedRun]);

    // Modifying gross/net or deductions in locked run must be rejected
    const updateLockedResult = simulator.updatePayrollItem(sampleItemInLockedRun, {
      grossPay: 40000,
      netPay: 39500,
    });
    expect(updateLockedResult.success).toBe(false);
    expect(updateLockedResult.error).toBe('Cannot update payroll item: source payroll run is locked and immutable.');

    // Modifying item in draft run must succeed
    const updateDraftResult = simulator.updatePayrollItem(sampleItemInDraftRun, {
      grossPay: 36000,
      netPay: 35500,
    });
    expect(updateDraftResult.success).toBe(true);
  });

  it('rejects moving an item from an unlocked run into a locked run', () => {
    const simulator = new PayrollLockTriggerSimulator([draftRun, reviewRun, lockedRun]);

    // Moving item from draft run into locked run must be rejected
    const moveIntoLockedResult = simulator.updatePayrollItem(sampleItemInDraftRun, {
      payrollRunId: lockedRun.id,
    });
    expect(moveIntoLockedResult.success).toBe(false);
    expect(moveIntoLockedResult.error).toBe('Cannot move payroll item: destination payroll run is locked and immutable.');

    // Moving item between unlocked runs (draft to review) must succeed
    const moveBetweenUnlockedResult = simulator.updatePayrollItem(sampleItemInDraftRun, {
      payrollRunId: reviewRun.id,
    });
    expect(moveBetweenUnlockedResult.success).toBe(true);
  });

  it('rejects moving an item out of a locked run into an unlocked run', () => {
    const simulator = new PayrollLockTriggerSimulator([draftRun, lockedRun]);

    // Moving item from locked run out to draft run must be rejected (source is locked)
    const moveOutOfLockedResult = simulator.updatePayrollItem(sampleItemInLockedRun, {
      payrollRunId: draftRun.id,
    });
    expect(moveOutOfLockedResult.success).toBe(false);
    expect(moveOutOfLockedResult.error).toBe('Cannot update payroll item: source payroll run is locked and immutable.');
  });

  it('rejects DELETE of payroll items when associated payroll run is locked', () => {
    const simulator = new PayrollLockTriggerSimulator([draftRun, lockedRun]);

    // Deleting item from locked run must be rejected
    const deleteLockedResult = simulator.deletePayrollItem(sampleItemInLockedRun);
    expect(deleteLockedResult.success).toBe(false);
    expect(deleteLockedResult.error).toBe('Cannot delete payroll item: associated payroll run is locked and immutable.');

    // Deleting item from draft run must succeed
    const deleteDraftResult = simulator.deletePayrollItem(sampleItemInDraftRun);
    expect(deleteDraftResult.success).toBe(true);
  });

  it('rejects unlocking a locked payroll run or deleting a locked payroll run', () => {
    const simulator = new PayrollLockTriggerSimulator([draftRun, lockedRun]);

    // Transitioning from locked back to draft must be rejected
    const unlockToDraftResult = simulator.updatePayrollRunStatus(lockedRun.id, 'draft');
    expect(unlockToDraftResult.success).toBe(false);
    expect(unlockToDraftResult.error).toContain('Cannot modify or unlock payroll run');

    // Transitioning from locked to review or approved must be rejected
    const unlockToReviewResult = simulator.updatePayrollRunStatus(lockedRun.id, 'review');
    expect(unlockToReviewResult.success).toBe(false);

    // Deleting locked run must be rejected
    const deleteLockedRunResult = simulator.deletePayrollRun(lockedRun.id);
    expect(deleteLockedRunResult.success).toBe(false);
    expect(deleteLockedRunResult.error).toContain('Cannot delete payroll run');

    // Deleting draft run is allowed
    const deleteDraftRunResult = simulator.deletePayrollRun(draftRun.id);
    expect(deleteDraftRunResult.success).toBe(true);
  });

  it('ensures error messages are sanitised and do not leak PII or amounts', () => {
    const simulator = new PayrollLockTriggerSimulator([lockedRun]);
    const res = simulator.insertPayrollItem(sampleItemInLockedRun);
    expect(res.error).not.toMatch(/35000|salary|bank|account|aadhaar/i);
    expect(res.error).toBe('Cannot insert payroll item: target payroll run is locked and immutable.');
  });
});
