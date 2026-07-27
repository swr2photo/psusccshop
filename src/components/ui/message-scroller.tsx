"use client"

import * as React from "react"
import { ArrowDown, Loader2 } from "lucide-react"
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller"

import { cn } from "@/lib/utils"

function MessageScrollerProvider({
  autoScroll = true,
  defaultScrollPosition = "last-anchor",
  scrollPreviousItemPeek = 48,
  scrollEdgeThreshold = 64,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>) {
  return (
    <MessageScrollerPrimitive.Provider
      autoScroll={autoScroll}
      defaultScrollPosition={defaultScrollPosition}
      scrollPreviousItemPeek={scrollPreviousItemPeek}
      scrollEdgeThreshold={scrollEdgeThreshold}
      {...props}
    />
  )
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function MessageScrollerViewport({
  className,
  preserveScrollOnPrepend = true,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      aria-label="ข้อความแชท"
      preserveScrollOnPrepend={preserveScrollOnPrepend}
      className={cn(
        "size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain contain-content",
        "data-autoscrolling:scrollbar-thumb-transparent",
        className
      )}
      {...props}
    />
  )
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn("flex h-max min-h-full flex-col gap-1", className)}
      {...props}
    />
  )
}

function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn("min-w-0 shrink-0", className)}
      {...props}
    />
  )
}

/**
 * Jump-to-latest control — mounts only when the user has scrolled away from the bottom.
 * Avoids relying solely on data-active CSS (content size edge cases can leave opacity wrong).
 */
function MessageScrollerButton({
  className,
  label = "ไปข้อความล่าสุด",
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & {
  label?: string
}) {
  const { end } = useMessageScrollerScrollable()
  const { scrollToEnd } = useMessageScroller()

  if (!end) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
      <button
        type="button"
        data-slot="message-scroller-button"
        className={cn(
          "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-sm transition hover:bg-muted",
          className
        )}
        onClick={() => scrollToEnd({ behavior: "smooth" })}
        {...props}
      >
        <ArrowDown className="size-3.5" />
        {label}
      </button>
    </div>
  )
}

/** Bridge so parent send handlers can call scrollToEnd without living inside the provider tree logic. */
function MessageScrollerApiBridge({
  apiRef,
}: {
  apiRef: React.MutableRefObject<ReturnType<typeof useMessageScroller> | null>
}) {
  const api = useMessageScroller()
  React.useEffect(() => {
    apiRef.current = api
    return () => {
      apiRef.current = null
    }
  }, [api, apiRef])
  return null
}

/** Auto-fetch older pages when the user scrolls to the top. */
function MessageScrollerLoadOlder({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}) {
  const { start } = useMessageScrollerScrollable()
  const loadingRef = React.useRef(loading)
  const onLoadRef = React.useRef(onLoadMore)
  const wasAwayFromTopRef = React.useRef(false)
  loadingRef.current = loading
  onLoadRef.current = onLoadMore

  // `start` means "not at top" (scrollTop > threshold). Load only after the user
  // has scrolled away and back up — avoids prefetching the whole history on short threads.
  React.useEffect(() => {
    if (start) {
      wasAwayFromTopRef.current = true
      return
    }
    if (!hasMore || loadingRef.current || !wasAwayFromTopRef.current) return
    onLoadRef.current()
  }, [hasMore, start])

  if (!hasMore && !loading) return null

  return (
    <div className="flex items-center justify-center gap-2 py-2" aria-live="polite">
      {loading ? (
        <>
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-[0.65rem] text-muted-foreground">กำลังโหลดข้อความเก่า...</span>
        </>
      ) : hasMore ? (
        <button
          type="button"
          className="rounded-full border border-border bg-background px-2.5 py-1 text-[0.65rem] text-muted-foreground transition hover:bg-muted"
          onClick={() => onLoadMore()}
        >
          โหลดข้อความเก่า
        </button>
      ) : (
        <span className="h-3.5" aria-hidden />
      )}
    </div>
  )
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  MessageScrollerApiBridge,
  MessageScrollerLoadOlder,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
}
