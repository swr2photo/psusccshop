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

const toast = ToastPrimitive.createToastManager()

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
        "pointer-events-none fixed inset-x-4 top-4 z-[2147483646] mx-auto flex w-auto max-w-sm flex-col gap-0 outline-none sm:inset-x-auto sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
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
        "group/toast pointer-events-auto absolute right-0 top-0 z-[calc(1000-var(--toast-index))] w-full origin-top rounded-[22px] border text-popover-foreground outline-none select-none will-change-transform focus-visible:ring-[3px] focus-visible:ring-ring/40 overflow-hidden",
        "[--gap:0.625rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)+calc(var(--toast-index)*var(--gap))+var(--toast-swipe-movement-y))] [--peek:0.45rem] [--scale:calc(max(0,1-(var(--toast-index)*0.08)))] [--shrink:calc(1-var(--scale))]",
        "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--peek))+(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_620ms_cubic-bezier(0.22,1,0.36,1),opacity_520ms,height_150ms]",
        "after:absolute after:bottom-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
        "data-limited:opacity-0 data-starting-style:[transform:translateY(-24px)_scale(0.96)]",
        "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(-24px)_scale(0.96)]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+120%))_scale(0.96)]",
        "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-120%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+120%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-120%))_scale(0.96)]",
        className
      )}
      swipeDirection={["up", "right", "left"]}
      style={{
        background: palette.shell,
        boxShadow: palette.glow,
        borderColor: palette.ring,
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
        "relative flex h-full items-start gap-3 overflow-hidden p-4 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100",
        className
      )}
      style={{
        backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.18) 100%)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      }}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium", className)}
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
      className={cn("text-sm text-muted-foreground", className)}
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
        "shrink-0",
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
        "relative shrink-0 rounded-md p-1 text-muted-foreground transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-muted hover:text-foreground",
        className
      )}
      {...props}
    >
      {children ?? <XIcon className="size-4" />}
    </ToastPrimitive.Close>
  )
}

function ToastIcon({ type }: { type: string | undefined }) {
  if (type === "success") {
    return <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" />
  }
  if (type === "info") {
    return <InfoIcon className="mt-0.5 size-4 shrink-0 text-sky-500" />
  }
  if (type === "warning") {
    return <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
  }
  if (type === "error") {
    return <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
  }
  if (type === "loading") {
    return <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
  }
  return null
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem} tone={(toastItem.type as NotificationTone) || "info"}>
      <ToastContent>
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-[3px] rounded-r-full"
          style={{ background: getNotificationPalette((toastItem.type as NotificationTone) || "info").accent }}
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
  ))
}

function Toaster({
  children,
  toastManager = toast,
  limit = 5,
  timeout = 4000,
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
