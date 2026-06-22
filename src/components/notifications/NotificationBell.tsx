import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch,
  } = useNotifications();
  const [open, setOpen] = useState(false);

  const goToInbox = (notification: Notification) => {
    if (!notification.is_read) {
      void markAsRead(notification.id);
    }
    navigate(
      `/dashboard/notifications?${new URLSearchParams({ id: notification.id }).toString()}`,
    );
    setOpen(false);
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-l-success bg-success/5';
      case 'error':
        return 'border-l-destructive bg-destructive/5';
      case 'warning':
        return 'border-l-warning bg-warning/5';
      default:
        return 'border-l-primary bg-primary/5';
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refetch();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-12 w-12 -translate-x-[30px]"
        >
          <Bell className="h-[34px] w-[34px] sm:h-[38px] sm:w-[38px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 top-0.5 h-5 min-w-5 rounded-full bg-destructive px-0.5 text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex flex-col gap-2 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void markAllAsRead()}
                className="text-xs h-7"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" className="text-xs h-7" asChild>
              <Link to="/dashboard/notifications" onClick={() => setOpen(false)}>
                View all
              </Link>
            </Button>
          </div>
        </div>
        <div className="max-h-[min(400px,70dvh)] overflow-y-auto overflow-x-hidden overscroll-contain">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border min-h-0">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 border-l-4 cursor-pointer hover:bg-accent/50 transition-colors',
                    getTypeStyles(notification.type),
                    !notification.is_read && 'bg-accent/30'
                  )}
                  onClick={() => goToInbox(notification)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', !notification.is_read && 'font-semibold')}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToInbox(notification);
                          }}
                          title="Mark as read and open"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
