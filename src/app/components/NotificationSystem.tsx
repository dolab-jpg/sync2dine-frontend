import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  Bell,
  Camera,
  ClipboardList,
  CreditCard,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import {
  addNotification,
  loadNotifications,
  markRead,
  subscribe,
  type NotificationType,
  type ProjectNotification,
} from '../engine/notifications/notificationStore';

interface NotificationSystemProps {
  onNewLead?: () => void;
}

const DEV_NOTIFICATION_FLAG = 'tradepro_enable_dev_notifications';

export default function NotificationSystem({ onNewLead }: NotificationSystemProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<ProjectNotification[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  const closePanel = useCallback(() => setShowPanel(false), []);

  useEffect(() => {
    setNotifications(loadNotifications());
    return subscribe(setNotifications);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (localStorage.getItem(DEV_NOTIFICATION_FLAG) !== '1') return;

    const sampleNotifications: Array<{
      type: NotificationType;
      title: string;
      message: string;
      data?: Record<string, unknown>;
    }> = [
      {
        type: 'builder_brief_sent',
        title: 'Builder Brief Sent',
        message: 'Trade brief was sent to the assigned builder.',
        data: { route: '/projects' },
      },
      {
        type: 'photo_requested',
        title: 'Progress Photos Requested',
        message: 'Builder has been asked to upload latest site photos.',
        data: { route: '/projects' },
      },
      {
        type: 'payment_stage_due',
        title: 'Payment Stage Due',
        message: 'Upcoming milestone payment requires follow-up.',
        data: { route: '/projects' },
      },
      {
        type: 'customer_action_required',
        title: 'Customer Action Needed',
        message: 'Customer confirmation required before next milestone.',
        data: { route: '/projects' },
      },
      {
        type: 'foreman_plan_sent',
        title: 'Foreman Plan Sent',
        message: 'Execution plan has been delivered to the project team.',
        data: { route: '/projects' },
      },
      {
        type: 'builder_reply_received',
        title: 'Builder Reply Received',
        message: 'Builder sent a status reply for the active project.',
        data: { route: '/projects' },
      },
    ];

    const interval = setInterval(() => {
      if (Math.random() <= 0.75) return;
      const sample = sampleNotifications[Math.floor(Math.random() * sampleNotifications.length)];
      addNotification(sample);
      onNewLead?.();
    }, 30000);

    return () => clearInterval(interval);
  }, [onNewLead]);

  useEffect(() => {
    if (!showPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPanel, closePanel]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    notifications
      .filter((notification) => !notification.read)
      .forEach((notification) => markRead(notification.id));
  };

  const resolveNotificationRoute = (notification: ProjectNotification): string => {
    const data = notification.data ?? {};
    if (typeof data.route === 'string' && data.route.trim()) return data.route;
    if (typeof data.projectId === 'string' && data.projectId.trim()) {
      return `/projects/${encodeURIComponent(data.projectId)}`;
    }
    return '/projects';
  };

  const handleNotificationClick = (notification: ProjectNotification) => {
    markRead(notification.id);
    navigate(resolveNotificationRoute(notification));
    closePanel();
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'builder_brief_sent': return <ClipboardList className="w-5 h-5 text-blue-600" />;
      case 'photo_requested': return <Camera className="w-5 h-5 text-indigo-600" />;
      case 'payment_stage_due': return <CreditCard className="w-5 h-5 text-amber-600" />;
      case 'customer_action_required': return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'foreman_plan_sent': return <Send className="w-5 h-5 text-violet-600" />;
      case 'builder_reply_received': return <MessageCircle className="w-5 h-5 text-green-600" />;
      default: return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'builder_brief_sent': return 'border-l-4 border-blue-500 bg-blue-50';
      case 'photo_requested': return 'border-l-4 border-indigo-500 bg-indigo-50';
      case 'payment_stage_due': return 'border-l-4 border-amber-500 bg-amber-50';
      case 'customer_action_required': return 'border-l-4 border-red-500 bg-red-50';
      case 'foreman_plan_sent': return 'border-l-4 border-violet-500 bg-violet-50';
      case 'builder_reply_received': return 'border-l-4 border-green-500 bg-green-50';
      default: return 'border-l-4 border-gray-500 bg-gray-50';
    }
  };

  const formatTimestamp = (date: Date) => {
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <>
      {showPanel && (
        <div
          className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
          onClick={closePanel}
          aria-hidden
        />
      )}
      <div className="relative z-50">
        <button
          type="button"
          onClick={() => setShowPanel(v => !v)}
          aria-label="Notifications"
          aria-expanded={showPanel}
          className="relative min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors touch-manipulation"
        >
          <Bell className="w-5 h-5 text-amber-100" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showPanel && (
          <div className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-[3.75rem] sm:top-full sm:mt-2 w-auto sm:w-80 max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[min(45vh,22rem)] sm:max-h-[28rem] flex flex-col">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-t-2xl shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-amber-400">Notifications</h3>
                <button
                  type="button"
                  onClick={closePanel}
                  className="min-h-11 min-w-11 flex items-center justify-center text-amber-100 hover:text-white rounded-lg touch-manipulation"
                  aria-label="Close notifications"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-amber-100">{unreadCount} unread</span>
                <div className="flex gap-2 flex-wrap">
                  {notifications.length > 0 && unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600 min-h-9 touch-manipulation"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
              {notifications.length === 0 ? (
                <div className="text-center py-10">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No notifications</p>
                  <p className="text-sm text-gray-400 mt-1">You're all caught up</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-xl ${getNotificationColor(notification.type)} ${
                        !notification.read ? 'shadow-md' : 'opacity-70'
                      } transition-all cursor-pointer`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">
                              {notification.title}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-700 mt-1 line-clamp-2">{notification.message}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">{formatTimestamp(notification.timestamp)}</span>
                            {!notification.read && <span className="text-xs font-medium text-blue-600">NEW</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
