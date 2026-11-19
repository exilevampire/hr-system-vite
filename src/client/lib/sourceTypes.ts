export const SOURCE_TYPE_OPTIONS = [
  { value: 1, label: "1 - สำนักงานบริหารทรัพยากรบุคคล (สบค.)" },
  { value: 2, label: "2 - ศูนย์บริการโลหิตแห่งชาติ (ศล.)" },
  { value: 3, label: "3 - โรงพยาบาลจุฬาลงกรณ์ สภากาชาดไทย" },
] as const;

export const SOURCE_TYPE_SHORT_NAMES: Record<number, string> = {
  1: "สบค.",
  2: "ศล.",
  3: "รพ.จุฬาลงกรณ์",
};

export const SOURCE_TYPE_FULL_NAMES: Record<number, string> = {
  1: "สำนักงานบริหารทรัพยากรบุคคล (สบค.)",
  2: "ศูนย์บริการโลหิตแห่งชาติ (ศล.)",
  3: "โรงพยาบาลจุฬาลงกรณ์ สภากาชาดไทย",
};
