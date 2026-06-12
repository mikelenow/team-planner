import { format, parseISO } from 'date-fns';

export function formatDate(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function formatDateDisplay(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy');
}

export function formatDateShort(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd.MM');
}

export function getUtilizationColor(percentage) {
  if (percentage === 0) return 'bg-gray-100 text-gray-500';
  if (percentage <= 50) return 'bg-blue-100 text-blue-800';
  if (percentage <= 80) return 'bg-green-100 text-green-800';
  if (percentage <= 100) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800'; // overallocated
}

export function getUtilizationBgColor(percentage) {
  if (percentage === 0) return '#f3f4f6';
  if (percentage <= 50) return '#dbeafe';
  if (percentage <= 80) return '#d1fae5';
  if (percentage <= 100) return '#fef3c7';
  return '#fee2e2'; // overallocated
}
