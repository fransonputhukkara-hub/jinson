import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { UserRole } from '../types/database.types';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  organizationId: string;
  assignedBranchId?: string;
  employeeId?: string;
}

export const DEMO_USERS: Record<string, AuthUser> = {
  owner: {
    id: 'usr-jinson-owner',
    email: 'jinson.thomas@jinsonchitfund.com',
    role: 'company_owner',
    fullName: 'Jinson Thomas (Managing Director)',
    organizationId: 'org-jinson-chit-fund',
  },
  manager: {
    id: 'usr-thrissur-manager',
    email: 'thrissur.manager@jinsonchitfund.com',
    role: 'branch_manager',
    fullName: 'Biju Varghese (Thrissur Branch Manager)',
    organizationId: 'org-jinson-chit-fund',
    assignedBranchId: 'branch-thrissur-main',
  },
  employee: {
    id: 'usr-priya-nair',
    email: 'priya.nair@jinsonchitfund.com',
    role: 'employee',
    fullName: 'Priya Nair (Senior Collection Agent)',
    organizationId: 'org-jinson-chit-fund',
    assignedBranchId: 'branch-thrissur-main',
  },
};

const VALID_ROLES = new Set<UserRole>([
  'platform_admin',
  'installer_partner',
  'company_owner',
  'company_admin',
  'branch_manager',
  'employee',
]);

class AuthService {
  private currentDemoUser: AuthUser = DEMO_USERS.owner;
  private currentUser: AuthUser | null = null;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();
  private authSubscription: { unsubscribe: () => void } | null = null;
  private sessionResolution = 0;

  isLive(): boolean {
    return isSupabaseConfigured;
  }

  getCurrentUser(): AuthUser | null {
    return this.isLive() ? this.currentUser : this.currentDemoUser;
  }

  /**
   * Demo role switching is deliberately unavailable when Supabase is configured.
   * Live authorization must always come from the authenticated database membership.
   */
  setDemoRole(roleKey: 'owner' | 'manager' | 'employee'): void {
    if (this.isLive()) return;
    const user = DEMO_USERS[roleKey];
    if (!user) return;
    this.currentDemoUser = user;
    this.notifyListeners(user);
  }

  private notifyListeners(user: AuthUser | null): void {
    for (const listener of this.listeners) listener(user);
  }

  private async resolveAuthenticatedUser(user: SupabaseAuthUser | null): Promise<AuthUser | null> {
    const requestId = ++this.sessionResolution;

    if (!user || !supabase) {
      this.currentUser = null;
      this.notifyListeners(null);
      return null;
    }

    const [profileResult, membershipResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('organization_members')
        .select('organization_id, role, assigned_branch_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ]);

    if (requestId !== this.sessionResolution) return this.currentUser;
    if (profileResult.error) throw new Error(`Unable to load user profile: ${profileResult.error.message}`);
    if (membershipResult.error) throw new Error(`Unable to load organization membership: ${membershipResult.error.message}`);

    const memberships = membershipResult.data ?? [];
    if (memberships.length === 0) {
      throw new Error('Your account is not assigned to an AttendEase organization. Ask the organization owner to provision your membership.');
    }
    if (memberships.length > 1) {
      throw new Error('Your account belongs to multiple organizations. Organization selection must be configured before this account can continue.');
    }

    const membership = memberships[0];
    if (!VALID_ROLES.has(membership.role as UserRole)) {
      throw new Error('Your account has an unrecognized organization role. Contact the platform administrator.');
    }

    // Supabase Auth is the source of truth for the login email. A profile row is
    // editable metadata and must not be able to remap an account to another employee.
    const email = user.email || '';
    const fullName =
      profileResult.data?.full_name ||
      (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '') ||
      email;

    let employeeId: string | undefined;
    if (membership.role === 'employee') {
      const employeeResult = await supabase
        .from('employees')
        .select('id')
        .eq('organization_id', membership.organization_id)
        .eq('email', email)
        .maybeSingle();
      if (requestId !== this.sessionResolution) return this.currentUser;
      if (employeeResult.error) throw new Error(`Unable to load employee profile: ${employeeResult.error.message}`);
      if (!employeeResult.data) {
        throw new Error('Your login is not linked to an employee record. Ask your organization administrator to match your login email to your employee record.');
      }
      employeeId = employeeResult.data.id;
    }

    const resolvedUser: AuthUser = {
      id: user.id,
      email,
      role: membership.role as UserRole,
      fullName,
      organizationId: membership.organization_id,
      assignedBranchId: membership.assigned_branch_id || undefined,
      employeeId,
    };

    if (requestId === this.sessionResolution) {
      this.currentUser = resolvedUser;
      this.notifyListeners(resolvedUser);
    }
    return resolvedUser;
  }

  private startAuthSubscription(): void {
    if (!supabase || this.authSubscription) return;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Do not call Supabase queries inside the auth callback. Schedule the lookup
      // after the SDK releases its internal auth lock.
      window.setTimeout(() => {
        void this.resolveAuthenticatedUser(session?.user ?? null).catch((error: unknown) => {
          this.currentUser = null;
          this.notifyListeners(null);
          console.error('[Auth] Unable to resolve authenticated membership:', error instanceof Error ? error.message : 'Unknown error');
        });
      }, 0);
    });

    this.authSubscription = data.subscription;
  }

  private async refreshSession(): Promise<void> {
    if (!supabase || !this.isLive()) return;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(`Unable to restore authentication session: ${error.message}`);
    await this.resolveAuthenticatedUser(data.session?.user ?? null);
  }

  async signInWithPassword(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isLive()) {
      const matched = Object.values(DEMO_USERS).find(
        user => user.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (matched) this.currentDemoUser = matched;
      this.notifyListeners(this.currentDemoUser);
      return { success: true };
    }

    if (!supabase) return { success: false, error: 'Supabase authentication is not configured.' };

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      return { success: false, error: error?.message || 'Authentication did not return a user.' };
    }

    try {
      const resolved = await this.resolveAuthenticatedUser(data.user);
      if (!resolved) throw new Error('No organization membership was resolved.');
      return { success: true };
    } catch (resolutionError) {
      await supabase.auth.signOut();
      this.currentUser = null;
      this.notifyListeners(null);
      return {
        success: false,
        error: resolutionError instanceof Error ? resolutionError.message : 'Unable to load your organization access.',
      };
    }
  }

  async signOut(): Promise<void> {
    if (this.isLive() && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(`Unable to sign out: ${error.message}`);
      this.currentUser = null;
      this.sessionResolution++;
      this.notifyListeners(null);
      return;
    }

    this.currentDemoUser = DEMO_USERS.owner;
    this.notifyListeners(null);
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    this.listeners.add(callback);

    if (!this.isLive()) {
      callback(this.currentDemoUser);
    } else {
      this.startAuthSubscription();
      void this.refreshSession().catch((error: unknown) => {
        this.currentUser = null;
        this.notifyListeners(null);
        console.error('[Auth] Session initialization failed:', error instanceof Error ? error.message : 'Unknown error');
      });
    }

    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const authService = new AuthService();
