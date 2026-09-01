export const normalizeContainerNumber = (value: string) =>
  value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export const normalizeContainerCode = normalizeContainerNumber;

export function isIso6346(value: string) {
  const normalized = normalizeContainerNumber(value);
  if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(normalized)) return false;

  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const character = normalized[index];
    const digit = Number(character);
    const base = character >= "A" && character <= "Z" ? character.charCodeAt(0) - 55 : digit;
    const numeric = Number.isNaN(digit) ? base + Math.floor((base - 1) / 10) : digit;
    sum += numeric * 2 ** index;
  }

  const remainder = sum % 11;
  return (remainder === 10 ? 0 : remainder) === Number(normalized[10]);
}

export const isValidIso6346 = isIso6346;
