import { useState, useRef, useMemo } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Heart,
  MoreHorizontal,
  ImageIcon,
  Plus,
  Minus,
  Image,
  Music,
  Video,
  Link,
  PanelLeft,
  LayoutGrid,
  List,
  ExternalLink,
  Snail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Lightbox } from "@/components/Lightbox";

const MUSIC_DOMAINS = [
  "music.apple.com",
  "open.spotify.com",
  "tidal.com",
  "soundcloud.com",
  "bandcamp.com",
];
const VIDEO_DOMAINS = ["youtube.com", "youtu.be", "vimeo.com", "twitch.tv"];

function isMusicUrl(url: string): boolean {
  try {
    return MUSIC_DOMAINS.some((d) => new URL(url).hostname.includes(d));
  } catch {
    return false;
  }
}

function isVideoUrl(url: string): boolean {
  try {
    return VIDEO_DOMAINS.some((d) => new URL(url).hostname.includes(d));
  } catch {
    return false;
  }
}

export type LibraryItem = {
  id: string;
  item_type: "url" | "media";
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

type PosterFacet = { id: string; label: string };

export type ViewFilter =
  | "all"
  | "media"
  | "music"
  | "video"
  | "links"
  | "hearted";

type SortCol = "title" | "type" | "channel" | "date";
type SortDir = "asc" | "desc";

export type LibraryWorkspaceProps = {
  filteredLibraryItems: LibraryItem[];
  libraryPosterFilter: string;
  setLibraryPosterFilter: (v: string) => void;
  availablePosterFacets: PosterFacet[];
  libraryScope: "all" | "collection";
  librarySort: "newest" | "oldest" | "title" | "manual";
  setLibrarySort: (v: "newest" | "oldest" | "title" | "manual") => void;
  dragOverLibraryItemId: string | null;
  canReorderCollection: boolean;
  onLibraryItemDragStart: (e: React.DragEvent, id: string) => void;
  onLibraryItemDragOver: (e: React.DragEvent, id: string) => void;
  onLibraryItemDragEnd: () => void;
  onLibraryItemDrop: (e: React.DragEvent, id: string) => Promise<void>;
  getLibraryThumbnail: (item: LibraryItem) => string | null;
  decodeHtmlEntities: (v?: string | null) => string;
  busy: boolean;
  viewFilter: ViewFilter;
  onViewFilterChange: (filter: ViewFilter) => void;
  isAsideOpen?: boolean;
  onToggleAside?: () => void;
  libraryImageSize: number;
  setLibraryImageSize: React.Dispatch<React.SetStateAction<number>>;
  libraryTilePrimaryId: string | null;
  setLibraryTilePrimaryId: React.Dispatch<React.SetStateAction<string | null>>;
  libraryTileMultiIds: string[];
  setLibraryTileMultiIds: React.Dispatch<React.SetStateAction<string[]>>;
  libraryFavoritedIds: string[];
  setLibraryFavoritedIds: React.Dispatch<React.SetStateAction<string[]>>;
};

export function LibraryWorkspace({
  filteredLibraryItems,
  libraryPosterFilter,
  setLibraryPosterFilter,
  availablePosterFacets,
  libraryScope,
  librarySort,
  setLibrarySort,
  dragOverLibraryItemId,
  canReorderCollection,
  onLibraryItemDragStart,
  onLibraryItemDragOver,
  onLibraryItemDragEnd,
  onLibraryItemDrop,
  getLibraryThumbnail,
  decodeHtmlEntities,
  viewFilter,
  onViewFilterChange,
  isAsideOpen = true,
  onToggleAside,
  libraryImageSize: imageSize,
  setLibraryImageSize: setImageSize,
  libraryTilePrimaryId: selectedItemId,
  setLibraryTilePrimaryId: setSelectedItemId,
  libraryTileMultiIds,
  setLibraryTileMultiIds,
  libraryFavoritedIds,
  setLibraryFavoritedIds,
}: LibraryWorkspaceProps) {
  const viewFilteredItems = useMemo(() => {
    if (viewFilter === "all") return filteredLibraryItems;
    if (viewFilter === "hearted") {
      const fav = new Set(libraryFavoritedIds);
      return filteredLibraryItems.filter((item) => fav.has(item.id));
    }
    if (viewFilter === "media") {
      return filteredLibraryItems.filter(
        (item) =>
          item.item_type === "media" ||
          (item.media_url &&
            !isMusicUrl(item.media_url ?? "") &&
            !isVideoUrl(item.media_url ?? "")),
      );
    }
    if (viewFilter === "music") {
      return filteredLibraryItems.filter(
        (item) =>
          isMusicUrl(item.url ?? "") || isMusicUrl(item.media_url ?? ""),
      );
    }
    if (viewFilter === "video") {
      return filteredLibraryItems.filter(
        (item) =>
          isVideoUrl(item.url ?? "") || isVideoUrl(item.media_url ?? ""),
      );
    }
    if (viewFilter === "links") {
      return filteredLibraryItems.filter(
        (item) =>
          item.item_type === "url" &&
          !isMusicUrl(item.url ?? "") &&
          !isVideoUrl(item.url ?? ""),
      );
    }
    return filteredLibraryItems;
  }, [filteredLibraryItems, viewFilter, libraryFavoritedIds]);
  const columnCount = 7 - imageSize;
  const multiSelectedIds = useMemo(
    () => new Set(libraryTileMultiIds),
    [libraryTileMultiIds],
  );
  const favoritedIdSet = useMemo(
    () => new Set(libraryFavoritedIds),
    [libraryFavoritedIds],
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [listSort, setListSort] = useState<SortCol>("date");
  const [listSortDir, setListSortDir] = useState<SortDir>("desc");

  const handleSort = (col: SortCol) => {
    if (listSort === col) {
      setListSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setListSort(col);
      setListSortDir("asc");
    }
  };

  const sortedListItems = useMemo(() => {
    const items = [...viewFilteredItems];
    items.sort((a, b) => {
      if (listSort === "date") {
        const dA = new Date(a.post_time || 0).getTime();
        const dB = new Date(b.post_time || 0).getTime();
        return listSortDir === "asc" ? dA - dB : dB - dA;
      }
      let valA = "";
      let valB = "";
      if (listSort === "title") {
        valA = (a.title || a.preview_title || a.url || "").toLowerCase();
        valB = (b.title || b.preview_title || b.url || "").toLowerCase();
      } else if (listSort === "type") {
        const typeLabel = (item: LibraryItem) =>
          isVideoUrl(item.url ?? "") ? "video"
          : isMusicUrl(item.url ?? "") ? "music"
          : item.item_type === "media" ? "media"
          : "link";
        valA = typeLabel(a);
        valB = typeLabel(b);
      } else if (listSort === "channel") {
        valA = a.channel_name ?? "";
        valB = b.channel_name ?? "";
      }
      return listSortDir === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
    return items;
  }, [viewFilteredItems, listSort, listSortDir]);

  const [lightboxItemId, setLightboxItemId] = useState<string | null>(null);
  const lastClickedIdRef = useRef<string | null>(null);

  const handleTileClick = (item: LibraryItem, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Keep Shift+click scoped to app selection state only.
      e.preventDefault();
      setLibraryTileMultiIds((prev) => {
        const next = new Set(prev);
        if (selectedItemId) next.add(selectedItemId);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return [...next];
      });
      setSelectedItemId(item.id);
      lastClickedIdRef.current = item.id;
      return;
    }
    if (selectedItemId === item.id) {
      setLightboxItemId(item.id);
      return;
    }
    setLibraryTileMultiIds([]);
    setSelectedItemId(item.id);
    lastClickedIdRef.current = item.id;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-3 py-0 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            aria-label={isAsideOpen ? "Collapse sidebar" : "Expand sidebar"}
            title={isAsideOpen ? "Collapse sidebar" : "Expand sidebar"}
            onClick={onToggleAside}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-semibold">
            {viewFilteredItems.length} items
          </h2>

          <Select
            value={librarySort}
            onValueChange={(v) =>
              setLibrarySort(v as "newest" | "oldest" | "title" | "manual")
            }
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="newest"
                disabled={libraryScope === "collection"}
              >
                Newest first
              </SelectItem>
              <SelectItem
                value="oldest"
                disabled={libraryScope === "collection"}
              >
                Oldest first
              </SelectItem>
              <SelectItem value="title">Title A-Z</SelectItem>
              <SelectItem
                value="manual"
                disabled={libraryScope !== "collection"}
              >
                Manual order
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={viewFilter}
            onValueChange={(val) =>
              onViewFilterChange((val as ViewFilter) || "all")
            }
            className="flex"
          >
            <ToggleGroupItem
              value="all"
              aria-label="Everything"
              size="sm"
              className="h-12 w-12 flex flex-col items-center justify-center"
            >
              <Snail className="w-4 h-4" />
              Everything
            </ToggleGroupItem>
            <ToggleGroupItem
              value="media"
              aria-label="Images"
              size="sm"
              className="h-12 w-12 flex flex-col items-center justify-center"
            >
              <Image className="w-4 h-4" />
              Media
            </ToggleGroupItem>
            <ToggleGroupItem
              value="music"
              aria-label="Music"
              size="sm"
              className="h-12 w-12 flex flex-col items-center justify-center"
            >
              <Music className="w-4 h-4" />
              Music
            </ToggleGroupItem>
            <ToggleGroupItem
              value="video"
              aria-label="Video"
              size="sm"
              className="h-12 w-12 flex flex-col items-center justify-center"
            >
              <Video className="w-4 h-4" />
              Video
            </ToggleGroupItem>
            <ToggleGroupItem
              value="links"
              aria-label="Links"
              size="sm"
              className="h-12 w-12 flex flex-col items-center justify-center"
            >
              <Link className="w-4 h-4" />
              Links
            </ToggleGroupItem>
            <ToggleGroupItem
              value="hearted"
              aria-label="Hearted items"
              size="sm"
              className="h-12 w-12 flex flex-col items-center justify-center"
            >
              <Heart className="w-4 h-4" />
              Hearted
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                viewMode === "grid" && "bg-accent text-accent-foreground",
              )}
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                viewMode === "list" && "bg-accent text-accent-foreground",
              )}
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={libraryPosterFilter}
            onValueChange={setLibraryPosterFilter}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All posters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All posters</SelectItem>
              {availablePosterFacets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  @{p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Minus
            className="w-3 h-3 text-muted-foreground shrink-0"
            onClick={() => setImageSize(imageSize - 1)}
          />
          <input
            type="range"
            min={1}
            max={6}
            value={imageSize}
            onChange={(e) => setImageSize(Number(e.target.value))}
            className="w-24 accent-foreground"
          />
          <Plus
            className="w-3 h-3 text-muted-foreground shrink-0"
            onClick={() => setImageSize(imageSize + 1)}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {canReorderCollection && (
          <p className="text-xs text-muted-foreground px-3 pt-2">
            Drag cards to reorder this collection.
          </p>
        )}

        {viewFilteredItems.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-3">
            No library items match this view.
          </p>
        ) : viewMode === "list" ? (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-background border-b border-border">
              <tr>
                <SortableHeader col="title" label="Title" sortCol={listSort} sortDir={listSortDir} onSort={handleSort} className="w-full" />
                <SortableHeader col="type" label="Type" sortCol={listSort} sortDir={listSortDir} onSort={handleSort} className="w-24" />
                <SortableHeader col="channel" label="Channel" sortCol={listSort} sortDir={listSortDir} onSort={handleSort} className="w-32" />
                <SortableHeader col="date" label="Date" sortCol={listSort} sortDir={listSortDir} onSort={handleSort} className="w-28" />
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap w-12">Link</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {sortedListItems.slice(0, 100).map((item) => (
                <LibraryTableRow
                  key={item.id}
                  item={item}
                  selected={item.id === selectedItemId || multiSelectedIds.has(item.id)}
                  favorited={favoritedIdSet.has(item.id)}
                  thumbnail={getLibraryThumbnail(item)}
                  decodeHtmlEntities={decodeHtmlEntities}
                  onToggleFavorite={() =>
                    setLibraryFavoritedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return [...next];
                    })
                  }
                  onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
                  onClick={(e) => handleTileClick(item, e)}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div
            className="grid gap-1 p-3"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            }}
          >
            {viewFilteredItems.slice(0, 100).map((item) => {
              const thumbnail = getLibraryThumbnail(item);
              const selected =
                item.id === selectedItemId || multiSelectedIds.has(item.id);
              const favorited = favoritedIdSet.has(item.id);
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
                    setLibraryFavoritedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return [...next];
                    })
                  }
                  onMouseDown={(e) => {
                    if (e.shiftKey) e.preventDefault();
                  }}
                  onClick={(e) => handleTileClick(item, e)}
                />
              );
            })}
          </div>
        )}

        {viewFilteredItems.length > 100 && (
          <p className="text-xs text-muted-foreground px-3 pb-3">
            Showing first 100 items. Narrow filters to see more.
          </p>
        )}
      </div>

      <Lightbox
        images={viewFilteredItems
          .filter((item) => !!getLibraryThumbnail(item))
          .map((item) => ({
            id: item.id,
            src: getLibraryThumbnail(item)!,
            title: decodeHtmlEntities(item.title || item.preview_title),
            description: decodeHtmlEntities(
              item.description || item.preview_description,
            ),
            url: item.url,
            postedBy: item.posted_by_handle,
            date: item.post_time,
            channel: item.channel_name,
            tags: item.taxonomy_terms,
          }))}
        activeId={lightboxItemId}
        onClose={() => setLightboxItemId(null)}
        onNavigate={(id) => setLightboxItemId(id)}
      />
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
  onMouseDown?: (e: React.MouseEvent) => void;
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
  onMouseDown,
  onClick,
}: LibraryTileProps) {
  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-md cursor-pointer group",
        "bg-muted border border-transparent transition-all duration-150",
        selected && "ring-2 ring-blue-500 ring-offset-1",
        dragOver && "border-destructive bg-destructive/5",
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={decodeHtmlEntities(item.title || item.preview_title || "")}
          className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
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
            className={cn(
              "w-3.5 h-3.5",
              favorited ? "fill-red-500 text-red-500" : "text-white",
            )}
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
            <DropdownMenuItem className="text-destructive">
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title on hover */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <p className="text-[11px] text-white font-medium truncate leading-tight">
          {decodeHtmlEntities(
            item.title || item.preview_title || item.url || "Untitled",
          )}
        </p>
      </div>
    </div>
  );
}

function SortableHeader({
  col,
  label,
  sortCol,
  sortDir,
  onSort,
  className,
}: {
  col: SortCol;
  label: string;
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (col: SortCol) => void;
  className?: string;
}) {
  const active = sortCol === col;
  return (
    <th
      className={cn(
        "px-3 py-2 text-left text-xs font-semibold text-muted-foreground",
        "cursor-pointer select-none hover:text-foreground transition-colors",
        "whitespace-nowrap",
        className,
      )}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-[10px] w-3 inline-block">
          {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </span>
      </span>
    </th>
  );
}

function LibraryTableRow({
  item,
  selected,
  favorited,
  thumbnail,
  decodeHtmlEntities,
  onToggleFavorite,
  onMouseDown,
  onClick,
}: LibraryTileProps) {
  const title = decodeHtmlEntities(
    item.title || item.preview_title || item.url || "Untitled",
  );
  const isVideo =
    isVideoUrl(item.url ?? "") || isVideoUrl(item.media_url ?? "");
  const isMusic =
    isMusicUrl(item.url ?? "") || isMusicUrl(item.media_url ?? "");
  const typeLabel = isVideo
    ? "Video"
    : isMusic
      ? "Music"
      : item.item_type === "media"
        ? "Media"
        : "Link";
  const TypeIcon = isVideo
    ? Video
    : isMusic
      ? Music
      : item.item_type === "media"
        ? ImageIcon
        : Link;

  return (
    <tr
      className={cn(
        "group cursor-pointer border-b border-border/50 last:border-0",
        "hover:bg-accent/40 transition-colors",
        selected && "bg-blue-500/10 ring-inset ring-1 ring-blue-500",
      )}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <TypeIcon className="w-3.5 h-3.5 text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate leading-tight">
              {title}
            </p>
            {item.posted_by_handle && (
              <p className="text-[11px] text-muted-foreground truncate">
                @{item.posted_by_handle}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TypeIcon className="w-3 h-3" />
          {typeLabel}
        </span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {item.channel_name && (
          <span className="text-xs text-muted-foreground">
            #{item.channel_name}
          </span>
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className="text-xs text-muted-foreground">
          {item.post_time
            ? new Date(item.post_time).toLocaleDateString()
            : "—"}
        </span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {(item.url || item.media_url) && (
          <a
            href={(item.url || item.media_url)!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open link"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </td>
      <td className="px-2 py-2 text-right">
        <Toggle
          pressed={favorited}
          onPressedChange={onToggleFavorite}
          onClick={(e) => e.stopPropagation()}
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity border-0"
          aria-label="Favorite"
        >
          <Heart
            className={cn(
              "w-3 h-3",
              favorited ? "fill-red-500 text-red-500" : "text-muted-foreground",
            )}
          />
        </Toggle>
      </td>
    </tr>
  );
}
