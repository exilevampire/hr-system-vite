export const SOURCE_TYPE_FULL_NAMES: Record<number, string> = {
  1: "สำนักงานบริหารทรัพยากรบุคคล (สบค.)",
  2: "ศูนย์บริการโลหิตแห่งชาติ (ศล.)",
  3: "โรงพยาบาลจุฬาลงกรณ์ สภากาชาดไทย",
};

export const SUPPORTED_SOURCE_TYPES = new Set([1, 2, 3]);

export function isSupportedSourceType(sourceType: number): boolean {
  return SUPPORTED_SOURCE_TYPES.has(sourceType);
}

export function sourceTypeFullName(sourceType: number): string {
  return SOURCE_TYPE_FULL_NAMES[sourceType] ?? `ต้นทาง ${sourceType}`;
}
