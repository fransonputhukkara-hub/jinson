import React from 'react';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  UserX 
} from 'lucide-react';
import { AppNotification } from '../types/database.types';

interface NotificationsCardProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

export const NotificationsCard: React.FC<NotificationsCardProps> = ({
  notifications,
  onDismiss,
  onClearAll,
}) => {
  const getSeverityIcon = (type: AppNotification['type'], severity: AppNotification['severity']) => {
    switch (type) {
      case 'late_arrival':
        return <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />;
      case 'missing_checkout':
        return <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />;
      case 'unexplained_absence':
        return <UserX className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />;
      default:
        return severity === 'error' ? (
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        ) : (
          <Bell className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        );
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              Action Items &amp; Alerts
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {unreadCount} pending item{unreadCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">All clear!</p>
            <p>No active attendance exceptions or sync failures.</p>
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border text-xs sm:text-sm flex items-start justify-between gap-3 transition-colors ${
                item.severity === 'error'
                  ? 'bg-rose-50/50 border-rose-200'
                  : item.severity === 'warning'
                  ? 'bg-amber-50/50 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {getSeverityIcon(item.type, item.severity)}
                <div>
                  <h4 className="font-bold text-slate-900 leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-slate-600 mt-0.5 leading-relaxed text-xs">
                    {item.message}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                className="text-xs text-slate-400 hover:text-slate-700 shrink-0 font-medium p-1"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
