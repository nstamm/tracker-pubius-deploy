import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Parsea una fecha en formato YYYY-MM-DD sin conversión de timezone
export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Formatea una fecha local para mostrar
export const formatLocalDate = (dateString: string, options?: Intl.DateTimeFormatOptions): string => {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('es-ES', options || { day: '2-digit', month: '2-digit', year: 'numeric' });
};
