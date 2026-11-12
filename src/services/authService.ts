import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from '../types/database.types';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  organizationId: string;
  assignedBranchId?: string;
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

class AuthService {
  private currentDemoUser: AuthUser = DEMO_USERS.owner;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();

  isLive(): boolean {
    return isSupabaseConfigured;
  }

  getCurrentUser(): AuthUser | null {
    if (!this.isLive()) {
      return this.currentDemoUser;
    }
    // Live mode session handling
    return this.currentDemoUser;
  }

  setDemoRole(roleKey: 'owner' | 'manager' | 'employee') {
    if (DEMO_USERS[roleKey]) {
      this.currentDemoUser = DEMO_USERS[roleKey];
      this.notifyListeners(this.currentDemoUser);
    }
  }

  async signInWithPassword(email: string, password: string):Promise<{ success: boolean; error?: string }> {
    if (!this.isLive()) {
      // Find matching demo user by email or set default
      const matched = Object.values(DEMO_USERS).find(u => u.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        this.currentDemoUser = matched;
      }
      this.notifyListeners(this.currentDemoUser);
      return { success: true };
    }

    if (!supabase) {
      return { success: false, error: 'Database service unavailable' };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  async signOut(): Promise<void> {
    if (this.isLive() && supabase) {
      await supabase.auth.signOut();
    }
    this.notifyListeners(null);
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.getCurrentUser());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(user: AuthUser | null) {
    for (const listener of this.listeners) {
      listener(user);
    }
  }
}

export const authService = new AuthService();
