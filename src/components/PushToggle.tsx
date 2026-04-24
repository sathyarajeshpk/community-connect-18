import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isSubscribed, pushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push";

export function PushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(pushSupported());
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
      if (res.ok) {
        setEnabled(true);
        toast.success("Notifications enabled on this device");
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
