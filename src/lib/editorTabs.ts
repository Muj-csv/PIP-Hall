// My Card's tabs (V2-21, D-134): which tab holds a field, and how many fields in each need a look.

export const EDITOR_TABS = ['info', 'projects', 'customize', 'account'] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

export const TAB_LABEL: Record<EditorTab, string> = { info: 'Info', projects: 'Projects', customize: 'Customize', account: 'Account' };

/** The tab a field lives in: the Quest Log's fields in Projects, everything you say about yourself in Info. */
export function tabOfField(field: string): EditorTab {
  return field === 'repos' || field === 'projects' || field.startsWith('projects.') ? 'projects' : 'info';
}

/** How many fields need attention in each tab (Customize and Account have none to check). */
export function errorsByTab(errors: Record<string, string>): Record<EditorTab, number> {
  const counts: Record<EditorTab, number> = { info: 0, projects: 0, customize: 0, account: 0 };
  for (const key of Object.keys(errors)) counts[tabOfField(key)] += 1;
  return counts;
}

/** The tab named in the address (?tab=), or Info. */
export function tabFrom(value: string | null): EditorTab {
  return (EDITOR_TABS as readonly string[]).includes(value ?? '') ? (value as EditorTab) : 'info';
}
