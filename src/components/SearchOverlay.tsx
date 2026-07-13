import { Search, MapPin, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CategoryFilter = string;

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  searchMode: "salon" | "location";
  setSearchMode: (mode: "salon" | "location") => void;
  query: string;
  setQuery: (query: string) => void;
  categoryFilter: CategoryFilter;
  setCategoryFilter: (category: CategoryFilter) => void;
  /** Whether the admin has enabled the categories feature globally */
  categoriesEnabled?: boolean;
  /** Dynamic category names loaded from the database */
  dbCategories?: string[];
}

// No hardcoded fallback — if DB has no active categories, show nothing.
const DEFAULT_CATEGORIES: string[] = [];

const SearchOverlay = ({
  isOpen,
  onClose,
  searchMode,
  setSearchMode,
  query,
  setQuery,
  categoryFilter,
  setCategoryFilter,
  categoriesEnabled = false,
  dbCategories = DEFAULT_CATEGORIES,
}: SearchOverlayProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed left-0 top-0 z-50 flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col border-none bg-background/95 p-0 backdrop-blur-3xl transition-all duration-500 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2.5rem] sm:border sm:border-border/50 sm:shadow-2xl sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95">
        <DialogHeader className="px-6 pt-8 pb-4 sm:px-8 sm:pt-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-3xl font-black tracking-tight text-foreground">
              Search
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-24 sm:px-8 sm:pb-12">
          {/* Search Mode Tabs */}
          <div className="mb-8 flex overflow-hidden rounded-2xl border border-border/50 bg-muted/30 p-1.5 backdrop-blur-md">
            {(["salon", "location"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setSearchMode(mode);
                  setQuery("");
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold capitalize transition-all duration-300 ${
                  searchMode === mode
                    ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-[1.02]"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                {mode === "salon" ? (
                  <>
                    <Search className={`h-4 w-4 transition-transform ${searchMode === "salon" ? "scale-110" : "scale-100"}`} />
                    <span>Salon</span>
                  </>
                ) : (
                  <>
                    <MapPin className={`h-4 w-4 transition-transform ${searchMode === "location" ? "scale-110" : "scale-100"}`} />
                    <span>Location</span>
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="group relative">
            <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/40 px-6 py-5 transition-all duration-300 focus-within:border-primary/50 focus-within:bg-card focus-within:ring-8 focus-within:ring-primary/5">
              {searchMode === "salon" ? (
                <Search className="h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              ) : (
                <MapPin className="h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              )}
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  searchMode === "salon"
                    ? "Search for salons, stylists..."
                    : "Find salons near you..."
                }
                className="flex-1 bg-transparent text-lg font-medium text-foreground outline-none placeholder:text-muted-foreground/40"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="rounded-full bg-muted/80 p-1.5 text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <p className="mt-4 flex items-center gap-2 px-2 text-[11px] font-medium text-muted-foreground/50">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse" />
            {searchMode === "salon" 
              ? "Tip: Try 'Grooming Bar' or 'Luxe Signature'"
              : "Tip: Try 'Indiranagar' or 'Whitefield'"}
          </p>

          {/* Category Filter — hidden when admin disables the feature */}
          {categoriesEnabled && (
            <div className="mt-10">
              <div className="mb-5 flex items-center justify-between px-1">
                <h4 className="text-sm font-bold tracking-tight text-foreground/80 lowercase italic opacity-70">
                  #choose category
                </h4>
                <span className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-border/50 to-transparent" />
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-3">
                {["All", ...dbCategories].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`relative flex-none rounded-2xl px-6 py-2.5 text-xs font-bold transition-all duration-300 active:scale-95 ${
                      categoryFilter === cat
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "border border-border/40 bg-card/30 text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-card/50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto pt-8 sm:mt-12">
            <button
              onClick={onClose}
              className="group relative w-full overflow-hidden rounded-2xl bg-foreground py-4 text-sm font-black uppercase tracking-widest text-background transition-all hover:bg-foreground/90 active:scale-[0.98] sm:py-5"
            >
              <span className="relative z-10">Show Results</span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-background/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchOverlay;
