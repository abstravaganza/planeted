import { meaningfulDetail, normalizeRussian } from "./ru";
export interface LanguageProfile {
  code: string;
  normalize: (text: string) => string;
  hasDetail: (text: string) => boolean;
}
const profiles: Record<string, LanguageProfile> = {
  ru: { code: "ru", normalize: normalizeRussian, hasDetail: meaningfulDetail },
};
export function getLanguageProfile(code: string): LanguageProfile {
  const profile = profiles[code];
  if (!profile) throw new Error(`No learning profile registered for ${code}`);
  return profile;
}
