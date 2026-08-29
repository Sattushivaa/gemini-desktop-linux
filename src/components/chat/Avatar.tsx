import { cn } from "@/lib/utils";

interface AvatarProps {
  variant?: "model" | "user";
  size?: "sm" | "md";
}

export function Avatar({ variant = "model", size = "md" }: AvatarProps) {
  const box =
    size === "sm"
      ? "h-5 w-5 rounded"
      : variant === "model"
        ? "h-7 w-7 rounded-md"
        : "h-7 w-7 rounded-full";

  return (
    <div
      className={cn(
        "flex items-center justify-center border",
        box,
        variant === "model"
          ? "border-border bg-accent"
          : "border-border bg-secondary",
      )}
      aria-hidden="true"
    >
      {variant === "model" ? (
        <svg viewBox="0 0 128 128" className="h-[60%] w-[60%]">
          <path
            d="M64 26 L72.5 55.5 L102 64 L72.5 72.5 L64 102 L55.5 72.5 L26 64 L55.5 55.5 Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-[55%] w-[55%] text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </div>
  );
}