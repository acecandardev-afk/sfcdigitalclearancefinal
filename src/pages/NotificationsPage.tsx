import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Check, CheckCheck, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('id');
  const navigate = useNavigate();
  const { isSignatory } = useUserRole();
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead, deleteNotification, refetch } =
    useNotifications();
  const [dismissedHighlight, setDismissedHighlight] = useState(false);

  const openRelated = useCallback(
    (n: Notification) => {
      if (n.related_type === 'clearance' && n.related_id) {
        const path = isSignatory()
          ? `/dashboard/requests/${n.related_id}`
          : `/dashboard/clearances/${n.related_id}`;
        navigate(path);
        return;
      }
    },
    [isSignatory, navigate],
  );

  const handleRowClick = (n: Notification) => {
    if (!n.is_read) void markAsRead(n.id);
    if (n.related_type === 'clearance' && n.related_id) {
      openRelated(n);
    }
  };

  useEffect(() => {
    if (!highlightId || loading || notifications.length === 0 || dismissedHighlight) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`notification-row-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (notifications.some((n) => n.id === highlightId)) {
          const n = notifications.find((x) => x.id === highlightId);
          if (n && !n.is_read) void markAsRead(n.id);
        }
      }
    }, 80);
    return () => clearTimeout(t);
  }, [highlightId, loading, notifications, markAsRead, dismissedHighlight]);

  return (
    <DashboardLayout>
      <div className="app-page min-h-screen w-full min-w-0 bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full min-w-0 space-y-8">
          <header className="space-y-1 border-b border-border pb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Notifications</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Clearance updates and system messages. The bell shows your unread count.
            </p>
            {notifications.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{unreadCount}</span> unread
                  <span className="mx-2 text-border">·</span>
                  <span className="font-medium text-foreground">{notifications.length - unreadCount}</span> read
                </span>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {unreadCount > 0 && (
                <Button type="button" size="sm" className="h-9" onClick={() => void markAllAsRead()}>
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Mark all as read
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => void refetch()}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
          </header>

          {highlightId && (
            <div className="-mt-4 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setDismissedHighlight(true);
                  navigate({ pathname: '/dashboard/notifications', search: '' }, { replace: true });
                }}
              >
                Clear highlight
              </Button>
            </div>
          )}

          <section aria-label="Notification list">
            {loading ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
                <p className="font-medium text-foreground">No notifications</p>
                <p className="max-w-sm text-sm text-muted-foreground">When something needs your attention, it will appear here.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/dashboard">Back to dashboard</Link>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                    Refresh
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {notifications.map((n) => {
                  const isHi = highlightId === n.id && !dismissedHighlight;
                  return (
                    <li
                      id={`notification-row-${n.id}`}
                      key={n.id}
                      className={cn(
                        'relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-shadow',
                        'hover:shadow-sm',
                        !n.is_read && 'bg-muted/25',
                        isHi && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                      )}
                    >
                      <div
                        className={cn(
                          'absolute left-0 top-0 h-full w-[3px] bg-primary',
                          n.is_read && 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <div className="flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-stretch sm:gap-4">
                        <button
                          type="button"
                          onClick={() => handleRowClick(n)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={cn(
                                'text-sm text-foreground sm:text-[15px]',
                                n.is_read ? 'font-medium' : 'font-semibold',
                              )}
                            >
                              {n.title}
                            </p>
                            {n.is_read ? (
                              <Badge
                                variant="secondary"
                                className="h-5 rounded-md px-2 text-[10px] font-medium uppercase tracking-wide"
                              >
                                Read
                              </Badge>
                            ) : (
                              <Badge className="h-5 rounded-md border-0 bg-primary px-2 text-[10px] font-medium uppercase tracking-wide text-primary-foreground">
                                Unread
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{n.message}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                          {n.related_type === 'clearance' && n.related_id && (
                            <p className="mt-2 text-xs font-medium text-primary">Open linked clearance →</p>
                          )}
                        </button>

                        <div
                          className="flex shrink-0 items-center justify-end gap-1 border-t border-border/60 pt-3 sm:flex-col sm:border-0 sm:pt-0"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          role="toolbar"
                          aria-label="Notification actions"
                        >
                          {!n.is_read && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => void markAsRead(n.id)}
                                >
                                  <span className="sr-only">Mark as read</span>
                                  <Check className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">Mark as read</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                onClick={() => void deleteNotification(n.id)}
                              >
                                <span className="sr-only">Delete</span>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
