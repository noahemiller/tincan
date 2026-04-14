/**
 * LibraryWorkspace
 *
 * Extracted from the App.tsx `centerPane === 'library'` branch.
 *
 * Props mirror the state/handlers from App.tsx. Add this file to
 * src/components/LibraryWorkspace.tsx and import it in App.tsx.
 */

import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type LibraryItem = {
  id: string;
  item_type: 'url' | 'media';
  source_message_id?: string | null;
  post_time?: string;
  posted_by_handle?: string;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  taxonomy_terms?: string[];
  media_url?: string | null;
  preview_image_url?: string | null;
  preview_title?: string | null;
  preview_description?: string | null;
  channel_name?: string;
};

type Collection = {
  id: string;
  name: string;
  visibility: 'private' | 'public';
};

type PosterFacet = { id: string; label: string };

export type LibraryWorkspaceProps = {
  /* items */
  filteredLibraryItems: LibraryItem[];
  selectedLibraryItemIds: string[];
  setSelectedLibraryItemIds: React.Dispatch<React.SetStateAction<string[]>>;
  dragOverLibraryItemId: string | null;
  canReorderCollection: boolean;
  onLibraryItemDragStart: (e: React.DragEvent, id: string) => void;
  onLibraryItemDragOver: (e: React.DragEvent, id: string) => void;
  onLibraryItemDragEnd: () => void;
  onLibraryItemDrop: (e: React.DragEvent, id: string) => Promise<void>;
  onSelectAllFilteredLibraryItems: () => void;
  onClearLibrarySelection: () => void;
  getLibraryThumbnail: (item: LibraryItem) => string | null;
  decodeHtmlEntities: (v?: string | null) => string;
  /* metadata editor */
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
  busy: boolean;
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

const selectCls =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

export function LibraryWorkspace({
  filteredLibraryItems,
  selectedLibraryItemIds,
  setSelectedLibraryItemIds,
  dragOverLibraryItemId,
  canReorderCollection,
  onLibraryItemDragStart,
  onLibraryItemDragOver,
  onLibraryItemDragEnd,
  onLibraryItemDrop,
  onSelectAllFilteredLibraryItems,
  onClearLibrarySelection,
  getLibraryThumbnail,
  decodeHtmlEntities,
  editingLibraryItem,
  metadataTitleDraft,
  setMetadataTitleDraft,
  metadataDescriptionDraft,
  setMetadataDescriptionDraft,
  metadataTermsDraft,
  setMetadataTermsDraft,
  guessTaxonomySuggestions,
  onApplySuggestedTerm,
  onSaveLibraryMetadata,
  onSetMetadataDraft,
  setEditingLibraryItem,
  busy,
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
}: LibraryWorkspaceProps) {
  return (
    <div className="flex flex-col gap-4 px-4 py-3 overflow-y-auto flex-1 min-h-0">

      {/* ── Header + new collection form ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h3 className="text-sm font-semibold m-0">Library</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{filteredLibraryItems.length} item(s) in view</p>
        </div>
        <form autoComplete="off" onSubmit={onCreateCollection} className="flex gap-1.5 items-center ml-auto">
          <Input
            placeholder="New collection name"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            className="h-8 text-sm w-40"
          />
          <select
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={collectionVisibility}
            onChange={(e) => setCollectionVisibility(e.target.value as 'private' | 'public')}
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
          <Button type="submit" size="sm" variant="secondary">Create</Button>
        </form>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-muted/40">

        {/* Collection picker + scope toggle */}
        <div className="flex gap-1.5 items-center w-full">
          <select
            className={cn(selectCls, 'flex-1')}
            value={selectedCollectionId}
            onChange={(e) => setSelectedCollectionId(e.target.value)}
          >
            <option value="">Select collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.visibility})</option>
            ))}
          </select>
          <div className="flex gap-1 shrink-0">
            <Button
              type="button"
              size="sm"
              variant={libraryScope === 'all' ? 'default' : 'secondary'}
              onClick={() => setLibraryScope('all')}
            >
              Browse
            </Button>
            <Button
              type="button"
              size="sm"
              variant={libraryScope === 'collection' ? 'default' : 'secondary'}
              disabled={!selectedCollectionId}
              onClick={() => setLibraryScope('collection')}
            >
              Collection
            </Button>
          </div>
        </div>

        {/* Filters row */}
        <Input
          placeholder="Filter library…"
          value={libraryQuery}
          onChange={(e) => setLibraryQuery(e.target.value)}
          className="h-8 text-sm flex-1 min-w-[140px]"
        />
        <select className={cn(selectCls, 'flex-1 min-w-[120px]')} value={libraryPosterFilter} onChange={(e) => setLibraryPosterFilter(e.target.value)}>
          <option value="all">All posters</option>
          {availablePosterFacets.map((p) => <option key={p.id} value={p.id}>@{p.label}</option>)}
        </select>
        <select className={cn(selectCls, 'flex-1 min-w-[100px]')} value={libraryTypeFilter} onChange={(e) => setLibraryTypeFilter(e.target.value as 'all' | 'url' | 'media')}>
          <option value="all">All types</option>
          <option value="url">Links</option>
          <option value="media">Media</option>
        </select>
        <select className={cn(selectCls, 'flex-1 min-w-[120px]')} value={libraryTaxonomyFilter} onChange={(e) => setLibraryTaxonomyFilter(e.target.value)}>
          <option value="all">All taxonomy</option>
          {availableTaxonomyFacets.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Input type="date" className="flex-1 min-w-[130px]" value={libraryDateFrom} onChange={(e) => setLibraryDateFrom(e.target.value)} />
        <Input type="date" className="flex-1 min-w-[130px]" value={libraryDateTo} onChange={(e) => setLibraryDateTo(e.target.value)} />
        <select className={cn(selectCls, 'flex-1 min-w-[120px]')} value={librarySort} onChange={(e) => setLibrarySort(e.target.value as 'newest' | 'oldest' | 'title' | 'manual')}>
          <option value="newest" disabled={libraryScope === 'collection'}>Newest first</option>
          <option value="oldest" disabled={libraryScope === 'collection'}>Oldest first</option>
          <option value="title">Title A–Z</option>
          <option value="manual" disabled={libraryScope !== 'collection'}>Manual order</option>
        </select>

        {/* Taxonomy quick-apply */}
        <div className="flex gap-1.5 w-full items-center">
          <Input
            placeholder="Taxonomy term…"
            value={taxonomyQuickInput}
            list="library-taxonomy-terms"
            onChange={(e) => setTaxonomyQuickInput(e.target.value)}
            className="h-8 text-sm flex-1"
          />
          <datalist id="library-taxonomy-terms">
            {visibleTaxonomySuggestions.map((t) => <option key={t} value={t} />)}
            {availableTaxonomyFacets.map((t) => <option key={`facet-${t}`} value={t} />)}
          </datalist>
          <Button type="button" size="sm" variant="secondary" onClick={() => void onApplyTaxonomyTerm()} disabled={!taxonomyQuickInput.trim() || selectedLibraryItemIds.length === 0}>
            Apply to selected ({selectedLibraryItemIds.length})
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void onApplyTaxonomyTermToFiltered()} disabled={!taxonomyQuickInput.trim() || filteredLibraryItems.length === 0}>
            Apply to filtered ({Math.min(filteredLibraryItems.length, 100)})
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onUseTaxonomyTermAsFilter} disabled={!taxonomyQuickInput.trim()}>
            Use as filter
          </Button>
        </div>

        {/* Selection + collection actions */}
        <div className="flex flex-wrap gap-1.5 w-full">
          <Button type="button" size="sm" variant="ghost" onClick={onSelectAllFilteredLibraryItems} disabled={filteredLibraryItems.length === 0}>
            Select filtered
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClearLibrarySelection} disabled={selectedLibraryItemIds.length === 0}>
            Clear ({selectedLibraryItemIds.length})
          </Button>
          {libraryScope === 'all' ? (
            <>
              <Button type="button" size="sm" onClick={() => void onAddSelectedToCollection()} disabled={!selectedCollectionId || selectedLibraryItemIds.length === 0}>
                Add selected to collection
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void onAddFilteredToCollection()} disabled={!selectedCollectionId || filteredLibraryItems.length === 0}>
                Add filtered to collection
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="secondary" onClick={() => void onRemoveSelectedFromCollection()} disabled={!selectedCollectionId || selectedLibraryItemIds.length === 0}>
              Remove selected
            </Button>
          )}
        </div>
      </div>

      {/* ── Context note ── */}
      <p className="text-xs text-muted-foreground -mt-2">
        {libraryScope === 'all'
          ? selectedCollection
            ? `Browse mode — add actions target "${selectedCollection.name}".`
            : 'Browse mode — select a collection to add items to.'
          : selectedCollection
            ? `Collection: "${selectedCollection.name}" (${selectedCollection.visibility})`
            : 'Collection mode — pick a collection to view and curate.'}
      </p>

      {/* ── Taxonomy suggestions ── */}
      {visibleTaxonomySuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 -mt-2">
          <span className="text-[11px] font-semibold text-muted-foreground">Suggested:</span>
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

      {/* ── Card grid ── */}
      {canReorderCollection && (
        <p className="text-xs text-muted-foreground -mt-2">Drag cards to reorder this collection.</p>
      )}

      <div className="grid grid-cols-3 gap-2 items-start">
        {filteredLibraryItems.slice(0, 100).map((item) => {
          const thumbnail = getLibraryThumbnail(item);
          const selected = selectedLibraryItemIds.includes(item.id);
          const title = decodeHtmlEntities(item.title || item.preview_title || item.url || item.media_url || 'Untitled');
          const description = decodeHtmlEntities(item.description || item.preview_description);

          return (
            <article
              key={item.id}
              draggable={canReorderCollection}
              onDragStart={(e) => onLibraryItemDragStart(e, item.id)}
              onDragOver={(e) => onLibraryItemDragOver(e, item.id)}
              onDragEnd={onLibraryItemDragEnd}
              onDrop={(e) => void onLibraryItemDrop(e, item.id)}
              className={cn(
                'rounded-lg border bg-card p-2 flex flex-col gap-2 transition-colors',
                selected ? 'border-foreground ring-1 ring-foreground/20' : 'border-border',
                dragOverLibraryItemId === item.id && 'border-destructive bg-destructive/5'
              )}
            >
              {/* Card head */}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) =>
                      setSelectedLibraryItemIds((prev) =>
                        e.target.checked ? [...new Set([...prev, item.id])] : prev.filter((id) => id !== item.id)
                      )
                    }
                  />
                  {item.item_type === 'url' ? 'Link' : 'Media'}
                </label>
                <span className="text-[10px] text-muted-foreground truncate">
                  {item.channel_name ? `#${item.channel_name}` : 'Collection item'}
                </span>
              </div>

              {/* Thumbnail */}
              {thumbnail && (
                <a
                  href={item.url || item.media_url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  draggable={false}
                  className="block rounded border border-border overflow-hidden"
                >
                  <img src={thumbnail} alt={title} className="w-full h-14 object-cover block" />
                </a>
              )}

              {/* Copy */}
              <div className="flex flex-col gap-1 min-w-0">
                <strong className="text-xs font-semibold leading-snug line-clamp-2">{title}</strong>
                {description && (
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3 m-0">{description}</p>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {item.posted_by_handle ? `@${item.posted_by_handle}` : 'unknown'}
                  {item.post_time ? ` · ${new Date(item.post_time).toLocaleDateString()}` : ''}
                </span>
                {(item.taxonomy_terms ?? []).length > 0 && (
                  <span className="text-[10px] text-muted-foreground italic">
                    {(item.taxonomy_terms ?? []).slice(0, 4).join(' · ')}
                  </span>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-foreground underline underline-offset-2 overflow-wrap-anywhere hover:text-muted-foreground"
                  >
                    {item.url}
                  </a>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-muted-foreground justify-start mt-0.5"
                  onClick={() => onSetMetadataDraft(item)}
                >
                  Edit metadata
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredLibraryItems.length > 100 && (
        <p className="text-xs text-muted-foreground">Showing first 100 items. Narrow filters to see more.</p>
      )}
      {filteredLibraryItems.length === 0 && (
        <p className="text-xs text-muted-foreground">No library items match this view.</p>
      )}
      {libraryScope === 'collection' && !selectedCollectionId && (
        <p className="text-xs text-muted-foreground">Pick a collection to curate items.</p>
      )}

      {/* ── Metadata editor ── */}
      {editingLibraryItem && (
        <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2.5 mt-1">
          <div>
            <h4 className="text-sm font-semibold m-0">Librarian Metadata</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Suggestions shown below are unsaved until you save.</p>
          </div>
          <Input
            value={metadataTitleDraft}
            onChange={(e) => setMetadataTitleDraft(e.target.value)}
            placeholder="Title"
            className="text-sm"
          />
          <textarea
            value={metadataDescriptionDraft}
            onChange={(e) => setMetadataDescriptionDraft(e.target.value)}
            placeholder="Description"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical"
          />
          <Input
            value={metadataTermsDraft}
            onChange={(e) => setMetadataTermsDraft(e.target.value)}
            placeholder="Taxonomy terms (comma-separated)"
            className="text-sm"
          />
          {guessTaxonomySuggestions(editingLibraryItem).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {guessTaxonomySuggestions(editingLibraryItem).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onApplySuggestedTerm(term)}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground hover:bg-accent transition-colors"
                >
                  + {term}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void onSaveLibraryMetadata()} disabled={busy}>
              Save metadata
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingLibraryItem(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
