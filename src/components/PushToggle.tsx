import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isSubscribed, pushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push";

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function PushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    setSupported(pushSupported());
    setInIframe(isInIframe());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    isSubscribed().then(setEnabled);
  }, []);

  const toggle = async () => {
    setBusy(true);
    if (enabled) {
      await unsubscribeFromPush();
      setEnabled(false);
      toast.success("Notifications disabled");
    } else {
      const res = await subscribeToPush();
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
      if (res.ok) {
        setEnabled(true);
        toast.success("Notifications enabled on this device");
      } else if (Notification.permission === "denied") {
        toast.error("Notifications were blocked. Open browser site settings to allow them, then try again.");
      } else {
        toast.error(res.error ?? "Could not enable notifications");
      }
    }
    setBusy(false);
  };

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Push notifications aren't supported on this browser. Add the app to your Home Screen for the best experience.
      </p>
    );
  }

  if (inIframe) {
    return (
      <p className="text-xs text-muted-foreground">
        Notifications can't be enabled inside the editor preview. Open the published app on your phone (Chrome → Add to Home Screen) and enable from there.
      </p>
    );
  }

  if (permission === "denied") {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-destructive font-medium">Notifications are blocked for this site.</p>
        <p className="text-xs text-muted-foreground">
          On Android Chrome: tap the lock icon in the address bar → Permissions → Notifications → Allow. Then reload and try again.
        </p>
      </div>
    );
  }

  return (
    <Button
      variant={enabled ? "outline" : "default"}
      size="sm"
      className="rounded-xl gap-1.5"
      onClick={toggle}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : enabled ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {enabled ? "Disable notifications" : "Enable notifications"}
    </Button>
  );
}
