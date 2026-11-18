"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { getNotificationPalette, type NotificationTone } from "@/components/notification-presets"

const rawToastManager = ToastPrimitive.createToastManager()

// Deduplicate identical consecutive notifications so rapid clicks never stack duplicates
const recentToastMap = new Map<string, { id: string; time: number }>()
const origAdd = rawToastManager.add.bind(rawToastManager)
rawToastManager.add = ((options: Parameters<typeof origAdd>[0]) => {
  const key = `${options.type || 'info'}::${String(options.title || '')}::${String(options.description || '')}`
  const now = Date.now()
  const prev = recentToastMap.get(key)
  if (prev && now - prev.time < 4500) {
    try {
      rawToastManager.close(prev.id)
    } catch {
      /* ignore */
    }
  }
  const id = origAdd(options)
  recentToastMap.set(key, { id, time: now })
  return id
}) as typeof rawToastManager.add

const toast = rawToastManager

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({
  className,
  ...props
}: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed inset-x-3 top-4 z-[2147483646] mx-auto flex w-auto max-w-[380px] flex-col gap-2.5 outline-none sm:inset-x-auto sm:top-5 sm:right-5 sm:left-auto sm:mx-0 sm:w-[380px]",
        className
      )}
      {...props}
    />
  )
}

function Toast({
  className,
  tone = "info",
  ...props
}: ToastPrimitive.Root.Props & { tone?: NotificationTone }) {
  const palette = getNotificationPalette(tone);
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "group/toast pointer-events-auto relative w-full origin-top overflow-hidden rounded-2xl border text-foreground outline-none select-none will-change-transform",
        "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "data-starting-style:-translate-y-3 data-starting-style:scale-95 data-starting-style:opacity-0",
        "data-ending-style:-translate-y-2 data-ending-style:scale-95 data-ending-style:opacity-0",
        "data-limited:hidden",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40",
        className
      )}
      swipeDirection={["up", "right", "left"]}
      style={{
        background: palette.shell,
        boxShadow: palette.glow,
        borderColor: palette.ring,
        backdropFilter: 'blur(22px) saturate(180%)',
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
      }}
      {...props}
    />
  )
}

function ToastContent({
  className,
  ...props
}: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden px-3.5 py-3",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-[0.86rem] font-bold leading-snug text-foreground", className)}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-[0.78rem] leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

function ToastAction({
  className,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "h-7 shrink-0 rounded-lg px-2.5 text-xs font-semibold",
        className
      )}
      {...props}
    />
  )
}

function ToastClose({
  className,
  children,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="ปิดการแจ้งเตือน"
      className={cn(
        "relative shrink-0 rounded-lg p-1 text-muted-foreground transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-foreground/10 hover:text-foreground",
        className
      )}
      {...props}
    >
      {children ?? <XIcon className="size-4" />}
    </ToastPrimitive.Close>
  )
}

function ToastIcon({ type }: { type: string | undefined }) {
  const tone = (type as NotificationTone) || "info"
  const palette = getNotificationPalette(tone)
  const iconNode =
    type === "success" ? (
      <CircleCheckIcon className="size-[18px]" style={{ color: palette.accent }} />
    ) : type === "warning" ? (
      <TriangleAlertIcon className="size-[18px]" style={{ color: palette.accent }} />
    ) : type === "error" ? (
      <CircleAlertIcon className="size-[18px]" style={{ color: palette.accent }} />
    ) : type === "loading" ? (
      <Loader2Icon className="size-[18px] animate-spin" style={{ color: palette.accent }} />
    ) : (
      <InfoIcon className="size-[18px]" style={{ color: palette.accent }} />
    )

  return (
    <span
      aria-hidden
      className="grid size-8.5 shrink-0 place-items-center rounded-xl"
      style={{
        background: palette.accentSoft,
        border: `1px solid ${palette.ring}`,
      }}
    >
      {iconNode}
    </span>
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toastItem) => {
    const tone = (toastItem.type as NotificationTone) || "info"
    const palette = getNotificationPalette(tone)
    return (
      <Toast key={toastItem.id} toast={toastItem} tone={tone}>
        <ToastContent>
          <span
            aria-hidden
            className="absolute left-0 top-2 bottom-2 w-[3.5px] rounded-r-full"
            style={{ background: palette.accent }}
          />
          <ToastIcon type={toastItem.type} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            {toastItem.title ? <ToastTitle>{toastItem.title}</ToastTitle> : null}
            {toastItem.description ? (
              <ToastDescription>{toastItem.description}</ToastDescription>
            ) : null}
          </div>
          {toastItem.actionProps ? <ToastAction {...toastItem.actionProps} /> : null}
          <ToastClose />
        </ToastContent>
      </Toast>
    )
  })
}

function Toaster({
  children,
  toastManager = toast,
  limit = 3,
  timeout = 3500,
  ...props
}: ToastPrimitive.Provider.Props) {
  return (
    <ToastProvider toastManager={toastManager} limit={limit} timeout={timeout} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}

const createToastManager = ToastPrimitive.createToastManager
const useToastManager = ToastPrimitive.useToastManager

export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastIcon,
  ToastList,
  createToastManager,
  toast,
  useToastManager,
}
