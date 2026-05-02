"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  email: string;
  name?: string | null;
  picture?: string | null;
  size?: 32 | 40 | 80;
}

const sizeClasses: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  32: "h-8 w-8 ring-1",
  40: "h-10 w-10 ring-1",
  80: "h-20 w-20 ring-2 ring-offset-2",
};

const iconClasses: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  32: "h-4 w-4",
  40: "h-5 w-5",
  80: "h-8 w-8",
};

export function UserAvatar({ email, name, picture, size = 32 }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => {
    const candidate = picture?.trim();
    if (!candidate || failed) return null;
    return candidate;
  }, [picture, failed]);
  const label = name || email || "Signed-in user";
  const className = cn(
    sizeClasses[size],
    "shrink-0 rounded-full bg-surface-muted object-cover ring-brand-coral/20"
  );

  if (src) {
    return (
      <Image
        src={src}
        alt={label}
        width={size}
        height={size}
        unoptimized
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        className,
        "flex items-center justify-center bg-gradient-to-br from-brand-coral/20 to-brand-coral/5"
      )}
      aria-label={label}
      role="img"
    >
      <User className={cn(iconClasses[size], "text-brand-coral/65")} />
    </div>
  );
}
