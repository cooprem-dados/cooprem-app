export function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;

  // Firestore Timestamp has .toDate()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybe: any = value as any;
  if (maybe?.toDate) return maybe.toDate();

  // Last resort: Date constructor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Date(value as any);
}
