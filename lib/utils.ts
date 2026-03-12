import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export function parseBrazilianNumber(val: string | number): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  
  const str = String(val).trim();
  
  // Se contiver vírgula, tratamos como formato brasileiro (1.234,56)
  if (str.includes(',')) {
    const cleaned = str.replace(/\./g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  }
  
  // Se não tiver vírgula mas tiver ponto, pode ser formato internacional ou apenas um número limpo
  return parseFloat(str) || 0;
}

export function parseBrazilianDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  
  const str = String(val).trim();
  
  // Formato DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000; // Ajuste para anos com 2 dígitos
    
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Fallback para Date nativo (ISO, etc)
  const nativeDate = new Date(str);
  return isNaN(nativeDate.getTime()) ? null : nativeDate;
}
