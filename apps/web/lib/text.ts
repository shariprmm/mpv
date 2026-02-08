export function capitalizeFirst(input: string) {
  const value = String(input || "");
  if (!value) return value;
  const first = value[0];
  const rest = value.slice(1);
  return `${first.toLocaleUpperCase()}${rest}`;
}
