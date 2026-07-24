import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  Bell,
  Camera,
  ClipboardList,
  CreditCard,
  MessageCircle,
  Send,
  TrendingUp,
} from 'lucide-react';
import {
  loadNotifications,
  markRead,
  subscribe,
  type NotificationType,
  type ProjectNotification,
} from '../engine/notifications/notificationStore';
import { resolveNotificationRoute } from '../engine/notifications/resolveNotificationRoute';

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'builder_brief_sent': return <ClipboardList className="w-5 h-5 text-blue-600" />;
    case 'photo_requested': return <Camera className="w-5 h-5 text-indigo-600" />;
    case 'payment_stage_due': return <CreditCard className="w-5 h-5 text-amber-600" />;
    case 'customer_action_required': return <AlertCircle className="w-5 h-5 text-red-600" />;
    case 'foreman_plan_sent': return <Send className="w-5 h-5 text-violet-600" />;
    case 'builder_reply_received': return <MessageCircle className="w-5 h-5 text-green-600" />;
    case 'lead_action_required': return <TrendingUp className="w-5 h-5 text-amber-600" />;
    default: return <Bell className="w-5 h-5 text-gray-600" />;
  }
}

function getNotificationColor(type: NotificationType) {
  switch (type) {
    case 'builder_brief_sent': return 'border-l-4 border-blue-500 bg-blue-50';
    case 'photo_requested': return 'border-l-4 border-indigo-500 bg-indigo-50';
    case 'payment_stage_due': return 'border-l-4 border-amber-500 bg-amber-50';
    case 'customer_action_required': return 'border-l-4 border-red-500 bg-red-50';
    case 'foreman_plan_sent': return 'border-l-4 border-violet-500 bg-violet-50';
    case 'builder_reply_received': return 'border-l-4 border-green-500 bg-green-50';
    case 'lead_action_required': return 'border-l-4 border-amber-500 bg-amber-50';
    default: return 'border-l-4 border-gray-500 bg-gray-50';
  }
}

function formatTimestamp(date: Date) {
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<ProjectNotification[]>([]);

  useEffect(() => {
    setNotifications(loadNotifications());
    return subscribe(setNotifications);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    notifications
      .filter((notification) => !notification.read)
      .forEach((notification) => markRead(notification.id));
  };

  const handleNotificationClick = (notification: ProjectNotification) => {
    markRead(notification.id);
    navigate(resolveNotificationRoute(notification));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            {unreadCount === 0 ? 'You\'re all caught up' : `${unreadCount} unread`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 min-h-10 touch-manipulation"
          >
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <Bell className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">No notifications</p>
          <p className="mt-1 text-sm text-gray-400">New briefs and project alerts will show up here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={`w-full rounded-xl p-4 text-left transition-all ${getNotificationColor(notification.type)} ${
                !notification.read ? 'shadow-md' : 'opacity-70'
              } hover:brightness-[0.98] cursor-pointer`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-gray-900 sm:text-base">
                    {notification.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-700">{notification.message}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{formatTimestamp(notification.timestamp)}</span>
                    {!notification.read && (
                      <span className="text-xs font-medium text-blue-600">NEW</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
