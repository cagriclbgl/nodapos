import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind class name birleştirici. cva ile çakışmaları twMerge çözer.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
