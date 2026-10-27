import { toast as sonner, type ExternalToast } from "sonner";

// Toasts van de editor: op telefoon/tablet bovenin het beeld i.p.v. onderin, want onderin
// staat de werkbalk (en de contextbalk) — een toast eroverheen blokkeert dan de knoppen.
// Zelfde API als sonner's `toast` voor de aanroepen die de editor gebruikt.
type Message = Parameters<typeof sonner>[0];

function withPosition(options?: ExternalToast): ExternalToast {
  if (typeof window !== "undefined" && window.innerWidth < 1024) return { position: "top-center", ...options };
  return options ?? {};
}

export const toast = Object.assign((message: Message, options?: ExternalToast) => sonner(message, withPosition(options)), {
  info: (message: Message, options?: ExternalToast) => sonner.info(message, withPosition(options)),
  error: (message: Message, options?: ExternalToast) => sonner.error(message, withPosition(options)),
  success: (message: Message, options?: ExternalToast) => sonner.success(message, withPosition(options)),
  warning: (message: Message, options?: ExternalToast) => sonner.warning(message, withPosition(options)),
  dismiss: sonner.dismiss,
});
