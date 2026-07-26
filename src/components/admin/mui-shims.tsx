'use client';

/**
 * Lightweight MUI API shims backed by HTML + shadcn.
 * Used while finishing admin page migration off @mui/material.
 */
import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button as UiButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch as UiSwitch } from '@/components/ui/switch';
import { Checkbox as UiCheckbox } from '@/components/ui/checkbox';
import { Badge as UiBadge } from '@/components/ui/badge';
import {
  Dialog as UiDialog,
  DialogContent as UiDialogContent,
  DialogFooter as UiDialogFooter,
  DialogTitle as UiDialogTitle,
} from '@/components/ui/dialog';
import {
  Table as UiTable,
  TableBody as UiTableBody,
  TableCell as UiTableCell,
  TableHeader as UiTableHeader,
  TableRow as UiTableRow,
} from '@/components/ui/table';
import { Alert as UiAlert } from '@/components/ui/alert';
import { Card as UiCard, CardContent as UiCardContent, CardHeader as UiCardHeader } from '@/components/ui/card';

const SPACING_PROPS = new Set([
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml',
  'gap', 'rowGap', 'columnGap',
]);

function space(v: unknown): unknown {
  if (typeof v === 'number') return `${v * 8}px`;
  return v;
}

function pickResponsive(v: unknown): unknown {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return o.md ?? o.sm ?? o.xs ?? o.lg ?? Object.values(o)[0];
  }
  return v;
}

/** Convert a subset of MUI `sx` into inline CSS + optional className extras. */
export function sxToStyle(sx: unknown): React.CSSProperties {
  if (!sx) return {};
  const style: Record<string, unknown> = {};
  const list = Array.isArray(sx) ? sx : [sx];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [rawKey, rawVal] of Object.entries(entry as Record<string, unknown>)) {
      if (rawKey.startsWith('&') || rawKey.startsWith('@')) continue;
      if (rawKey === 'typography') continue;
      let key = rawKey;
      if (key === 'bgcolor') key = 'backgroundColor';
      if (key === 'bg') key = 'background';
      let val = pickResponsive(rawVal);
      if (SPACING_PROPS.has(rawKey)) val = space(val);
      if (rawKey === 'borderRadius' && typeof val === 'number') val = `${val * 8}px`;
      if (rawKey === 'fontWeight' && typeof val === 'number' && val <= 9) {
        // keep as-is (MUI sometimes uses 700 etc already)
      }
      style[key] = val;
    }
  }
  return style as React.CSSProperties;
}

export function Box({ sx, component = 'div', style, className, children, ...rest }: any) {
  const Comp = component as React.ElementType;
  return (
    <Comp className={className} style={{ ...sxToStyle(sx), ...style }} {...rest}>
      {children}
    </Comp>
  );
}

export function Typography({
  sx,
  variant,
  component,
  style,
  className,
  children,
  noWrap,
  ...rest
}: any) {
  const Comp = (component ||
    (variant === 'h1' || variant === 'h2' || variant === 'h3' || variant === 'h4' || variant === 'h5' || variant === 'h6'
      ? variant
      : 'p')) as React.ElementType;
  return (
    <Comp
      className={cn(noWrap && 'truncate', className)}
      style={{ margin: 0, ...sxToStyle(sx), ...style }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function Button({
  sx,
  variant = 'contained',
  color,
  size = 'medium',
  startIcon,
  endIcon,
  fullWidth,
  className,
  style,
  children,
  disabled,
  component,
  href,
  target,
  rel,
  onClick,
  ...rest
}: {
  sx?: unknown;
  variant?: string;
  color?: string;
  size?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  disabled?: boolean;
  component?: string;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  [key: string]: any;
}) {
  const uiVariant =
    variant === 'outlined' || variant === 'text' || variant === 'ghost'
      ? variant === 'text'
        ? 'ghost'
        : 'outline'
      : color === 'error'
        ? 'destructive'
        : 'default';
  const uiSize = size === 'small' ? 'sm' : size === 'large' ? 'lg' : 'default';
  if (component === 'a' || href) {
    return (
      <UiButton
        asChild
        variant={uiVariant as 'default' | 'outline' | 'ghost' | 'destructive'}
        size={uiSize as 'sm' | 'default' | 'lg'}
        disabled={disabled}
        className={cn(fullWidth && 'w-full', className)}
        style={{ ...sxToStyle(sx), ...style }}
      >
        <a href={href} target={target} rel={rel} {...rest}>
          {startIcon}
          {children}
          {endIcon}
        </a>
      </UiButton>
    );
  }
  return (
    <UiButton
      variant={uiVariant as 'default' | 'outline' | 'ghost' | 'destructive'}
      size={uiSize as 'sm' | 'default' | 'lg'}
      disabled={disabled}
      className={cn(fullWidth && 'w-full', className)}
      style={{ ...sxToStyle(sx), ...style }}
      {...rest}
    >
      {startIcon}
      {children}
      {endIcon}
    </UiButton>
  );
}

export function IconButton({
  sx,
  className,
  style,
  children,
  size,
  component,
  href,
  onClick,
  ...rest
}: {
  sx?: unknown;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  size?: string;
  component?: string;
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  [key: string]: any;
}) {
  if (component === 'a' || href) {
    return (
      <UiButton asChild variant="ghost" size="icon" className={cn(size === 'small' && 'size-8', className)} style={{ ...sxToStyle(sx), ...style }}>
        <a href={href} {...rest}>{children}</a>
      </UiButton>
    );
  }
  return (
    <UiButton
      variant="ghost"
      size="icon"
      className={cn(size === 'small' && 'size-8', className)}
      style={{ ...sxToStyle(sx), ...style }}
      {...rest}
    >
      {children}
    </UiButton>
  );
}

export function TextField({
  label,
  value,
  onChange,
  onKeyDown,
  fullWidth,
  sx,
  type = 'text',
  placeholder,
  multiline,
  rows = 3,
  select,
  children,
  disabled,
  InputProps,
  inputProps,
  inputRef,
  autoFocus,
  className,
  style,
  autoComplete,
  SelectProps,
  ..._rest
}: {
  label?: React.ReactNode;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  fullWidth?: boolean;
  sx?: unknown;
  type?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  select?: boolean;
  children?: React.ReactNode;
  disabled?: boolean;
  InputProps?: any;
  inputProps?: any;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
  autoComplete?: string;
  SelectProps?: any;
  [key: string]: any;
}) {
  if (select) {
    // MUI select-as-TextField: render native select for MenuItem children
    return (
      <div className={cn(fullWidth && 'w-full', 'space-y-1.5')} style={{ ...sxToStyle(sx), ...style }}>
        {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
          value={value as string}
          onChange={onChange as any}
          disabled={disabled}
        >
          {children}
        </select>
      </div>
    );
  }

  const control = multiline ? (
    <Textarea
      ref={inputRef as any}
      value={value as string}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      autoFocus={autoFocus}
      className="w-full"
      {...(inputProps as any)}
    />
  ) : (
    <div className="relative flex w-full items-center">
      {InputProps?.startAdornment ? (
        <span className="pointer-events-none absolute left-2.5 z-10 flex items-center text-muted-foreground">
          {InputProps.startAdornment}
        </span>
      ) : null}
      <Input
        ref={inputRef}
        type={type}
        value={value as string}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className={cn(
          'w-full',
          InputProps?.startAdornment && 'pl-9',
          InputProps?.endAdornment && 'pr-9',
        )}
        {...inputProps}
        {...(InputProps?.inputProps || {})}
      />
      {InputProps?.endAdornment ? (
        <span className="absolute right-1 z-10 flex items-center">{InputProps.endAdornment}</span>
      ) : null}
    </div>
  );

  return (
    <div className={cn(fullWidth && 'w-full', 'space-y-1.5', className)} style={{ ...sxToStyle(sx), ...style }}>
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
      {control}
    </div>
  );
}

export function InputAdornment({
  position,
  children,
}: {
  position?: 'start' | 'end';
  children?: React.ReactNode;
}) {
  return <span data-position={position} className="inline-flex items-center">{children}</span>;
}

export function MenuItem({
  value,
  children,
  disabled,
  sx,
  onClick,
}: {
  value?: string | number;
  children?: React.ReactNode;
  disabled?: boolean;
  sx?: unknown;
  onClick?: () => void;
}) {
  return (
    <option value={value} disabled={disabled} style={sxToStyle(sx)} onClick={onClick}>
      {children}
    </option>
  );
}

export function Select({
  value,
  onChange,
  children,
  fullWidth,
  sx,
  disabled,
  className,
}: {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
  fullWidth?: boolean;
  size?: string;
  sx?: unknown;
  displayEmpty?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      className={cn(
        'flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none',
        fullWidth && 'w-full',
        className,
      )}
      style={sxToStyle(sx)}
      value={value}
      disabled={disabled}
      onChange={onChange}
    >
      {children}
    </select>
  );
}

export function FormControl({ children, fullWidth, sx, size, className }: any) {
  return (
    <div className={cn(fullWidth && 'w-full', className)} style={sxToStyle(sx)}>
      {children}
    </div>
  );
}

export function InputLabel({ children, sx, shrink, className }: any) {
  return (
    <Label className={cn('text-xs text-muted-foreground', className)} style={sxToStyle(sx)}>
      {children}
    </Label>
  );
}

export function FormControlLabel({
  control,
  label,
  sx,
  className,
}: {
  control: React.ReactElement;
  label?: React.ReactNode;
  sx?: unknown;
  className?: string;
}) {
  return (
    <label className={cn('inline-flex items-center gap-2', className)} style={sxToStyle(sx)}>
      {control}
      <span className="text-sm">{label}</span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  sx,
  className,
  disabled,
  ..._rest
}: any) {
  return (
    <UiSwitch
      checked={!!checked}
      disabled={disabled}
      className={className}
      style={sxToStyle(sx)}
      onCheckedChange={(v) => onChange?.({ target: { checked: v } })}
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  sx,
  className,
  disabled,
  ..._rest
}: any) {
  return (
    <UiCheckbox
      checked={!!checked}
      disabled={disabled}
      className={className}
      style={sxToStyle(sx)}
      onCheckedChange={(v) => onChange?.({ target: { checked: v === true } })}
    />
  );
}

export function Chip({
  label,
  size,
  sx,
  className,
  icon,
  onDelete,
  color,
  variant,
  ...rest
}: any) {
  return (
    <UiBadge
      variant={variant === 'outlined' ? 'outline' : 'secondary'}
      className={cn('gap-1 font-medium', size === 'small' && 'text-[0.65rem]', className)}
      style={sxToStyle(sx)}
      {...rest}
    >
      {icon}
      {label}
    </UiBadge>
  );
}

export function CircularProgress({ size = 24, sx, className }: any) {
  return (
    <Loader2
      className={cn('animate-spin', className)}
      style={{ width: size, height: size, ...sxToStyle(sx) }}
    />
  );
}

export function Dialog({
  open,
  onClose,
  children,
  fullWidth,
  maxWidth,
  PaperProps,
}: {
  open?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  fullWidth?: boolean;
  maxWidth?: string;
  PaperProps?: { sx?: unknown };
}) {
  const widthClass =
    maxWidth === 'xs'
      ? 'sm:max-w-sm'
      : maxWidth === 'md'
        ? 'sm:max-w-xl'
        : maxWidth === 'lg'
          ? 'sm:max-w-2xl'
          : maxWidth === 'xl'
            ? 'sm:max-w-4xl'
            : 'sm:max-w-lg';
  return (
    <UiDialog open={!!open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <UiDialogContent
        className={cn('gap-0 p-0 overflow-visible', fullWidth !== false && widthClass)}
        style={sxToStyle(PaperProps?.sx)}
      >
        {children}
      </UiDialogContent>
    </UiDialog>
  );
}

export function DialogTitle({ children, sx, className }: any) {
  return (
    <UiDialogTitle className={cn('px-4 pt-4 text-base', className)} style={sxToStyle(sx)}>
      {children}
    </UiDialogTitle>
  );
}

export function DialogContent({ children, sx, className }: any) {
  // Outer Dialog already wraps Radix DialogContent — this is just a body region.
  return (
    <div className={cn('px-4 py-3', className)} style={sxToStyle(sx)}>
      {children}
    </div>
  );
}

export function DialogActions({ children, sx, className }: any) {
  return (
    <UiDialogFooter className={cn('px-4 pb-4', className)} style={sxToStyle(sx)}>
      {children}
    </UiDialogFooter>
  );
}

export function Card({ children, sx, className, onClick, style, ...rest }: any) {
  return (
    <UiCard
      className={cn(onClick && 'cursor-pointer', className)}
      style={{ ...sxToStyle(sx), ...style }}
      onClick={onClick}
      {...rest}
    >
      {children}
    </UiCard>
  );
}

export function CardContent({ children, sx, className, ...rest }: any) {
  return (
    <UiCardContent className={className} style={sxToStyle(sx)} {...rest}>
      {children}
    </UiCardContent>
  );
}

export function CardHeader({ children, sx, className, title, subheader, action, ...rest }: any) {
  return (
    <UiCardHeader className={className} style={sxToStyle(sx)} {...rest}>
      {title}
      {subheader}
      {action}
      {children}
    </UiCardHeader>
  );
}

export function TableContainer({ children, sx, className }: any) {
  return (
    <div className={cn('w-full overflow-x-auto', className)} style={sxToStyle(sx)}>
      {children}
    </div>
  );
}

export function Table({ children, sx, className, size }: any) {
  return (
    <UiTable className={className} style={sxToStyle(sx)}>
      {children}
    </UiTable>
  );
}

export function TableHead({ children, sx, className }: any) {
  return (
    <UiTableHeader className={className} style={sxToStyle(sx)}>
      {children}
    </UiTableHeader>
  );
}

export function TableBody({ children, sx, className }: any) {
  return (
    <UiTableBody className={className} style={sxToStyle(sx)}>
      {children}
    </UiTableBody>
  );
}

export function TableRow({ children, sx, className, hover, onClick, ...rest }: any) {
  return (
    <UiTableRow
      className={cn(hover && 'hover:bg-muted/40', onClick && 'cursor-pointer', className)}
      style={sxToStyle(sx)}
      onClick={onClick}
      {...rest}
    >
      {children}
    </UiTableRow>
  );
}

export function TableCell({ children, sx, className, align, colSpan, ...rest }: any) {
  return (
    <UiTableCell
      className={cn(align === 'right' && 'text-right', align === 'center' && 'text-center', className)}
      style={sxToStyle(sx)}
      colSpan={colSpan}
      {...rest}
    >
      {children}
    </UiTableCell>
  );
}

export function Alert({ children, severity = 'info', sx, className, icon, ...rest }: any) {
  return (
    <UiAlert
      className={cn(
        severity === 'error' && 'border-destructive/40 text-destructive',
        severity === 'warning' && 'border-amber-500/40 text-amber-600',
        severity === 'success' && 'border-emerald-500/40 text-emerald-600',
        className,
      )}
      style={sxToStyle(sx)}
      {...rest}
    >
      {icon}
      {children}
    </UiAlert>
  );
}

export function Stack({ children, direction = 'column', spacing = 1, sx, className, ...rest }: any) {
  return (
    <div
      className={cn('flex', direction === 'row' ? 'flex-row' : 'flex-col', className)}
      style={{ gap: typeof spacing === 'number' ? spacing * 8 : spacing, ...sxToStyle(sx) }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Avatar({ src, alt, children, sx, className }: any) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || ''}
        className={cn('size-10 rounded-full object-cover', className)}
        style={sxToStyle(sx)}
      />
    );
  }
  return (
    <div
      className={cn('flex size-10 items-center justify-center rounded-full bg-muted text-sm', className)}
      style={sxToStyle(sx)}
    >
      {children}
    </div>
  );
}

export function Tooltip({ title, children }: { title?: React.ReactNode; children: React.ReactElement }) {
  if (React.isValidElement(children) && typeof title === 'string') {
    return React.cloneElement(children as React.ReactElement<any>, { title });
  }
  return children;
}

export function Badge({ badgeContent, children, color, sx, className, invisible }: any) {
  return (
    <span className={cn('relative inline-flex', className)} style={sxToStyle(sx)}>
      {children}
      {!invisible && badgeContent != null && badgeContent !== 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] text-primary-foreground">
          {badgeContent}
        </span>
      ) : null}
    </span>
  );
}

/** Unused legacy chrome — no-ops / simple wrappers so imports keep compiling. */
export function AppBar({ children }: any) {
  return <header>{children}</header>;
}
export function Toolbar({ children }: any) {
  return <div className="flex items-center gap-2">{children}</div>;
}
export function Drawer({ children, open }: any) {
  if (!open) return null;
  return <aside>{children}</aside>;
}
export function List({ children }: any) {
  return <ul>{children}</ul>;
}
export function ListItem({ children }: any) {
  return <li>{children}</li>;
}
export function ListItemIcon({ children }: any) {
  return <span>{children}</span>;
}
export function ListItemText({ primary, secondary }: any) {
  return (
    <span>
      <div>{primary}</div>
      {secondary ? <div className="text-xs text-muted-foreground">{secondary}</div> : null}
    </span>
  );
}

export function Autocomplete(props: any) {
  const {
    options = [],
    value,
    onChange,
    getOptionLabel = (o: any) => String(o ?? ''),
    renderInput,
    freeSolo,
    multiple,
    sx,
  } = props;
  const label = value != null ? getOptionLabel(value) : '';
  return (
    <div style={sxToStyle(sx)}>
      <Input
        value={label}
        onChange={(e) => {
          const text = e.target.value;
          if (freeSolo) onChange?.(e, text);
          else {
            const match = options.find((o: any) => getOptionLabel(o) === text);
            onChange?.(e, match ?? null);
          }
        }}
        list={multiple ? undefined : 'admin-ac-opts'}
      />
      {!multiple && (
        <datalist id="admin-ac-opts">
          {options.map((o: any, i: number) => (
            <option key={i} value={getOptionLabel(o)} />
          ))}
        </datalist>
      )}
      {typeof renderInput === 'function' ? null : null}
    </div>
  );
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
