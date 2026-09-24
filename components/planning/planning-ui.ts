// Gedeelde stijl-constante voor native `<select>`-velden binnen de
// Planning-sectie — zelfde look als Input (components/ui/input.tsx), er is
// geen shadcn Select-component in deze codebase; de rest van de app gebruikt
// hiervoor consistent een gestyled native `<select>` (zie SELECT_FIELD_CLASS
// in components/activity-wizard-page.tsx, hier hergebruikt als losse export
// zodat de planning-componenten er niet van hoeven te importeren).
export const SELECT_FIELD_CLASS =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";
