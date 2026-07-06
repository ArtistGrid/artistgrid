import { useState } from "react";
import { Layers, Plus, Pencil, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { addCustomView, deleteCustomView, type CustomView } from "@/src/lib/custom-views";

interface CustomViewManagerProps {
  trackerId: string;
  customViews: CustomView[];
  setCustomViews: (views: CustomView[]) => void;
  activeCustomView: CustomView | null;
  setActiveCustomView: (view: CustomView | null) => void;
  onSelect: (view: CustomView) => void;
  tabsList: string[];
  tabSlugs: Record<string, string>;
}

export function CustomViewManager({
  trackerId,
  customViews,
  setCustomViews,
  activeCustomView,
  setActiveCustomView,
  onSelect,
  tabsList,
  tabSlugs,
}: CustomViewManagerProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingView, setEditingView] = useState<CustomView | null>(null);
  const [viewName, setViewName] = useState("");
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);

  const allTabs = Object.keys(tabSlugs);

  const openCreate = () => {
    setEditingView(null);
    setViewName("");
    setSelectedTabs([]);
    setEditorOpen(true);
  };

  const openEdit = (view: CustomView) => {
    setEditingView(view);
    setViewName(view.name);
    setSelectedTabs([...view.tabs]);
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!viewName.trim() || selectedTabs.length === 0) return;
    if (editingView) {
      const updated = customViews.map((v) =>
        v.id === editingView.id ? { ...v, name: viewName.trim(), tabs: selectedTabs } : v
      );
      setCustomViews(updated);
      try {
        localStorage.setItem(`artistgrid-custom-views_${trackerId}`, JSON.stringify(updated));
      } catch {}
      if (activeCustomView?.id === editingView.id) {
        onSelect({ ...editingView, name: viewName.trim(), tabs: selectedTabs });
      }
    } else {
      const newView = addCustomView(trackerId, { name: viewName.trim(), tabs: selectedTabs });
      setCustomViews([...customViews, newView]);
    }
    setEditorOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteCustomView(trackerId, id);
    setCustomViews(customViews.filter((v) => v.id !== id));
    if (activeCustomView?.id === id) {
      setActiveCustomView(null);
    }
  };

  const toggleTab = (tab: string) => {
    setSelectedTabs((prev) =>
      prev.includes(tab) ? prev.filter((t) => t !== tab) : [...prev, tab]
    );
  };

  if (editorOpen) {
    return (
      <div className="glass rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{editingView ? "Edit Custom View" : "New Custom View"}</h3>
          <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)} className="text-white/40 hover:text-white h-7 w-7 p-0">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        <Input
          placeholder="View name..."
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          className="glass-flat rounded-xl text-white border-0 focus-visible:ring-1 focus-visible:ring-white/30"
        />
        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Tabs to combine</p>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {allTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => toggleTab(tab)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                  selectedTabs.includes(tab)
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:bg-white/[0.05] hover:text-white/70"
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  selectedTabs.includes(tab) ? "bg-white border-white" : "border-white/20"
                }`}>
                  {selectedTabs.includes(tab) && <Check className="w-3 h-3 text-black" />}
                </div>
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)} className="text-white/40 hover:text-white">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!viewName.trim() || selectedTabs.length === 0}
            className="bg-white text-black hover:bg-neutral-200"
          >
            {editingView ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    );
  }

  if (customViews.length === 0) {
    return (
      <div className="text-center py-12 sm:py-20 flex flex-col items-center">
        <Layers className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-700 mb-3 sm:mb-4" />
        <h3 className="text-base sm:text-lg font-medium text-neutral-300">No Custom Views</h3>
        <p className="text-sm sm:text-base text-neutral-500 mt-1 mb-4">
          Combine multiple tabs into a single view
        </p>
        <Button variant="ghost" size="sm" onClick={openCreate} className="text-white/50 hover:text-white">
          <Plus className="w-4 h-4 mr-1.5" />
          Create Custom View
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        {activeCustomView ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/60 font-medium">{activeCustomView.name}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white/30 hover:text-white h-7 px-2">
                  <Pencil className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 glass-elevated border-0 rounded-2xl text-white/80 p-1">
                {customViews.map((v) => (
                  <DropdownMenuItem
                    key={v.id}
                    onClick={() => onSelect(v)}
                    className="rounded-xl flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {v.id === activeCustomView.id && <Check className="w-3 h-3" />}
                      {v.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 hover:text-white"
                        onClick={(e) => { e.stopPropagation(); openEdit(v); }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 hover:text-red-400"
                        onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                <DropdownMenuItem onClick={openCreate} className="rounded-xl">
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  New Custom View
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white/40 hover:text-white">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Select a Custom View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 glass-elevated border-0 rounded-2xl text-white/80 p-1">
                {customViews.map((v) => (
                  <DropdownMenuItem key={v.id} onClick={() => onSelect(v)} className="rounded-xl">
                    {v.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                <DropdownMenuItem onClick={openCreate} className="rounded-xl">
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  New Custom View
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {!activeCustomView && (
        <div className="text-center py-8 flex flex-col items-center">
          <p className="text-sm text-neutral-500">Select a custom view above to load its combined data</p>
        </div>
      )}
    </>
  );
}
