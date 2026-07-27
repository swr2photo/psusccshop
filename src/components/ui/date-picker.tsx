"use client"

import * as React from "react"
import { format } from "date-fns"
import { th } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function parseDate(value?: Date | string | null): Date | undefined {
  if (!value) return undefined
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function toDateTimeLocalValue(date?: Date): string {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function applyTime(base: Date, hours: number, minutes: number): Date {
  const next = new Date(base)
  next.setHours(hours, minutes, 0, 0)
  return next
}

type DatePickerProps = {
  value?: Date | string | null
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
  id?: string
}

function DatePicker({
  value,
  onChange,
  placeholder = "เลือกวันที่",
  disabled,
  className,
  buttonClassName,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const date = parseDate(value)

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={!date}
            className={cn(
              "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
              buttonClassName,
            )}
          >
            <CalendarIcon />
            {date ? format(date, "d MMM yyyy", { locale: th }) : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(next) => {
              onChange?.(next)
              setOpen(false)
            }}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

type DateRangePickerProps = {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
  numberOfMonths?: number
  id?: string
}

function DateRangePicker({
  value,
  onChange,
  placeholder = "เลือกช่วงวันที่",
  disabled,
  className,
  buttonClassName,
  numberOfMonths = 2,
  id,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const hasRange = Boolean(value?.from)

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={!hasRange}
            className={cn(
              "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
              buttonClassName,
            )}
          >
            <CalendarIcon />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "d MMM yyyy", { locale: th })} –{" "}
                  {format(value.to, "d MMM yyyy", { locale: th })}
                </>
              ) : (
                format(value.from, "d MMM yyyy", { locale: th })
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={numberOfMonths}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

type DateTimePickerProps = {
  /** ISO or `YYYY-MM-DDTHH:mm` local string */
  value?: Date | string | null
  /** Emits local `YYYY-MM-DDTHH:mm` (compatible with datetime-local flows) */
  onChange?: (localDateTime: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
  label?: React.ReactNode
  id?: string
}

function DateTimePicker({
  value,
  onChange,
  placeholder = "เลือกวันและเวลา",
  disabled,
  className,
  buttonClassName,
  label,
  id,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const date = parseDate(value)
  const timeValue = date
    ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    : "00:00"

  const emit = (next: Date | undefined) => {
    onChange?.(next ? toDateTimeLocalValue(next) : "")
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      {label ? (
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={!date}
            className={cn(
              "h-10 w-full justify-start rounded-[12px] text-left font-normal data-[empty=true]:text-muted-foreground",
              buttonClassName,
            )}
          >
            <CalendarIcon />
            {date ? (
              format(date, "d MMM yyyy · HH:mm", { locale: th })
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selected) => {
              if (!selected) {
                emit(undefined)
                return
              }
              const [hh, mm] = timeValue.split(":").map(Number)
              emit(applyTime(selected, hh || 0, mm || 0))
            }}
            captionLayout="dropdown"
          />
          <div className="flex items-center gap-2 border-t border-border p-3">
            <Label htmlFor={`${id || "datetime"}-time`} className="shrink-0 text-xs">
              เวลา
            </Label>
            <Input
              id={`${id || "datetime"}-time`}
              type="time"
              value={timeValue}
              disabled={disabled || !date}
              onChange={(e) => {
                if (!date) return
                const [hh, mm] = e.target.value.split(":").map(Number)
                emit(applyTime(date, hh || 0, mm || 0))
              }}
              className="h-8"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              disabled={!date}
              onClick={() => {
                emit(undefined)
                setOpen(false)
              }}
            >
              ล้าง
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export { DatePicker, DateRangePicker, DateTimePicker, toDateTimeLocalValue }
export type { DatePickerProps, DateRangePickerProps, DateTimePickerProps }
