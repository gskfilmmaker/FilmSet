import * as React from "react";
import { Toast, ToastAction, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast";
import { useToast } from "./use-toast";

/** Render once near the app root. Fire toasts from anywhere via `toast({...})`. */
export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          {title && <ToastTitle>{title}</ToastTitle>}
          {description && <ToastDescription>{description}</ToastDescription>}
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

export { ToastAction };
