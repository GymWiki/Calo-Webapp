// Laatst gebruikte maat per familie (alleen in deze browser). Zonder localStorage of bij een fout: de standaardmaat.

const KEY = "gymwiki.familie.maat.v1";

export function readLastMaten(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

export function rememberMaat(familyId: string, maatId: string): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...readLastMaten(), [familyId]: maatId }));
  } catch {
    // geen opslag: niet erg
  }
}
