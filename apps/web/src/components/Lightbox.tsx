import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type LightboxImage = {
  id: string;
  src: string;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  postedBy?: string | null;
  date?: string | null;
  channel?: string | null;
  tags?: string[];
};

export type LightboxProps = {
  images: LightboxImage[];
  activeId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
};

export function Lightbox({ images, activeId, onClose, onNavigate }: LightboxProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const activeIndex = images.findIndex((i) => i.id === activeId);
  const activeImage = activeIndex >= 0 ? images[activeIndex] : null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setDetailsOpen(false);
      setIsClosing(false);
      onClose();
    }, 180);
  };

  useEffect(() => {
    if (!activeId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") {
        const next = images[activeIndex + 1];
        if (next) onNavigate(next.id);
      }
      if (e.key === "ArrowLeft") {
        const prev = images[activeIndex - 1];
        if (prev) onNavigate(prev.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeIndex, images]);

  if (!activeImage) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        backgroundColor: "rgba(0,0,0,0.85)",
        animation: isClosing
          ? "lightbox-fade-out 180ms ease forwards"
          : "lightbox-fade-in 200ms ease forwards",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 w-full">
        <p className="text-sm text-white/80 truncate max-w-md">
          {activeImage.title ?? activeImage.url ?? "Untitled"}
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
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10"
            onClick={handleClose}
          >
            ✕
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
          onClick={() => {
            const prev = images[activeIndex - 1];
            if (prev) onNavigate(prev.id);
          }}
          disabled={activeIndex <= 0}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Image */}
        <img
          src={activeImage.src}
          alt={activeImage.title ?? ""}
          className="max-h-full max-w-full object-contain"
        />

        {/* Next */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 z-10 h-10 w-10 rounded-full bg-black/40 hover:bg-black/70 text-white border-0"
          onClick={() => {
            const next = images[activeIndex + 1];
            if (next) onNavigate(next.id);
          }}
          disabled={activeIndex >= images.length - 1}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

        {/* Details panel */}
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-72 bg-black/80 backdrop-blur-sm p-4 flex flex-col gap-3 overflow-y-auto border-l border-white/10 z-20",
            "transition-transform duration-300 ease-out",
            detailsOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <h3 className="text-sm font-semibold text-white">Details</h3>
          <div className="flex flex-col gap-2 text-xs text-white/70">
            {activeImage.title && (
              <div>
                <span className="text-white/40 block mb-0.5">Title</span>
                {activeImage.title}
              </div>
            )}
            {activeImage.description && (
              <div>
                <span className="text-white/40 block mb-0.5">Description</span>
                {activeImage.description}
              </div>
            )}
            {activeImage.url && (
              <div>
                <span className="text-white/40 block mb-0.5">URL</span>
                <a
                  href={activeImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 underline break-all"
                >
                  {activeImage.url}
                </a>
              </div>
            )}
            {activeImage.postedBy && (
              <div>
                <span className="text-white/40 block mb-0.5">Posted by</span>
                @{activeImage.postedBy}
              </div>
            )}
            {activeImage.date && (
              <div>
                <span className="text-white/40 block mb-0.5">Date</span>
                {new Date(activeImage.date).toLocaleDateString()}
              </div>
            )}
            {activeImage.channel && (
              <div>
                <span className="text-white/40 block mb-0.5">Channel</span>
                #{activeImage.channel}
              </div>
            )}
            {(activeImage.tags ?? []).length > 0 && (
              <div>
                <span className="text-white/40 block mb-1">Tags</span>
                <div className="flex flex-wrap gap-1">
                  {(activeImage.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Index indicator */}
      <div className="shrink-0 py-2 text-center text-xs text-white/40">
        {activeIndex + 1} / {images.length}
      </div>
    </div>,
    document.body,
  );
}
