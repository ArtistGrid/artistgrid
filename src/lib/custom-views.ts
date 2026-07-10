export interface CustomView {
  id: string;
  name: string;
  tabs: string[];
}

const KEY_PREFIX = "artistgrid-custom-views_";

function getKey(trackerId: string): string {
  return `${KEY_PREFIX}${trackerId}`;
}

export function getCustomViews(trackerId: string): CustomView[] {
  try {
    const raw = localStorage.getItem(getKey(trackerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomViews(trackerId: string, views: CustomView[]): void {
  try {
    localStorage.setItem(getKey(trackerId), JSON.stringify(views));
  } catch {}
}

export function addCustomView(trackerId: string, view: Omit<CustomView, "id">): CustomView {
  const views = getCustomViews(trackerId);
  const newView: CustomView = { ...view, id: Date.now().toString(36) };
  views.push(newView);
  saveCustomViews(trackerId, views);
  return newView;
}

export function deleteCustomView(trackerId: string, id: string): void {
  const views = getCustomViews(trackerId).filter((v) => v.id !== id);
  saveCustomViews(trackerId, views);
}
