import { forwardRef, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type AutoResizeTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, className, onChange, ...props }, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    return (
      <textarea
        ref={(el) => {
          innerRef.current = el;
          if (typeof forwardedRef === "function") forwardedRef(el);
          else if (forwardedRef) forwardedRef.current = el;
        }}
        value={value}
        onChange={onChange}
        rows={1}
        className={cn(
          "w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
          className,
        )}
        {...props}
      />
    );
  },
);
AutoResizeTextarea.displayName = "AutoResizeTextarea";
