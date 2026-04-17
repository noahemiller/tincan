import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LibraryWorkspace,
  type LibraryWorkspaceProps,
  type LibraryItem,
} from '@/components/LibraryWorkspace';

type Collection = {
  id: string;
  name: string;
  visibility: 'private' | 'public';
};

type PosterFacet = { id: string; label: string };

export type LibraryLayoutProps = LibraryWorkspaceProps & {
  selectedServerName?: string;
  selectedChannelName?: string;
  /* removed from LibraryWorkspaceProps — kept here for App.tsx compat, not forwarded to workspace */
  selectedLibraryItemIds: string[];
  setSelectedLibraryItemIds: React.Dispatch<React.SetStateAction<string[]>>;
  editingLibraryItem: LibraryItem | null;
  metadataTitleDraft: string;
  setMetadataTitleDraft: (v: string) => void;
  metadataDescriptionDraft: string;
  setMetadataDescriptionDraft: (v: string) => void;
  metadataTermsDraft: string;
  setMetadataTermsDraft: (v: string) => void;
  guessTaxonomySuggestions: (item: LibraryItem) => string[];
  onApplySuggestedTerm: (term: string) => void;
  onSaveLibraryMetadata: () => Promise<void>;
  onSetMetadataDraft: (item: LibraryItem) => void;
  setEditingLibraryItem: (item: LibraryItem | null) => void;
  /* collection management */
  collections: Collection[];
  collectionName: string;
  setCollectionName: (v: string) => void;
  collectionVisibility: 'private' | 'public';
  setCollectionVisibility: (v: 'private' | 'public') => void;
  onCreateCollection: (e: FormEvent<HTMLFormElement>) => void;
  selectedCollectionId: string;
  setSelectedCollectionId: (v: string) => void;
  selectedCollection: Collection | null;
  onAddSelectedToCollection: () => Promise<void>;
  onAddFilteredToCollection: () => Promise<void>;
  onRemoveSelectedFromCollection: () => Promise<void>;
  onSelectAllFilteredLibraryItems: () => void;
  onClearLibrarySelection: () => void;
  /* filters */
  libraryScope: 'all' | 'collection';
  setLibraryScope: (v: 'all' | 'collection') => void;
  libraryQuery: string;
  setLibraryQuery: (v: string) => void;
  libraryPosterFilter: string;
  setLibraryPosterFilter: (v: string) => void;
  libraryTypeFilter: 'all' | 'url' | 'media';
  setLibraryTypeFilter: (v: 'all' | 'url' | 'media') => void;
  libraryTaxonomyFilter: string;
  setLibraryTaxonomyFilter: (v: string) => void;
  libraryDateFrom: string;
  setLibraryDateFrom: (v: string) => void;
  libraryDateTo: string;
  setLibraryDateTo: (v: string) => void;
  librarySort: 'newest' | 'oldest' | 'title' | 'manual';
  setLibrarySort: (v: 'newest' | 'oldest' | 'title' | 'manual') => void;
  availablePosterFacets: PosterFacet[];
  availableTaxonomyFacets: string[];
  visibleTaxonomySuggestions: string[];
  taxonomyQuickInput: string;
  setTaxonomyQuickInput: (v: string) => void;
  onTaxonomySuggestionClick: (term: string) => void;
  onApplyTaxonomyTerm: () => Promise<void>;
  onApplyTaxonomyTermToFiltered: () => Promise<void>;
  onUseTaxonomyTermAsFilter: () => void;
};

const navItemCls =
  'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full text-left';
const navItemActiveCls = 'bg-accent text-foreground font-medium';

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <CollapsibleTrigger className="group flex items-center justify-between w-full px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
      {children}
      <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
}

type AsideProps = {
  filteredLibraryItems: { id: string }[];
  selectedLibraryItemIds: string[];
  /* collections */
  collections: Collection[];
  collectionName: string;
  setCollectionName: (v: string) => void;
  collectionVisibility: 'private' | 'public';
  setCollectionVisibility: (v: 'private' | 'public') => void;
  onCreateCollection: (e: FormEvent<HTMLFormElement>) => void;
  selectedCollectionId: string;
  setSelectedCollectionId: (v: string) => void;
  selectedCollection: Collection | null;
  onAddSelectedToCollection: () => Promise<void>;
  onAddFilteredToCollection: () => Promise<void>;
  onRemoveSelectedFromCollection: () => Promise<void>;
  onSelectAllFilteredLibraryItems: () => void;
  onClearLibrarySelection: () => void;
  /* filters */
  libraryScope: 'all' | 'collection';
  setLibraryScope: (v: 'all' | 'collection') => void;
  libraryQuery: string;
  setLibraryQuery: (v: string) => void;
  libraryPosterFilter: string;
  setLibraryPosterFilter: (v: string) => void;
  libraryTypeFilter: 'all' | 'url' | 'media';
  setLibraryTypeFilter: (v: 'all' | 'url' | 'media') => void;
  libraryTaxonomyFilter: string;
  setLibraryTaxonomyFilter: (v: string) => void;
  libraryDateFrom: string;
  setLibraryDateFrom: (v: string) => void;
  libraryDateTo: string;
  setLibraryDateTo: (v: string) => void;
  librarySort: 'newest' | 'oldest' | 'title' | 'manual';
  setLibrarySort: (v: 'newest' | 'oldest' | 'title' | 'manual') => void;
  availablePosterFacets: PosterFacet[];
  availableTaxonomyFacets: string[];
  visibleTaxonomySuggestions: string[];
  taxonomyQuickInput: string;
  setTaxonomyQuickInput: (v: string) => void;
  onTaxonomySuggestionClick: (term: string) => void;
  onApplyTaxonomyTerm: () => Promise<void>;
  onApplyTaxonomyTermToFiltered: () => Promise<void>;
  onUseTaxonomyTermAsFilter: () => void;
};

function LibraryAside({
  filteredLibraryItems,
  selectedLibraryItemIds,
  collections,
  collectionName,
  setCollectionName,
  collectionVisibility,
  setCollectionVisibility,
  onCreateCollection,
  selectedCollectionId,
  setSelectedCollectionId,
  selectedCollection,
  onAddSelectedToCollection,
  onAddFilteredToCollection,
  onRemoveSelectedFromCollection,
  onSelectAllFilteredLibraryItems,
  onClearLibrarySelection,
  libraryScope,
  setLibraryScope,
  libraryQuery,
  setLibraryQuery,
  libraryPosterFilter,
  setLibraryPosterFilter,
  libraryTypeFilter,
  setLibraryTypeFilter,
  libraryTaxonomyFilter,
  setLibraryTaxonomyFilter,
  libraryDateFrom,
  setLibraryDateFrom,
  libraryDateTo,
  setLibraryDateTo,
  librarySort,
  setLibrarySort,
  availablePosterFacets,
  availableTaxonomyFacets,
  visibleTaxonomySuggestions,
  taxonomyQuickInput,
  setTaxonomyQuickInput,
  onTaxonomySuggestionClick,
  onApplyTaxonomyTerm,
  onApplyTaxonomyTermToFiltered,
  onUseTaxonomyTermAsFilter,
}: AsideProps) {
  return (
    <>
      {/* VIEWS — plain nav, always visible */}
      <div className="flex flex-col gap-0.5 px-1 pt-2 pb-1">
        <span className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Views
        </span>
        <button className={cn(navItemCls, navItemActiveCls)}>All Items</button>
        <button className={navItemCls}>Media</button>
        <button className={navItemCls}>Music</button>
        <button className={navItemCls}>Links</button>
      </div>

      <Separator />

      {/* COLLECTIONS */}
      <Collapsible defaultOpen>
        <SectionHeader>Collections</SectionHeader>
        <CollapsibleContent className="flex flex-col gap-2 px-2 pb-3">
          {/* Active collection picker */}
          <Select
            value={selectedCollectionId || '__none__'}
            onValueChange={(v) => setSelectedCollectionId(v === '__none__' ? '' : v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select collection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">All collections</SelectItem>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Scope toggle */}
          <Tabs
            value={libraryScope}
            onValueChange={(v) => setLibraryScope(v as 'all' | 'collection')}
          >
            <TabsList className="h-7 w-full">
              <TabsTrigger value="all" className="flex-1 text-xs">Browse</TabsTrigger>
              <TabsTrigger
                value="collection"
                disabled={!selectedCollectionId}
                className="flex-1 text-xs"
              >
                Collection
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Scope-dependent actions */}
          {libraryScope === 'collection' ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full h-7 text-xs"
              onClick={() => void onRemoveSelectedFromCollection()}
              disabled={!selectedCollectionId || selectedLibraryItemIds.length === 0}
            >
              Remove selected ({selectedLibraryItemIds.length})
            </Button>
          ) : (
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => void onAddSelectedToCollection()}
                disabled={!selectedCollectionId || selectedLibraryItemIds.length === 0}
              >
                Add selected ({selectedLibraryItemIds.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full h-7 text-xs"
                onClick={() => void onAddFilteredToCollection()}
                disabled={!selectedCollectionId || filteredLibraryItems.length === 0}
              >
                Add filtered ({Math.min(filteredLibraryItems.length, 100)})
              </Button>
            </div>
          )}

          {/* Context note */}
          <p className="text-[11px] text-muted-foreground leading-snug">
            {libraryScope === 'all'
              ? selectedCollection
                ? `Browse mode — add actions target "${selectedCollection.name}".`
                : 'Browse mode — select a collection to add items to.'
              : selectedCollection
                ? `Viewing "${selectedCollection.name}" (${selectedCollection.visibility})`
                : 'Pick a collection to curate items.'}
          </p>

          <Separator />

          {/* Collections nav list */}
          <div className="flex flex-col gap-0.5">
            {collections.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No collections yet.</p>
            ) : (
              collections.map((c) => (
                <button
                  key={c.id}
                  className={cn(navItemCls, selectedCollectionId === c.id && navItemActiveCls)}
                  onClick={() => setSelectedCollectionId(c.id)}
                >
                  {c.name}
                </button>
              ))
            )}
          </div>

          {/* Create collection form */}
          <form autoComplete="off" onSubmit={onCreateCollection} className="flex flex-col gap-1 pt-1">
            <Input
              placeholder="New collection name…"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="h-7 text-xs"
            />
            <div className="flex gap-1">
              <Select
                value={collectionVisibility}
                onValueChange={(v) => setCollectionVisibility(v as 'private' | 'public')}
              >
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" variant="secondary" className="h-7 px-2 text-xs shrink-0">
                Create
              </Button>
            </div>
          </form>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* FILTER */}
      <Collapsible defaultOpen>
        <SectionHeader>Filter</SectionHeader>
        <CollapsibleContent className="flex flex-col gap-2 px-2 pb-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search library…"
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              className="h-8 text-xs pl-7"
            />
          </div>

          {/* Poster */}
          <Select value={libraryPosterFilter} onValueChange={setLibraryPosterFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All posters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All posters</SelectItem>
              {availablePosterFacets.map((p) => (
                <SelectItem key={p.id} value={p.id}>@{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type */}
          <Select value={libraryTypeFilter} onValueChange={(v) => setLibraryTypeFilter(v as 'all' | 'url' | 'media')}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="url">Links</SelectItem>
              <SelectItem value="media">Media</SelectItem>
            </SelectContent>
          </Select>

          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">From</label>
            <input
              type="date"
              value={libraryDateFrom}
              onChange={(e) => setLibraryDateFrom(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">To</label>
            <input
              type="date"
              value={libraryDateTo}
              onChange={(e) => setLibraryDateTo(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* SORT */}
      <Collapsible defaultOpen>
        <SectionHeader>Sort</SectionHeader>
        <CollapsibleContent className="flex flex-col gap-2 px-2 pb-3">
          <Select value={librarySort} onValueChange={(v) => setLibrarySort(v as 'newest' | 'oldest' | 'title' | 'manual')}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest" disabled={libraryScope === 'collection'}>Newest first</SelectItem>
              <SelectItem value="oldest" disabled={libraryScope === 'collection'}>Oldest first</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
              <SelectItem value="manual" disabled={libraryScope !== 'collection'}>Manual order</SelectItem>
            </SelectContent>
          </Select>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* TAXONOMY */}
      <Collapsible defaultOpen={false}>
        <SectionHeader>Taxonomy</SectionHeader>
        <CollapsibleContent className="flex flex-col gap-2 px-2 pb-3">
          {/* Taxonomy filter */}
          <Select value={libraryTaxonomyFilter} onValueChange={setLibraryTaxonomyFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All taxonomy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All taxonomy</SelectItem>
              {availableTaxonomyFacets.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Quick-apply input */}
          <Input
            placeholder="Taxonomy term…"
            value={taxonomyQuickInput}
            list="library-taxonomy-terms"
            onChange={(e) => setTaxonomyQuickInput(e.target.value)}
            className="h-8 text-xs"
          />
          <datalist id="library-taxonomy-terms">
            {visibleTaxonomySuggestions.map((t) => <option key={t} value={t} />)}
            {availableTaxonomyFacets.map((t) => <option key={`facet-${t}`} value={t} />)}
          </datalist>

          {/* Apply actions */}
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full h-7 text-xs"
              onClick={() => void onApplyTaxonomyTerm()}
              disabled={!taxonomyQuickInput.trim() || selectedLibraryItemIds.length === 0}
            >
              Apply to selected ({selectedLibraryItemIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full h-7 text-xs"
              onClick={() => void onApplyTaxonomyTermToFiltered()}
              disabled={!taxonomyQuickInput.trim() || filteredLibraryItems.length === 0}
            >
              Apply to filtered ({Math.min(filteredLibraryItems.length, 100)})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs"
              onClick={onUseTaxonomyTermAsFilter}
              disabled={!taxonomyQuickInput.trim()}
            >
              Use as filter
            </Button>
          </div>

          {/* Suggested terms */}
          {visibleTaxonomySuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground w-full">Suggested:</span>
              {visibleTaxonomySuggestions.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onTaxonomySuggestionClick(term)}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground hover:bg-accent transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* SELECTION */}
      <Collapsible defaultOpen={false}>
        <SectionHeader>Selection</SectionHeader>
        <CollapsibleContent className="flex flex-col gap-2 px-2 pb-3">
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs justify-start"
              onClick={onSelectAllFilteredLibraryItems}
              disabled={filteredLibraryItems.length === 0}
            >
              Select filtered ({Math.min(filteredLibraryItems.length, 100)})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs justify-start"
              onClick={onClearLibrarySelection}
              disabled={selectedLibraryItemIds.length === 0}
            >
              Clear selection ({selectedLibraryItemIds.length})
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex-1" />
    </>
  );
}

export function LibraryLayout({
  selectedServerName,
  selectedChannelName,
  filteredLibraryItems,
  selectedLibraryItemIds,
  setSelectedLibraryItemIds: _setSelectedLibraryItemIds,
  editingLibraryItem: _editingLibraryItem,
  metadataTitleDraft: _metadataTitleDraft,
  setMetadataTitleDraft: _setMetadataTitleDraft,
  metadataDescriptionDraft: _metadataDescriptionDraft,
  setMetadataDescriptionDraft: _setMetadataDescriptionDraft,
  metadataTermsDraft: _metadataTermsDraft,
  setMetadataTermsDraft: _setMetadataTermsDraft,
  guessTaxonomySuggestions: _guessTaxonomySuggestions,
  onApplySuggestedTerm: _onApplySuggestedTerm,
  onSaveLibraryMetadata: _onSaveLibraryMetadata,
  onSetMetadataDraft: _onSetMetadataDraft,
  setEditingLibraryItem: _setEditingLibraryItem,
  collections,
  collectionName,
  setCollectionName,
  collectionVisibility,
  setCollectionVisibility,
  onCreateCollection,
  selectedCollectionId,
  setSelectedCollectionId,
  selectedCollection,
  onAddSelectedToCollection,
  onAddFilteredToCollection,
  onRemoveSelectedFromCollection,
  onSelectAllFilteredLibraryItems,
  onClearLibrarySelection,
  libraryScope,
  setLibraryScope,
  libraryQuery,
  setLibraryQuery,
  libraryPosterFilter,
  setLibraryPosterFilter,
  libraryTypeFilter,
  setLibraryTypeFilter,
  libraryTaxonomyFilter,
  setLibraryTaxonomyFilter,
  libraryDateFrom,
  setLibraryDateFrom,
  libraryDateTo,
  setLibraryDateTo,
  librarySort,
  setLibrarySort,
  availablePosterFacets,
  availableTaxonomyFacets,
  visibleTaxonomySuggestions,
  taxonomyQuickInput,
  setTaxonomyQuickInput,
  onTaxonomySuggestionClick,
  onApplyTaxonomyTerm,
  onApplyTaxonomyTermToFiltered,
  onUseTaxonomyTermAsFilter,
  ...workspaceProps
}: LibraryLayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="w-[240px] shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
        <LibraryAside
          filteredLibraryItems={filteredLibraryItems}
          selectedLibraryItemIds={selectedLibraryItemIds}
          collections={collections}
          collectionName={collectionName}
          setCollectionName={setCollectionName}
          collectionVisibility={collectionVisibility}
          setCollectionVisibility={setCollectionVisibility}
          onCreateCollection={onCreateCollection}
          selectedCollectionId={selectedCollectionId}
          setSelectedCollectionId={setSelectedCollectionId}
          selectedCollection={selectedCollection}
          onAddSelectedToCollection={onAddSelectedToCollection}
          onAddFilteredToCollection={onAddFilteredToCollection}
          onRemoveSelectedFromCollection={onRemoveSelectedFromCollection}
          onSelectAllFilteredLibraryItems={onSelectAllFilteredLibraryItems}
          onClearLibrarySelection={onClearLibrarySelection}
          libraryScope={libraryScope}
          setLibraryScope={setLibraryScope}
          libraryQuery={libraryQuery}
          setLibraryQuery={setLibraryQuery}
          libraryPosterFilter={libraryPosterFilter}
          setLibraryPosterFilter={setLibraryPosterFilter}
          libraryTypeFilter={libraryTypeFilter}
          setLibraryTypeFilter={setLibraryTypeFilter}
          libraryTaxonomyFilter={libraryTaxonomyFilter}
          setLibraryTaxonomyFilter={setLibraryTaxonomyFilter}
          libraryDateFrom={libraryDateFrom}
          setLibraryDateFrom={setLibraryDateFrom}
          libraryDateTo={libraryDateTo}
          setLibraryDateTo={setLibraryDateTo}
          librarySort={librarySort}
          setLibrarySort={setLibrarySort}
          availablePosterFacets={availablePosterFacets}
          availableTaxonomyFacets={availableTaxonomyFacets}
          visibleTaxonomySuggestions={visibleTaxonomySuggestions}
          taxonomyQuickInput={taxonomyQuickInput}
          setTaxonomyQuickInput={setTaxonomyQuickInput}
          onTaxonomySuggestionClick={onTaxonomySuggestionClick}
          onApplyTaxonomyTerm={onApplyTaxonomyTerm}
          onApplyTaxonomyTermToFiltered={onApplyTaxonomyTermToFiltered}
          onUseTaxonomyTermAsFilter={onUseTaxonomyTermAsFilter}
        />
      </aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <LibraryWorkspace
          filteredLibraryItems={filteredLibraryItems}
          {...workspaceProps}
        />
      </div>
    </div>
  );
}
