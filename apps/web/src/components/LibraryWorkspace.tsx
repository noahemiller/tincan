import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Heart,
  MoreHorizontal,
  ImageIcon,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type LibraryItem = {
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

export type LibraryWorkspaceProps = {
  filteredLibraryItems: LibraryItem[];
  dragOverLibraryItemId: string | null;
  canReorderCollection: boolean;
  onLibraryItemDragStart: (e: React.DragEvent, id: string) => void;
  onLibraryItemDragOver: (e: React.DragEvent, id: string) => void;
  onLibraryItemDragEnd: () => void;
  onLibraryItemDrop: (e: React.DragEvent, id: string) => Promise<void>;
  getLibraryThumbnail: (item: LibraryItem) => string | null;
  decodeHtmlEntities: (v?: string | null) => string;
  busy: boolean;
};

export function LibraryWorkspace({
  filteredLibraryItems,
  dragOverLibraryItemId,
  canReorderCollection,
  onLibraryItemDragStart,
  onLibraryItemDragOver,
  onLibraryItemDragEnd,
  onLibraryItemDrop,
  getLibraryThumbnail,
  decodeHtmlEntities,
}: LibraryWorkspaceProps) {
  const [columnCount, setColumnCount] = useState(4);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxItemId, setLightboxItemId] = useState<string | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lastClickedIdRef = useRef<string | null>(null);

  const lightboxItem = filteredLibraryItems.find((i) => i.id === lightboxItemId) ?? null;
  const lightboxIndex = filteredLibraryItems.findIndex((i) => i.id === lightboxItemId);

  const goNext = () => {
    const next = filteredLibraryItems[lightboxIndex + 1];
    if (next) setLightboxItemId(next.id);
  };
  const goPrev = () => {
    const prev = filteredLibraryItems[lightboxIndex - 1];
    if (prev) setLightboxItemId(prev.id);
  };

  useEffect(() => {
    if (!lightboxItemId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxItemId, lightboxIndex]);

  const handleTileClick = (item: LibraryItem, e: React.MouseEvent) => {
    if (selectedItemId === item.id) {
      setLightboxItemId(item.id);
      return;
    }
    if (e.shiftKey && lastClickedIdRef.current) {
      const currentIdx = filteredLibraryItems.findIndex((i) => i.id === item.id);
      const lastIdx = filteredLibraryItems.findIndex((i) => i.id === lastClickedIdRef.current);
      const start = Math.min(currentIdx, lastIdx);
      const end = Math.max(currentIdx, lastIdx);
      const rangeIds = new Set(filteredLibraryItems.slice(start, end + 1).map((i) => i.id));
      setMultiSelectedIds(rangeIds);
    } else {
      setMultiSelectedIds(new Set());
    }
    setSelectedItemId(item.id);
    lastClickedIdRef.current = item.id;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Library</h2>
          <span className="text-xs text-muted-foreground">{filteredLibraryItems.length} items</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={1}
              max={6}
              value={columnCount}
              onChange={(e) => setColumnCount(Number(e.target.value))}
              className="w-24 accent-foreground"
            />
            <span className="text-[11px] text-muted-foreground w-3 text-center">{columnCount}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {canReorderCollection && (
          <p className="text-xs text-muted-foreground px-3 pt-2">Drag cards to reorder this collection.</p>
        )}

        {filteredLibraryItems.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-3">No library items match this view.</p>
        ) : (
          <div
            className="grid gap-1 p-3"
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          >
            {filteredLibraryItems.slice(0, 100).map((item) => {
              const thumbnail = getLibraryThumbnail(item);
              const selected = item.id === selectedItemId || multiSelectedIds.has(item.id);
              const favorited = favoritedIds.has(item.id);
              return (
                <LibraryTile
                  key={item.id}
                  item={item}
                  selected={selected}
                  favorited={favorited}
                  thumbnail={thumbnail}
                  decodeHtmlEntities={decodeHtmlEntities}
                  draggable={canReorderCollection}
                  dragOver={dragOverLibraryItemId === item.id}
                  onDragStart={(e) => onLibraryItemDragStart(e, item.id)}
                  onDragOver={(e) => onLibraryItemDragOver(e, item.id)}
                  onDragEnd={onLibraryItemDragEnd}
                  onDrop={(e) => void onLibraryItemDrop(e, item.id)}
                  onToggleFavorite={() =>
                    setFavoritedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
                  onClick={(e) => handleTileClick(item, e)}
                />
              );
            })}
          </div>
        )}

        {filteredLibraryItems.length > 100 && (
          <p className="text-xs text-muted-foreground px-3 pb-3">
            Showing first 100 items. Narrow filters to see more.
          </p>
        )}
      </div>

      {/* Lightbox */}
      <Dialog
        open={!!lightboxItemId}
        onOpenChange={(open) => {
          if (!open) {
            setLightboxItemId(null);
            setDetailsOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-none w-screen h-screen p-0 border-0 bg-black/95 flex flex-col">
          {/* Minimal header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <p className="text-sm text-white/80 truncate max-w-md">
              {decodeHtmlEntities(
                lightboxItem?.title || lightboxItem?.preview_title || lightboxItem?.url || 'Untitled'
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setDetailsOpen((v) => !v)}
              >
                Details
              </Button>
            </div>
          </div>

          {/* Stage */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden">
            {/* Prev */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-3 z-10 h-10 w-10 rounded-full bg-black/40 hover:bg-black/70 text-white border-0"
              onClick={goPrev}
              disabled={lightboxIndex <= 0}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            {/* Image */}
            {lightboxItem && getLibraryThumbnail(lightboxItem) && (
              <img
                src={getLibraryThumbnail(lightboxItem)!}
                alt={decodeHtmlEntities(lightboxItem.title || '')}
                className="max-h-full max-w-full object-contain"
              />
            )}

            {/* Next */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 z-10 h-10 w-10 rounded-full bg-black/40 hover:bg-black/70 text-white border-0"
              onClick={goNext}
              disabled={lightboxIndex >= filteredLibraryItems.length - 1}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>

            {/* Details panel */}
            {detailsOpen && lightboxItem && (
              <div className="absolute right-0 top-0 bottom-0 w-72 bg-black/80 backdrop-blur-sm p-4 flex flex-col gap-3 overflow-y-auto border-l border-white/10">
                <h3 className="text-sm font-semibold text-white">Details</h3>
                <div className="flex flex-col gap-2 text-xs text-white/70">
                  {lightboxItem.title && (
                    <div>
                      <span className="text-white/40 block mb-0.5">Title</span>
                      {decodeHtmlEntities(lightboxItem.title)}
                    </div>
                  )}
                  {lightboxItem.description && (
                    <div>
                      <span className="text-white/40 block mb-0.5">Description</span>
                      {decodeHtmlEntities(lightboxItem.description)}
                    </div>
                  )}
                  {lightboxItem.url && (
                    <div>
                      <span className="text-white/40 block mb-0.5">URL</span>
                      <a
                        href={lightboxItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 underline break-all"
                      >
                        {lightboxItem.url}
                      </a>
                    </div>
                  )}
                  {lightboxItem.posted_by_handle && (
                    <div>
                      <span className="text-white/40 block mb-0.5">Posted by</span>
                      @{lightboxItem.posted_by_handle}
                    </div>
                  )}
                  {lightboxItem.post_time && (
                    <div>
                      <span className="text-white/40 block mb-0.5">Date</span>
                      {new Date(lightboxItem.post_time).toLocaleDateString()}
                    </div>
                  )}
                  {lightboxItem.channel_name && (
                    <div>
                      <span className="text-white/40 block mb-0.5">Channel</span>
                      #{lightboxItem.channel_name}
                    </div>
                  )}
                  {(lightboxItem.taxonomy_terms ?? []).length > 0 && (
                    <div>
                      <span className="text-white/40 block mb-1">Tags</span>
                      <div className="flex flex-wrap gap-1">
                        {(lightboxItem.taxonomy_terms ?? []).map((term) => (
                          <span
                            key={term}
                            className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 text-[10px]"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Index indicator */}
          <div className="shrink-0 py-2 text-center text-xs text-white/40">
            {lightboxIndex + 1} / {filteredLibraryItems.length}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type LibraryTileProps = {
  item: LibraryItem;
  selected: boolean;
  favorited: boolean;
  thumbnail: string | null;
  decodeHtmlEntities: (v?: string | null) => string;
  draggable?: boolean;
  dragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onToggleFavorite: () => void;
  onClick: (e: React.MouseEvent) => void;
};

function LibraryTile({
  item,
  selected,
  favorited,
  thumbnail,
  decodeHtmlEntities,
  draggable,
  dragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onToggleFavorite,
  onClick,
}: LibraryTileProps) {
  return (
    <div
      className={cn(
        'relative aspect-square overflow-hidden rounded-md cursor-pointer group',
        'bg-muted border border-transparent transition-all duration-150',
        selected && 'ring-2 ring-blue-500 ring-offset-1',
        dragOver && 'border-destructive bg-destructive/5'
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      onClick={onClick}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={decodeHtmlEntities(item.title || item.preview_title || '')}
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-150" />

      {/* Heart + Menu */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Toggle
          pressed={favorited}
          onPressedChange={onToggleFavorite}
          onClick={(e) => e.stopPropagation()}
          size="sm"
          className="h-7 w-7 p-0 bg-black/40 hover:bg-black/60 border-0 rounded-full data-[state=on]:bg-black/40"
          aria-label="Favorite"
        >
          <Heart
            className={cn('w-3.5 h-3.5', favorited ? 'fill-red-500 text-red-500' : 'text-white')}
          />
        </Toggle>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-7 w-7 p-0 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center">
              <MoreHorizontal className="w-3.5 h-3.5 text-white" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem>View details</DropdownMenuItem>
            <DropdownMenuItem>Edit metadata</DropdownMenuItem>
            <DropdownMenuItem>Add to collection</DropdownMenuItem>
            <DropdownMenuItem>Copy link</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title on hover */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <p className="text-[11px] text-white font-medium truncate leading-tight">
          {decodeHtmlEntities(item.title || item.preview_title || item.url || 'Untitled')}
        </p>
      </div>
    </div>
  );
}
