import React from 'react';
import { useWorkspaceNotifications, type WorkspaceNotification, type NotificationUrgency } from '@/contexts/WorkspaceNotificationContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, CheckCheck, Clock, AlertTriangle, Phone, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

const urgencyIcon: Record<NotificationUrgency, React.ReactNode> = {
  normal: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  urgent: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
  due: <Phone className="h-3.5 w-3.5 text-primary" />,
  overdue: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />,
  info: <Info className="h-3.5 w-3.5 text-primary" />,
};

const urgencyDot: Record<NotificationUrgency, string> = {
  normal: 'bg-muted-foreground',
  urgent: 'bg-warning',
  due: 'bg-primary',
  overdue: 'bg-destructive',
  info: 'bg-primary',
};

interface NotificationPanelProps {
  onOpenLead?: (leadId: string) => void;
}

export function NotificationPanel({ onOpenLead }: NotificationPanelProps) {
  const { notifications, unreadCount, markRead, markAllRead } = useWorkspaceNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground">Callback reminders and alerts will appear here</p>
            </div>
          ) : (
            notifications.map(n => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={() => markRead(n.id)}
                onOpenLead={onOpenLead}
              />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({
  notification: n,
  onRead,
  onOpenLead,
}: {
  notification: WorkspaceNotification;
  onRead: () => void;
  onOpenLead?: (leadId: string) => void;
}) {
  const isUnread = !n.readAt;

  const handleClick = () => {
    if (isUnread) onRead();
    if (n.relatedLeadId && onOpenLead) onOpenLead(n.relatedLeadId);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b transition-colors hover:bg-accent/50',
        isUnread && 'bg-primary/[0.03]'
      )}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {urgencyIcon[n.urgency]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isUnread && <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', urgencyDot[n.urgency])} />}
            <span className={cn('text-sm truncate', isUnread ? 'font-semibold' : 'font-medium text-muted-foreground')}>
              {n.title}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            {formatDistanceToNow(n.createdAt, { addSuffix: true })}
          </p>
        </div>
      </div>
    </button>
  );
}
