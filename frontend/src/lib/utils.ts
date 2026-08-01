import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function nextDrawName(proximoConcurso: number | null): string | null {
  return proximoConcurso ? `Concurso ${proximoConcurso}` : null;
}
