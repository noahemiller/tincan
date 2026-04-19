import {
  type CSSProperties,
  ChangeEvent,
  DragEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccountMenu } from "./components/AccountMenu";
import { AccountWorkspace } from "./components/AccountWorkspace";
import { AuthShell } from "./components/AuthShell";
import { LibraryWorkspace } from "./components/LibraryWorkspace";
import { MessageList } from "./components/MessageList";
import { Rail, type RailTab } from "./components/Rail";
import { SidebarPanel } from "./components/SidebarPanel";
import { ThreadPanel } from "./components/ThreadPanel";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { extractUrls } from "./lib/chat";
import { DesignSystemPage } from "./components/DesignSystemPage";
import { Settings2 } from "lucide-react";

import { api } from "./api";

type User = {
  id: string;
  email: string;
  handle: string;
  name: string;
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
  home_server_id?: string | null;
  bio?: string | null;
};

type Server = {
  id: string;
  name: string;
  slug: string;
  role?: "owner" | "admin" | "member";
};

type Channel = {
  id: string;
  name: string;
  slug: string;
  notification_mode: "hidden" | "passive" | "active";
  snoozed_until?: string | null;
};

type DmConversation = {
  id: string;
  other_user_id: string;
  other_handle: string;
  other_name: string;
  other_avatar_url?: string | null;
  unread_count: number;
  last_message_at?: string | null;
};

type Message = {
  id: string;
  body: string;
  thread_root_message_id?: string | null;
  thread_reply_count?: number;
  author_user_id: string;
  author_handle: string;
  author_name: string;
  author_avatar_url?: string | null;
  edited_at?: string | null;
  created_at: string;
  reactions: { emoji: string; count: number }[];
  attachments: {
    id: string;
    mime_type: string;
    original_name: string;
    public_url: string;
  }[];
};

type ThreadMessage = {
  id: string;
  body: string;
  author_handle: string;
  author_name: string;
  author_avatar_url?: string | null;
  created_at: string;
  attachments: {
    id: string;
    mime_type: string;
    original_name: string;
    public_url: string;
  }[];
};

import type { LinkPreview } from "./lib/chat";

type Command = {
  id: string;
  command: string;
  response_text: string;
};

type LibraryItem = {
  id: string;
  item_type: "url" | "media";
  source_message_id?: string | null;
  post_time?: string;
  posted_by_user_id?: string;
  posted_by_handle?: string;
  posted_by_name?: string;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  taxonomy_terms?: string[];
  media_url?: string | null;
  preview_image_url?: string | null;
  preview_title?: string | null;
  preview_description?: string | null;
  channel_name?: string;
  created_at?: string;
};

const TOKEN_KEY = "tincan_token";
const REFRESH_TOKEN_KEY = "tincan_refresh_token";
const UI_PREFS_KEY = "tincan_ui_prefs_v1";
const CHANNEL_MODULE_CONFIG_KEY = "tincan_channel_module_config_v1";
const COLUMN_LAYOUT_KEY = "tincan_column_layout_v1";

type UiPrefs = {
  textSize: "compact" | "comfortable" | "large";
  contrast: "default" | "high" | "soft" | "rg-safe";
  sessionDuration: "standard" | "hour";
  onboarded: boolean;
};

type ChannelModuleConfig = {
  modules: {
    dice: boolean;
    surveys: boolean;
    musicEmbeds: boolean;
    linkPreviews: boolean;
    threads: boolean;
  };
  ui: {
    messageDensity: "compact" | "comfortable";
    showAvatars: boolean;
    cornerRadiusPx: number;
    borderWidthPx: number;
    colorTheme: {
      enabled: boolean;
      backgroundBase: string;
      backgroundAlt: string;
      main: string;
      highlight: string;
      text: string;
      border: string;
    };
  };
  notifications: {
    autoMarkReadAtBottom: boolean;
    showUnreadBadge: boolean;
  };
};

type ChannelModuleConfigMap = Record<string, ChannelModuleConfig>;

function loadUiPrefs(): UiPrefs {
  const fallback: UiPrefs = {
    textSize: "comfortable",
    contrast: "default",
    sessionDuration: "standard",
    onboarded: false,
  };
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    return {
      textSize:
        parsed.textSize === "compact" || parsed.textSize === "large"
          ? parsed.textSize
          : "comfortable",
      contrast:
        parsed.contrast === "high" ||
        parsed.contrast === "soft" ||
        parsed.contrast === "rg-safe"
          ? parsed.contrast
          : "default",
      sessionDuration: parsed.sessionDuration === "hour" ? "hour" : "standard",
      onboarded: parsed.onboarded === true,
    };
  } catch {
    return fallback;
  }
}

function defaultChannelModuleConfig(): ChannelModuleConfig {
  return {
    modules: {
      dice: true,
      surveys: true,
      musicEmbeds: true,
      linkPreviews: true,
      threads: true,
    },
    ui: {
      messageDensity: "comfortable",
      showAvatars: true,
      cornerRadiusPx: 10,
      borderWidthPx: 1,
      colorTheme: {
        enabled: false,
        backgroundBase: "#FFFBDB",
        backgroundAlt: "#FFFFFF",
        main: "#7776BC",
        highlight: "#CDC7E5",
        text: "#1F1C2E",
        border: "#CDC7E5",
      },
    },
    notifications: {
      autoMarkReadAtBottom: true,
      showUnreadBadge: true,
    },
  };
}

function normalizeHexColor(
  value: unknown,
  fallback: string,
): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  const isHex = /^#([0-9a-fA-F]{6})$/.test(trimmed);
  return isHex ? trimmed.toUpperCase() : fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) {
    return null;
  }
  const value = match[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function isLightHex(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return true;
  }
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance >= 0.62;
}

function sanitizeChannelModuleConfig(
  value: unknown,
): ChannelModuleConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const input = value as Partial<ChannelModuleConfig>;
  const modules = input.modules ?? {};
  const ui = input.ui ?? {};
  const colorThemeInput = ui.colorTheme ?? {};
  const notifications = input.notifications ?? {};
  return {
    modules: {
      dice: modules.dice !== false,
      surveys: modules.surveys !== false,
      musicEmbeds: modules.musicEmbeds !== false,
      linkPreviews: modules.linkPreviews !== false,
      threads: modules.threads !== false,
    },
    ui: {
      messageDensity: ui.messageDensity === "compact" ? "compact" : "comfortable",
      showAvatars: ui.showAvatars !== false,
      cornerRadiusPx:
        typeof ui.cornerRadiusPx === "number" &&
        Number.isFinite(ui.cornerRadiusPx)
          ? Math.min(96, Math.max(0, Math.round(ui.cornerRadiusPx)))
          : 10,
      borderWidthPx:
        typeof ui.borderWidthPx === "number" &&
        Number.isFinite(ui.borderWidthPx)
          ? Math.min(24, Math.max(0, Math.round(ui.borderWidthPx)))
          : 1,
      colorTheme: {
        enabled: colorThemeInput.enabled === true,
        backgroundBase: normalizeHexColor(
          (colorThemeInput as { backgroundBase?: unknown; background?: unknown })
            .backgroundBase ?? (colorThemeInput as { background?: unknown }).background,
          "#FFFBDB",
        ),
        backgroundAlt: normalizeHexColor(
          (colorThemeInput as { backgroundAlt?: unknown; card?: unknown })
            .backgroundAlt ?? (colorThemeInput as { card?: unknown }).card,
          "#FFFFFF",
        ),
        main: normalizeHexColor(
          (colorThemeInput as { main?: unknown; primary?: unknown }).main ??
            (colorThemeInput as { primary?: unknown }).primary,
          "#7776BC",
        ),
        highlight: normalizeHexColor(
          (colorThemeInput as { highlight?: unknown; accent?: unknown })
            .highlight ?? (colorThemeInput as { accent?: unknown }).accent,
          "#CDC7E5",
        ),
        text: normalizeHexColor(
          (colorThemeInput as { text?: unknown; foreground?: unknown }).text ??
            (colorThemeInput as { foreground?: unknown }).foreground,
          "#1F1C2E",
        ),
        border: normalizeHexColor(
          (colorThemeInput as { border?: unknown }).border,
          "#CDC7E5",
        ),
      },
    },
    notifications: {
      autoMarkReadAtBottom: notifications.autoMarkReadAtBottom !== false,
      showUnreadBadge: notifications.showUnreadBadge !== false,
    },
  };
}

function loadChannelModuleConfigMap(): ChannelModuleConfigMap {
  try {
    const raw = localStorage.getItem(CHANNEL_MODULE_CONFIG_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const next: ChannelModuleConfigMap = {};
    for (const [channelId, config] of Object.entries(parsed)) {
      const safeConfig = sanitizeChannelModuleConfig(config);
      if (safeConfig) {
        next[channelId] = safeConfig;
      }
    }
    return next;
  } catch {
    return {};
  }
}

function loadColumnLayout() {
  const fallback = { centerMinWidth: 520, rightWidth: 256 };
  try {
    const raw = localStorage.getItem(COLUMN_LAYOUT_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<{
      centerMinWidth: number;
      rightWidth: number;
    }>;
    return {
      centerMinWidth:
        typeof parsed.centerMinWidth === "number" &&
        Number.isFinite(parsed.centerMinWidth)
          ? Math.min(1200, Math.max(360, parsed.centerMinWidth))
          : fallback.centerMinWidth,
      rightWidth:
        typeof parsed.rightWidth === "number" && Number.isFinite(parsed.rightWidth)
          ? Math.min(560, Math.max(220, parsed.rightWidth))
          : fallback.rightWidth,
    };
  } catch {
    return fallback;
  }
}

function decodeHtmlEntities(value?: string | null) {
  if (!value) {
    return "";
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    return value;
  }
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function guessTaxonomySuggestions(item: LibraryItem) {
  const suggestions = new Set<string>();
  if (item.item_type === "media") {
    suggestions.add("media");
    const url = item.media_url || "";
    if (/\.(png|jpg|jpeg|gif|webp|avif)$/i.test(url)) suggestions.add("image");
    if (/\.(mp4|mov|m4v|webm)$/i.test(url)) suggestions.add("video");
    if (/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(url)) suggestions.add("audio");
  } else {
    suggestions.add("link");
    if (item.url) {
      try {
        const host = new URL(item.url).hostname.replace(/^www\./, "");
        const root = host.split(".")[0];
        if (root) suggestions.add(root.toLowerCase());
      } catch {
        // ignore invalid urls
      }
    }
  }

  const sourceText =
    `${item.preview_title || ""} ${item.preview_description || ""} ${item.title || ""} ${item.description || ""}`.toLowerCase();
  const keywordToTerm: [RegExp, string][] = [
    [/\bmusic|song|album|track|spotify|apple music|tidal\b/, "music"],
    [/\bvideo|youtube|clip\b/, "video"],
    [/\bnews|article|blog\b/, "article"],
    [/\bcode|github|programming|dev\b/, "tech"],
    [/\bgame|gaming\b/, "gaming"],
  ];
  for (const [pattern, term] of keywordToTerm) {
    if (pattern.test(sourceText)) {
      suggestions.add(term);
    }
  }

  return [...suggestions].slice(0, 8);
}

export function App() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) ?? "",
  );
  const [refreshToken, setRefreshToken] = useState(
    () => localStorage.getItem(REFRESH_TOKEN_KEY) ?? "",
  );
  const [user, setUser] = useState<User | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dmConversations, setDmConversations] = useState<DmConversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [selectedDmId, setSelectedDmId] = useState<string>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    name: "",
    handle: "",
  });
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetTokenPreview, setResetTokenPreview] = useState("");
  const [resetTokenExpiresAt, setResetTokenExpiresAt] = useState("");
  const [serverName, setServerName] = useState("");
  const [channelName, setChannelName] = useState("");
  const [dmHandleInput, setDmHandleInput] = useState("");
  const [composer, setComposer] = useState("");
  const [pendingMedia, setPendingMedia] = useState<
    {
      id: string;
      public_url: string;
      mime_type: string;
      original_name: string;
    }[]
  >([]);
  const [selectedThreadRootId, setSelectedThreadRootId] = useState("");
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [threadComposer, setThreadComposer] = useState("");
  const [channelMode, setChannelMode] = useState<
    "hidden" | "passive" | "active"
  >("passive");
  const [channelSettingsName, setChannelSettingsName] = useState("");
  const [channelSnoozeHours, setChannelSnoozeHours] = useState("0");
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false);
  const [centerPane, setCenterPane] = useState<
    "chat" | "library" | "account" | "design"
  >("chat");
  const [accountView, setAccountView] = useState<
    "profile" | "settings" | "accessibility"
  >("profile");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [leftRailTab, setLeftRailTab] = useState<RailTab>("channels");
  const [centerColumnMinWidth, setCenterColumnMinWidth] = useState<number>(
    () => loadColumnLayout().centerMinWidth,
  );
  const [rightColumnWidth, setRightColumnWidth] = useState<number>(
    () => loadColumnLayout().rightWidth,
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkPreview>>(
    {},
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    {
      id: string;
      body: string;
      author_name: string;
      channel_name: string;
      created_at: string;
    }[]
  >([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [collections, setCollections] = useState<
    { id: string; name: string; visibility: "private" | "public" }[]
  >([]);
  const [collectionName, setCollectionName] = useState("");
  const [collectionVisibility, setCollectionVisibility] = useState<
    "private" | "public"
  >("private");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [selectedLibraryItemIds, setSelectedLibraryItemIds] = useState<
    string[]
  >([]);
  const [collectionItems, setCollectionItems] = useState<LibraryItem[]>([]);
  const [libraryScope, setLibraryScope] = useState<"all" | "collection">("all");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryTypeFilter, setLibraryTypeFilter] = useState<
    "all" | "url" | "media"
  >("all");
  const [librarySort, setLibrarySort] = useState<
    "newest" | "oldest" | "title" | "manual"
  >("newest");
  const [libraryPosterFilter, setLibraryPosterFilter] = useState<string>("all");
  const [libraryTaxonomyFilter, setLibraryTaxonomyFilter] =
    useState<string>("all");
  const [libraryDateFrom, setLibraryDateFrom] = useState("");
  const [libraryDateTo, setLibraryDateTo] = useState("");
  const [taxonomyQuickInput, setTaxonomyQuickInput] = useState("");
  const [editingLibraryItem, setEditingLibraryItem] =
    useState<LibraryItem | null>(null);
  const [metadataTitleDraft, setMetadataTitleDraft] = useState("");
  const [metadataDescriptionDraft, setMetadataDescriptionDraft] = useState("");
  const [metadataTermsDraft, setMetadataTermsDraft] = useState("");
  const [draggingLibraryItemId, setDraggingLibraryItemId] = useState<
    string | null
  >(null);
  const [dragOverLibraryItemId, setDragOverLibraryItemId] = useState<
    string | null
  >(null);
  const [inviteRoleToGrant, setInviteRoleToGrant] = useState<
    "admin" | "member"
  >("member");
  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [inviteExpiresHours, setInviteExpiresHours] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [invites, setInvites] = useState<
    {
      id: string;
      code: string;
      role_to_grant: "admin" | "member";
      uses_count: number;
    }[]
  >([]);
  const [members, setMembers] = useState<
    {
      user_id: string;
      name: string;
      handle: string;
      role: "owner" | "admin" | "member";
    }[]
  >([]);
  const [unread, setUnread] = useState<
    {
      channel_id: string;
      channel_name: string;
      server_id: string;
      server_name: string;
      unread_count: number;
      mention_count?: number;
    }[]
  >([]);
  const [userCommands, setUserCommands] = useState<Command[]>([]);
  const [serverCommands, setServerCommands] = useState<Command[]>([]);
  const [userCommandForm, setUserCommandForm] = useState({
    command: "",
    responseText: "",
  });
  const [serverCommandForm, setServerCommandForm] = useState({
    command: "",
    responseText: "",
  });
  const [uiPrefs, setUiPrefs] = useState<UiPrefs>(() => loadUiPrefs());
  const [channelModuleConfigs, setChannelModuleConfigs] =
    useState<ChannelModuleConfigMap>(() => loadChannelModuleConfigMap());
  const [profileForm, setProfileForm] = useState({
    name: "",
    handle: "",
    email: "",
    bio: "",
    avatarUrl: "",
    avatarThumbUrl: "",
    homeServerId: "",
  });
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const channelConfigUploadRef = useRef<HTMLInputElement | null>(null);
  const markReadInFlightRef = useRef<string | null>(null);
  const lastMarkedReadByChannelRef = useRef<Record<string, string>>({});
  const sessionRefreshInFlightRef = useRef(false);
  const didBootstrapRef = useRef(false);

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId) ?? null,
    [servers, selectedServerId],
  );
  const canCreateChannels = Boolean(selectedServerId);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );
  const selectedDmConversation = useMemo(
    () =>
      dmConversations.find((conversation) => conversation.id === selectedDmId) ??
      null,
    [dmConversations, selectedDmId],
  );
  const selectedChannelModuleConfig = useMemo(() => {
    if (!selectedChannelId) {
      return defaultChannelModuleConfig();
    }
    return (
      channelModuleConfigs[selectedChannelId] ?? defaultChannelModuleConfig()
    );
  }, [channelModuleConfigs, selectedChannelId]);
  const selectedChannelThemeStyle = useMemo(() => {
    if (
      !selectedChannelId ||
      !selectedChannelModuleConfig.ui.colorTheme.enabled
    ) {
      return undefined;
    }
    const theme = selectedChannelModuleConfig.ui.colorTheme;
    const isLight = isLightHex(theme.backgroundBase);
    const foreground = theme.text;
    const mutedForeground = isLight ? "#6C6678" : "#C9C3D6";
    const border = theme.border;
    return {
      ["--background" as const]: theme.backgroundBase,
      ["--card" as const]: theme.backgroundAlt,
      ["--popover" as const]: theme.backgroundAlt,
      ["--accent" as const]: theme.highlight,
      ["--primary" as const]: theme.main,
      ["--border" as const]: border,
      ["--input" as const]: border,
      ["--ring" as const]: theme.main,
      ["--foreground" as const]: foreground,
      ["--card-foreground" as const]: foreground,
      ["--popover-foreground" as const]: foreground,
      ["--muted-foreground" as const]: mutedForeground,
      ["--accent-foreground" as const]: foreground,
    } as CSSProperties;
  }, [selectedChannelId, selectedChannelModuleConfig]);
  const selectedCollection = useMemo(
    () =>
      collections.find(
        (collection) => collection.id === selectedCollectionId,
      ) ?? null,
    [collections, selectedCollectionId],
  );

  const unreadCountByChannel = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of unread) {
      map.set(item.channel_id, item.unread_count);
    }
    return map;
  }, [unread]);

  const mentionCountByChannel = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of unread) {
      map.set(item.channel_id, item.mention_count ?? 0);
    }
    return map;
  }, [unread]);

  const unreadBadgeCountByChannel = useMemo(() => {
    const map = new Map<string, number>();
    for (const [channelId, unreadCount] of unreadCountByChannel.entries()) {
      const config =
        channelModuleConfigs[channelId] ?? defaultChannelModuleConfig();
      map.set(
        channelId,
        config.notifications.showUnreadBadge ? unreadCount : 0,
      );
    }
    return map;
  }, [unreadCountByChannel, channelModuleConfigs]);

  const visibleChannels = useMemo(
    () =>
      channels.filter(
        (channel) =>
          !showUnreadOnly || (unreadCountByChannel.get(channel.id) ?? 0) > 0,
      ),
    [channels, showUnreadOnly, unreadCountByChannel],
  );

  const profilePhotos = useMemo(
    () =>
      libraryItems
        .filter(
          (item) =>
            item.item_type === "media" &&
            item.posted_by_user_id === user?.id &&
            item.media_url,
        )
        .slice(0, 24),
    [libraryItems, user?.id],
  );

  const libraryItemsById = useMemo(() => {
    const map = new Map<string, LibraryItem>();
    for (const item of libraryItems) {
      map.set(item.id, item);
    }
    return map;
  }, [libraryItems]);

  const enrichedCollectionItems = useMemo(() => {
    return collectionItems.map((item) => {
      const base = libraryItemsById.get(item.id);
      if (!base) {
        return item;
      }
      return {
        ...base,
        ...item,
        title: item.title ?? base.title,
        description: item.description ?? base.description,
        preview_title: item.preview_title ?? base.preview_title,
        preview_description:
          item.preview_description ?? base.preview_description,
        preview_image_url: item.preview_image_url ?? base.preview_image_url,
        media_url: item.media_url ?? base.media_url,
        channel_name: item.channel_name ?? base.channel_name,
      };
    });
  }, [collectionItems, libraryItemsById]);

  const activeLibraryItems = useMemo(
    () =>
      libraryScope === "collection" && selectedCollectionId
        ? enrichedCollectionItems
        : libraryItems,
    [libraryScope, selectedCollectionId, enrichedCollectionItems, libraryItems],
  );
  const canReorderCollection =
    libraryScope === "collection" &&
    !!selectedCollectionId &&
    librarySort === "manual";
  const selectedLibraryItems = useMemo(
    () =>
      activeLibraryItems.filter((item) =>
        selectedLibraryItemIds.includes(item.id),
      ),
    [activeLibraryItems, selectedLibraryItemIds],
  );

  const availablePosterFacets = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of activeLibraryItems) {
      if (item.posted_by_user_id) {
        map.set(
          item.posted_by_user_id,
          item.posted_by_handle ||
            item.posted_by_name ||
            item.posted_by_user_id,
        );
      }
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activeLibraryItems]);

  const availableTaxonomyFacets = useMemo(() => {
    const set = new Set<string>();
    for (const item of activeLibraryItems) {
      for (const term of item.taxonomy_terms ?? []) {
        if (term.trim()) set.add(term.trim().toLowerCase());
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [activeLibraryItems]);

  const filteredLibraryItems = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();

    const filtered = activeLibraryItems.filter((item) => {
      if (libraryTypeFilter !== "all" && item.item_type !== libraryTypeFilter) {
        return false;
      }
      if (
        libraryPosterFilter !== "all" &&
        item.posted_by_user_id !== libraryPosterFilter
      ) {
        return false;
      }
      if (
        libraryTaxonomyFilter !== "all" &&
        !(item.taxonomy_terms ?? [])
          .map((term) => term.toLowerCase())
          .includes(libraryTaxonomyFilter)
      ) {
        return false;
      }
      const postTimeValue = new Date(
        item.post_time || item.created_at || 0,
      ).getTime();
      if (libraryDateFrom) {
        const from = new Date(`${libraryDateFrom}T00:00:00`).getTime();
        if (postTimeValue < from) return false;
      }
      if (libraryDateTo) {
        const to = new Date(`${libraryDateTo}T23:59:59`).getTime();
        if (postTimeValue > to) return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        item.title,
        item.description,
        item.preview_title,
        item.preview_description,
        item.url,
        item.media_url,
        item.channel_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...filtered];
    if (librarySort === "manual" && libraryScope === "collection") {
      return sorted;
    }
    if (librarySort === "title") {
      sorted.sort((a, b) =>
        (a.title || a.url || "").localeCompare(b.title || b.url || ""),
      );
    } else if (librarySort === "oldest") {
      sorted.sort(
        (a, b) =>
          new Date(a.created_at ?? 0).getTime() -
          new Date(b.created_at ?? 0).getTime(),
      );
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime(),
      );
    }

    return sorted;
  }, [
    activeLibraryItems,
    libraryQuery,
    libraryTypeFilter,
    libraryPosterFilter,
    libraryTaxonomyFilter,
    libraryDateFrom,
    libraryDateTo,
    librarySort,
    libraryScope,
  ]);

  const visibleTaxonomySuggestions = useMemo(() => {
    const suggestions = new Set<string>();
    const seedItems = [
      ...selectedLibraryItems,
      ...filteredLibraryItems.slice(0, 10),
      ...activeLibraryItems.slice(0, 6),
    ];
    for (const seed of seedItems) {
      for (const term of guessTaxonomySuggestions(seed)) {
        suggestions.add(term.trim().toLowerCase());
      }
    }
    for (const term of availableTaxonomyFacets.slice(0, 14)) {
      suggestions.add(term);
    }
    if (suggestions.size === 0) {
      for (const fallback of [
        "link",
        "image",
        "video",
        "audio",
        "music",
        "article",
      ]) {
        suggestions.add(fallback);
      }
    }
    return [...suggestions].slice(0, 12);
  }, [
    selectedLibraryItems,
    filteredLibraryItems,
    activeLibraryItems,
    availableTaxonomyFacets,
  ]);

  const galleryImages = useMemo(
    () =>
      messages.flatMap((message) =>
        message.attachments
          .filter((attachment) => attachment.mime_type.startsWith("image/"))
          .map((attachment) => ({
            ...attachment,
            messageAuthor: message.author_name,
            messageCreatedAt: message.created_at,
          })),
      ),
    [messages],
  );

  useEffect(() => {
    if (!token) {
      didBootstrapRef.current = false;
      return;
    }
    if (didBootstrapRef.current) {
      return;
    }
    didBootstrapRef.current = true;

    void bootstrap(token);
  }, [token]);

  useEffect(() => {
    if (
      !token ||
      !refreshToken ||
      uiPrefs.sessionDuration !== "hour"
    ) {
      return;
    }

    const refreshSessionToken = async () => {
      if (sessionRefreshInFlightRef.current) {
        return;
      }
      sessionRefreshInFlightRef.current = true;
      try {
        const refreshed = await api.refresh({ refreshToken });
        const nextToken = refreshed.accessToken ?? refreshed.token;
        localStorage.setItem(TOKEN_KEY, nextToken);
        setToken(nextToken);
        setUser(refreshed.user);
        if (refreshed.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshed.refreshToken);
          setRefreshToken(refreshed.refreshToken);
        }
      } catch {
        // Ignore background refresh failures and let normal auth paths handle logout.
      } finally {
        sessionRefreshInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void refreshSessionToken();
    }, 8 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [token, refreshToken, uiPrefs.sessionDuration]);

  useEffect(() => {
    if (!token || selectedServerId || servers.length === 0) {
      return;
    }
    void onSelectServer(servers[0]!.id);
  }, [token, selectedServerId, servers]);

  useEffect(() => {
    if (
      !token ||
      leftRailTab !== "dms" ||
      selectedDmId ||
      dmConversations.length === 0
    ) {
      return;
    }
    void onSelectDm(dmConversations[0]!.id);
  }, [token, leftRailTab, selectedDmId, dmConversations]);

  useEffect(() => {
    if (!token || messages.length === 0) {
      return;
    }

    const urls = [
      ...new Set(messages.flatMap((message) => extractUrls(message.body))),
    ];
    const missing = urls.filter((url) => !linkPreviews[url]);

    if (missing.length === 0) {
      return;
    }

    void (async () => {
      try {
        const result = await api.fetchLinkPreviews(token, missing);
        setLinkPreviews((prev) => {
          const next = { ...prev };
          for (const preview of result.previews) {
            next[preview.url] = preview;
          }
          return next;
        });
      } catch {
        // Preview loading failures should not block message rendering.
      }
    })();
  }, [token, messages, linkPreviews]);

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }

    if (galleryImages.length === 0 || lightboxIndex >= galleryImages.length) {
      setLightboxIndex(null);
    }
  }, [galleryImages, lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex === null || galleryImages.length === 0) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxIndex(null);
      }
      if (event.key === "ArrowLeft") {
        setLightboxIndex((prev) => {
          if (prev === null) {
            return prev;
          }
          return (prev - 1 + galleryImages.length) % galleryImages.length;
        });
      }
      if (event.key === "ArrowRight") {
        setLightboxIndex((prev) => {
          if (prev === null) {
            return prev;
          }
          return (prev + 1) % galleryImages.length;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, galleryImages.length]);

  useEffect(() => {
    if (!token || !selectedCollectionId) {
      setCollectionItems([]);
      return;
    }

    void (async () => {
      try {
        const result = await api.collectionItems(token, selectedCollectionId);
        setCollectionItems(result.items);
      } catch {
        setCollectionItems([]);
      }
    })();
  }, [token, selectedCollectionId]);

  useEffect(() => {
    const activeIds = new Set(activeLibraryItems.map((item) => item.id));
    setSelectedLibraryItemIds((prev) => prev.filter((id) => activeIds.has(id)));
  }, [activeLibraryItems]);

  useEffect(() => {
    if (libraryScope === "collection" && librarySort !== "manual") {
      setLibrarySort("manual");
    }
  }, [libraryScope, librarySort]);

  useEffect(() => {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefs));
  }, [uiPrefs]);

  useEffect(() => {
    localStorage.setItem(
      CHANNEL_MODULE_CONFIG_KEY,
      JSON.stringify(channelModuleConfigs),
    );
  }, [channelModuleConfigs]);

  useEffect(() => {
    localStorage.setItem(
      COLUMN_LAYOUT_KEY,
      JSON.stringify({
        centerMinWidth: centerColumnMinWidth,
        rightWidth: rightColumnWidth,
      }),
    );
  }, [centerColumnMinWidth, rightColumnWidth]);

  useEffect(() => {
    if (!selectedChannelId) {
      return;
    }
    setChannelModuleConfigs((prev) => {
      if (prev[selectedChannelId]) {
        return prev;
      }
      return {
        ...prev,
        [selectedChannelId]: defaultChannelModuleConfig(),
      };
    });
  }, [selectedChannelId]);

  useEffect(() => {
    setChannelSettingsName(selectedChannel?.name ?? "");
  }, [selectedChannel?.id, selectedChannel?.name]);

  useEffect(() => {
    if (!user) {
      return;
    }
    setProfileForm({
      name: user.name ?? "",
      handle: user.handle ?? "",
      email: user.email ?? "",
      bio: user.bio ?? "",
      avatarUrl: user.avatar_url ?? "",
      avatarThumbUrl: user.avatar_thumb_url ?? "",
      homeServerId: user.home_server_id ?? "",
    });
  }, [user]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (
        !accountMenuRef.current ||
        accountMenuRef.current.contains(event.target as Node)
      ) {
        return;
      }
      setAccountMenuOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!user || uiPrefs.onboarded) {
      return;
    }
    setCenterPane("account");
    setAccountView("accessibility");
  }, [user, uiPrefs.onboarded]);

  async function bootstrap(nextToken: string) {
    try {
      setBusy(true);
      const meResult = await api.me(nextToken);
      const serverResult = await api.servers(nextToken);
      const unreadResult = await api.unread(nextToken);
      const userCommandResult = await api.userCommands(nextToken);
      const dmResult = await api.dmConversations(nextToken);

      setUser(meResult.user);
      setServers(serverResult.servers);
      setUnread(unreadResult.unread);
      setUserCommands(userCommandResult.commands);
      setDmConversations(dmResult.conversations);

      if (serverResult.servers.length > 0) {
        const firstServer = serverResult.servers[0]!;
        setSelectedServerId(firstServer.id);
        await loadServerAdminData(nextToken, firstServer.id);
        await loadLibraryAndCollections(nextToken, firstServer.id);
        await loadChannels(nextToken, firstServer.id);
      }
    } catch (cause) {
      if (refreshToken) {
        try {
          const refreshed = await api.refresh({ refreshToken });
          localStorage.setItem(
            TOKEN_KEY,
            refreshed.accessToken ?? refreshed.token,
          );
          if (refreshed.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, refreshed.refreshToken);
            setRefreshToken(refreshed.refreshToken);
          }
          setToken(refreshed.accessToken ?? refreshed.token);
          setUser(refreshed.user);
          return;
        } catch {
          // Fall through to full logout if refresh fails.
        }
      }

      setError(
        cause instanceof Error ? cause.message : "Failed to load session",
      );
      await logout();
    } finally {
      setBusy(false);
    }
  }

  async function loadChannels(nextToken: string, serverId: string) {
    const channelResult = await api.channels(nextToken, serverId);
    const serverCommandResult = await api.serverCommands(nextToken, serverId);
    setChannels(channelResult.channels);
    setServerCommands(serverCommandResult.commands);

    if (channelResult.channels.length > 0) {
      const firstChannel = channelResult.channels[0]!;
      setSelectedChannelId(firstChannel.id);
      setSelectedThreadRootId("");
      setThreadMessages([]);
      await loadLibraryAndCollections(nextToken, serverId);
      await loadMessages(nextToken, firstChannel.id);
    } else {
      setSelectedChannelId("");
      setMessages([]);
      setSelectedThreadRootId("");
      setThreadMessages([]);
      await loadLibraryAndCollections(nextToken, serverId);
    }
  }

  async function loadMessages(nextToken: string, channelId: string) {
    const messageResult = await api.messages(nextToken, channelId);
    const preferenceResult = await api.channelPreference(nextToken, channelId);
    setMessages(messageResult.messages);
    setChannelMode(preferenceResult.preference.mode);
  }

  async function loadDmConversations(nextToken: string) {
    const dmResult = await api.dmConversations(nextToken);
    setDmConversations(dmResult.conversations);
  }

  async function loadDmMessages(nextToken: string, conversationId: string) {
    const result = await api.dmMessages(nextToken, conversationId);
    setMessages(result.messages);
  }

  async function loadLibraryAndCollections(
    nextToken: string,
    serverId: string,
  ) {
    const [libraryResult, collectionResult] = await Promise.all([
      api.libraryItems(nextToken, serverId),
      api.collections(nextToken, serverId),
    ]);

    setLibraryItems(libraryResult.items);
    setCollections(collectionResult.collections);

    setSelectedCollectionId((prev) => {
      if (collectionResult.collections.length === 0) {
        return "";
      }
      if (
        prev &&
        collectionResult.collections.some(
          (collection) => collection.id === prev,
        )
      ) {
        return prev;
      }
      return collectionResult.collections[0]!.id;
    });
  }

  async function loadServerAdminData(nextToken: string, serverId: string) {
    try {
      const [inviteResult, memberResult] = await Promise.all([
        api.invites(nextToken, serverId),
        api.serverMembers(nextToken, serverId),
      ]);
      setInvites(inviteResult.invites);
      setMembers(memberResult.members);
    } catch {
      setInvites([]);
      setMembers([]);
    }
  }

  async function onAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (mode === "forgot") {
      return;
    }

    try {
      setBusy(true);
      const result =
        mode === "login"
          ? await api.login({
              email: authForm.email,
              password: authForm.password,
            })
          : await api.register({
              email: authForm.email,
              password: authForm.password,
              name: authForm.name,
              handle: authForm.handle,
            });

      const accessToken = result.accessToken ?? result.token;
      localStorage.setItem(TOKEN_KEY, accessToken);
      if (result.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
        setRefreshToken(result.refreshToken);
      }
      setToken(accessToken);
      setUser(result.user);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Authentication failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onRequestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!forgotEmail.trim()) {
      return;
    }

    try {
      setBusy(true);
      const result = await api.forgotPassword({
        email: forgotEmail.trim().toLowerCase(),
      });
      setResetTokenPreview(result.resetToken ?? "");
      setResetTokenExpiresAt(result.expiresAt ?? "");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to request password reset",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetToken.trim() || !resetNewPassword.trim()) {
      return;
    }

    try {
      setBusy(true);
      await api.resetPassword({
        token: resetToken.trim(),
        newPassword: resetNewPassword.trim(),
      });
      setError("");
      setMode("login");
      setResetToken("");
      setResetNewPassword("");
      setResetTokenPreview("");
      setResetTokenExpiresAt("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to reset password",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onCreateServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !serverName.trim()) {
      return;
    }

    try {
      setBusy(true);
      await api.createServer(token, { name: serverName.trim() });
      setServerName("");
      await bootstrap(token);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to create server",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedServerId || !channelName.trim()) {
      return;
    }

    try {
      setBusy(true);
      await api.createChannel(token, selectedServerId, {
        name: channelName.trim(),
      });
      setChannelName("");
      await loadChannels(token, selectedServerId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to create channel",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onCreateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedServerId) {
      return;
    }

    try {
      setBusy(true);
      await api.createInvite(token, selectedServerId, {
        roleToGrant: inviteRoleToGrant,
        maxUses: inviteMaxUses.trim() ? Number(inviteMaxUses) : undefined,
        expiresInHours: inviteExpiresHours.trim()
          ? Number(inviteExpiresHours)
          : undefined,
      });
      setInviteMaxUses("");
      setInviteExpiresHours("");
      await loadServerAdminData(token, selectedServerId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to create invite",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onJoinInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !joinInviteCode.trim()) {
      return;
    }

    try {
      setBusy(true);
      const code = joinInviteCode.trim();
      const info = await api.inviteInfo(token, code);

      if (info.invite.is_member) {
        setSelectedServerId(info.invite.server_id);
        await loadServerAdminData(token, info.invite.server_id);
        await loadChannels(token, info.invite.server_id);
      } else {
        const accepted = await api.acceptInvite(token, code);
        await bootstrap(token);
        setSelectedServerId(accepted.serverId);
        await loadServerAdminData(token, accepted.serverId);
        await loadChannels(token, accepted.serverId);
      }

      setJoinInviteCode("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to join invite",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = composer.trim();
    const mediaItemIds = pendingMedia.map((media) => media.id);

    if (!token) {
      return;
    }

    const isDmMode = leftRailTab === "dms";
    if (isDmMode && !selectedDmId) {
      return;
    }
    if (!isDmMode && !selectedChannelId) {
      return;
    }

    if (isDmMode) {
      if (!body) {
        setError("Write a message.");
        return;
      }
    } else if (!body && mediaItemIds.length === 0) {
      setError("Write a message or attach at least one file.");
      return;
    }

    try {
      setBusy(true);
      if (isDmMode) {
        await api.createDmMessage(token, selectedDmId, { body });
      } else {
        await api.createMessage(token, selectedChannelId, {
          body,
          mediaItemIds,
        });
      }
      setComposer("");
      setPendingMedia([]);
      if (isDmMode) {
        await loadDmMessages(token, selectedDmId);
        await loadDmConversations(token);
      } else {
        await loadMessages(token, selectedChannelId);
        const unreadResult = await api.unread(token);
        setUnread(unreadResult.unread);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to send message",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !token || !selectedChannelId || leftRailTab === "dms") {
      return;
    }

    try {
      setBusy(true);
      const result = await api.uploadToChannel(token, selectedChannelId, file);
      setPendingMedia((prev) => [...prev, result.media]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to upload file",
      );
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function onOpenThread(rootMessageId: string) {
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      setSelectedThreadRootId(rootMessageId);
      const result = await api.threadMessages(token, rootMessageId);
      setThreadMessages(result.messages);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load thread",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSendThreadMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedThreadRootId || !threadComposer.trim()) {
      return;
    }

    try {
      setBusy(true);
      await api.createThreadMessage(token, selectedThreadRootId, {
        body: threadComposer.trim(),
      });
      setThreadComposer("");
      const result = await api.threadMessages(token, selectedThreadRootId);
      setThreadMessages(result.messages);
      if (selectedChannelId) {
        await loadMessages(token, selectedChannelId);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to post thread message",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSaveChannelPreference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedChannelId) {
      return;
    }

    const hours = Number(channelSnoozeHours || "0");
    const snoozedUntil =
      Number.isFinite(hours) && hours > 0
        ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
        : null;

    try {
      setBusy(true);
      if (
        channelSettingsName.trim() &&
        channelSettingsName.trim() !== (selectedChannel?.name ?? "")
      ) {
        await api.updateChannel(token, selectedChannelId, {
          name: channelSettingsName.trim(),
        });
      }
      await api.updateChannelPreference(token, selectedChannelId, {
        mode: channelMode,
        snoozedUntil,
      });
      setChannelSettingsOpen(false);
      const unreadResult = await api.unread(token);
      setUnread(unreadResult.unread);
      if (selectedServerId) {
        await loadChannels(token, selectedServerId);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to update channel preference",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSearchMessages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !searchQuery.trim()) {
      return;
    }

    try {
      setBusy(true);
      const result = await api.searchMessages(token, {
        q: searchQuery.trim(),
        serverId: selectedServerId || undefined,
        channelId: selectedChannelId || undefined,
      });
      setSearchResults(result.results);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function onEditMessage(messageId: string, nextBody: string) {
    if (!token || !selectedChannelId) {
      return;
    }

    try {
      setBusy(true);
      await api.updateMessage(token, messageId, { body: nextBody.trim() });
      await loadMessages(token, selectedChannelId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to edit message");
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  function getLibraryThumbnail(item: LibraryItem) {
    if (item.item_type === "media") {
      return item.media_url ?? null;
    }
    return item.preview_image_url ?? null;
  }

  function moveLibraryItem(
    items: LibraryItem[],
    draggedId: string,
    targetId: string,
  ) {
    const fromIndex = items.findIndex((item) => item.id === draggedId);
    const toIndex = items.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return items;
    }
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) {
      return items;
    }
    next.splice(toIndex, 0, moved);
    return next;
  }

  async function persistCollectionOrder(nextItems: LibraryItem[]) {
    if (!token || !selectedCollectionId) {
      return;
    }

    const orderedIds = nextItems.map((item) => item.id);
    try {
      setBusy(true);
      await api.reorderCollectionItems(token, selectedCollectionId, orderedIds);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Failed to save collection order";
      const routeMissing =
        message.includes("Route PATCH") &&
        message.includes("/items/order") &&
        message.includes("not found");
      if (routeMissing) {
        setError(
          "Drag order updated locally. Restart API to enable saved reorder (`/items/order`).",
        );
        return;
      }
      setError(message);
      try {
        const result = await api.collectionItems(token, selectedCollectionId);
        setCollectionItems(result.items);
      } catch {
        setCollectionItems([]);
      }
    } finally {
      setBusy(false);
    }
  }

  function onSelectAllFilteredLibraryItems() {
    const ids = filteredLibraryItems.map((item) => item.id);
    setSelectedLibraryItemIds((prev) => [...new Set([...prev, ...ids])]);
  }

  function onSetMetadataDraft(item: LibraryItem) {
    setEditingLibraryItem(item);
    setMetadataTitleDraft(
      decodeHtmlEntities(item.title || item.preview_title || ""),
    );
    setMetadataDescriptionDraft(
      decodeHtmlEntities(item.description || item.preview_description || ""),
    );
    setMetadataTermsDraft((item.taxonomy_terms ?? []).join(", "));
  }

  function onApplySuggestedTerm(term: string) {
    const currentTerms = metadataTermsDraft
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    if (currentTerms.includes(term.toLowerCase())) {
      return;
    }
    const next = [...currentTerms, term.toLowerCase()];
    setMetadataTermsDraft(next.join(", "));
  }

  async function onSaveLibraryMetadata() {
    if (!token || !editingLibraryItem) {
      return;
    }

    const taxonomyTerms = metadataTermsDraft
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);

    try {
      setBusy(true);
      const result = await api.updateLibraryItem(token, editingLibraryItem.id, {
        title: metadataTitleDraft.trim() || null,
        description: metadataDescriptionDraft.trim() || null,
        taxonomyTerms,
      });
      const patch = result.item;
      setLibraryItems((prev) =>
        prev.map((item) =>
          item.id === editingLibraryItem.id
            ? {
                ...item,
                title: patch.title ?? null,
                description: patch.description ?? null,
                taxonomy_terms: patch.taxonomy_terms ?? [],
              }
            : item,
        ),
      );
      setCollectionItems((prev) =>
        prev.map((item) =>
          item.id === editingLibraryItem.id
            ? {
                ...item,
                title: patch.title ?? null,
                description: patch.description ?? null,
                taxonomy_terms: patch.taxonomy_terms ?? [],
              }
            : item,
        ),
      );
      setEditingLibraryItem(null);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Failed to save metadata";
      const missingMetadataRoutes =
        message.includes("Route") &&
        message.includes("/api/library/items/") &&
        message.includes("not found");
      if (missingMetadataRoutes) {
        setError(
          "Metadata save route is unavailable on the running API. Restart/rebuild the API service, then try again.",
        );
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onAddFilteredToCollection() {
    if (!token || !selectedCollectionId || filteredLibraryItems.length === 0) {
      return;
    }
    const ids = filteredLibraryItems.map((item) => item.id).slice(0, 100);
    try {
      setBusy(true);
      await api.addCollectionItems(token, selectedCollectionId, ids);
      const result = await api.collectionItems(token, selectedCollectionId);
      setCollectionItems(result.items);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to add filtered items",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onApplyTaxonomyTerm(termInput?: string) {
    const term = (termInput ?? taxonomyQuickInput).trim().toLowerCase();
    if (!term) {
      return;
    }

    if (selectedLibraryItems.length === 0) {
      setError(
        'Select one or more library cards to apply a term, or use "Use As Filter".',
      );
      return;
    }

    await onApplyTaxonomyTermToItems(term, selectedLibraryItems);
    setTaxonomyQuickInput("");
  }

  async function onApplyTaxonomyTermToFiltered() {
    const term = taxonomyQuickInput.trim().toLowerCase();
    if (!term || filteredLibraryItems.length === 0) {
      return;
    }
    await onApplyTaxonomyTermToItems(term, filteredLibraryItems.slice(0, 100));
    setTaxonomyQuickInput("");
  }

  async function onApplyTaxonomyTermToItems(
    term: string,
    items: LibraryItem[],
  ) {
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      for (const item of items) {
        const mergedTerms = [
          ...new Set([
            ...(item.taxonomy_terms ?? []).map((value) => value.toLowerCase()),
            term,
          ]),
        ];
        const result = await api.updateLibraryItem(token, item.id, {
          taxonomyTerms: mergedTerms,
        });
        const patch = result.item;
        setLibraryItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? { ...entry, taxonomy_terms: patch.taxonomy_terms ?? [] }
              : entry,
          ),
        );
        setCollectionItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? { ...entry, taxonomy_terms: patch.taxonomy_terms ?? [] }
              : entry,
          ),
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to apply taxonomy term",
      );
    } finally {
      setBusy(false);
    }
  }

  function onUseTaxonomyTermAsFilter() {
    const term = taxonomyQuickInput.trim().toLowerCase();
    if (!term) {
      return;
    }
    setLibraryTaxonomyFilter(term);
  }

  function onTaxonomySuggestionClick(term: string) {
    if (selectedLibraryItems.length > 0) {
      void onApplyTaxonomyTerm(term);
      return;
    }
    setTaxonomyQuickInput(term);
  }

  function onClearLibrarySelection() {
    setSelectedLibraryItemIds([]);
  }

  function onLibraryItemDragStart(event: DragEvent<Element>, itemId: string) {
    if (!canReorderCollection) {
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    setDraggingLibraryItemId(itemId);
  }

  function onLibraryItemDragOver(event: DragEvent<Element>, itemId: string) {
    if (
      !canReorderCollection ||
      !draggingLibraryItemId ||
      draggingLibraryItemId === itemId
    ) {
      return;
    }
    event.preventDefault();
    setDragOverLibraryItemId(itemId);
  }

  function onLibraryItemDragEnd() {
    setDraggingLibraryItemId(null);
    setDragOverLibraryItemId(null);
  }

  async function onLibraryItemDrop(event: DragEvent<Element>, itemId: string) {
    event.preventDefault();
    if (
      !canReorderCollection ||
      !draggingLibraryItemId ||
      draggingLibraryItemId === itemId
    ) {
      onLibraryItemDragEnd();
      return;
    }
    const next = moveLibraryItem(
      collectionItems,
      draggingLibraryItemId,
      itemId,
    );
    setCollectionItems(next);
    onLibraryItemDragEnd();
    await persistCollectionOrder(next);
  }

  async function onCreateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedServerId || !collectionName.trim()) {
      return;
    }

    try {
      setBusy(true);
      const result = await api.createCollection(token, {
        serverId: selectedServerId,
        name: collectionName.trim(),
        visibility: collectionVisibility,
      });
      setCollectionName("");
      await loadLibraryAndCollections(token, selectedServerId);
      setSelectedCollectionId(result.collection.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to create collection",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onAddSelectedToCollection() {
    if (
      !token ||
      !selectedCollectionId ||
      selectedLibraryItemIds.length === 0
    ) {
      return;
    }

    try {
      setBusy(true);
      await api.addCollectionItems(
        token,
        selectedCollectionId,
        selectedLibraryItemIds,
      );
      setSelectedLibraryItemIds([]);
      const result = await api.collectionItems(token, selectedCollectionId);
      setCollectionItems(result.items);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to add items to collection",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveSelectedFromCollection() {
    if (
      !token ||
      !selectedCollectionId ||
      selectedLibraryItemIds.length === 0
    ) {
      return;
    }

    try {
      setBusy(true);
      await api.removeCollectionItems(
        token,
        selectedCollectionId,
        selectedLibraryItemIds,
      );
      setSelectedLibraryItemIds([]);
      const result = await api.collectionItems(token, selectedCollectionId);
      setCollectionItems(result.items);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to remove items from collection",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSelectServer(serverId: string) {
    if (!token) {
      return;
    }

    setSelectedServerId(serverId);
    await loadServerAdminData(token, serverId);
    await loadChannels(token, serverId);
  }

  async function onSelectChannel(channelId: string) {
    if (!token) {
      return;
    }

    setLeftRailTab("channels");
    setSelectedDmId("");
    setSelectedChannelId(channelId);
    setChannelSettingsOpen(false);
    setCenterPane("chat");
    setSelectedThreadRootId("");
    setThreadMessages([]);
    if (selectedServerId) {
      await loadLibraryAndCollections(token, selectedServerId);
    }
    await loadMessages(token, channelId);
    const unreadResult = await api.unread(token);
    setUnread(unreadResult.unread);
  }

  async function onSelectDm(conversationId: string) {
    if (!token) {
      return;
    }

    setLeftRailTab("dms");
    setSelectedDmId(conversationId);
    setCenterPane("chat");
    setChannelSettingsOpen(false);
    setPendingMedia([]);
    setSelectedThreadRootId("");
    setThreadMessages([]);
    const dmResult = await api.dmMessages(token, conversationId);
    setMessages(dmResult.messages);
    const latestMessageId =
      dmResult.messages[dmResult.messages.length - 1]?.id;
    await api.markDmRead(token, conversationId, {
      lastReadMessageId: latestMessageId,
    });
    await loadDmConversations(token);
  }

  async function onCreateDm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !dmHandleInput.trim()) {
      return;
    }

    try {
      setBusy(true);
      const result = await api.createDmConversation(token, {
        handle: dmHandleInput.trim().replace(/^@+/, ""),
      });
      setDmHandleInput("");
      setSelectedDmId(result.conversation.id);
      setLeftRailTab("dms");
      setCenterPane("chat");
      await loadDmConversations(token);
      await loadDmMessages(token, result.conversation.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to start DM");
    } finally {
      setBusy(false);
    }
  }

  async function onMessageListBottomStateChange(atBottom: boolean) {
    if (!atBottom || !token || messages.length === 0) {
      return;
    }

    const latestMessageId = messages[messages.length - 1]?.id;
    if (!latestMessageId) {
      return;
    }

    if (leftRailTab === "dms") {
      if (!selectedDmId) {
        return;
      }
      const inFlightKey = `dm:${selectedDmId}:${latestMessageId}`;
      if (markReadInFlightRef.current === inFlightKey) {
        return;
      }
      markReadInFlightRef.current = inFlightKey;
      try {
        await api.markDmRead(token, selectedDmId, {
          lastReadMessageId: latestMessageId,
        });
        await loadDmConversations(token);
      } catch {
        // Non-blocking.
      } finally {
        if (markReadInFlightRef.current === inFlightKey) {
          markReadInFlightRef.current = null;
        }
      }
      return;
    }

    if (
      !selectedChannelId ||
      !selectedChannelModuleConfig.notifications.autoMarkReadAtBottom
    ) {
      return;
    }

    const unreadCount = unreadCountByChannel.get(selectedChannelId) ?? 0;
    const lastMarked =
      lastMarkedReadByChannelRef.current[selectedChannelId] ?? "";
    const inFlightKey = `${selectedChannelId}:${latestMessageId}`;

    if (markReadInFlightRef.current === inFlightKey) {
      return;
    }
    if (unreadCount === 0 && lastMarked === latestMessageId) {
      return;
    }

    markReadInFlightRef.current = inFlightKey;

    try {
      await api.markChannelRead(token, selectedChannelId, {
        lastReadMessageId: latestMessageId,
      });
      lastMarkedReadByChannelRef.current[selectedChannelId] = latestMessageId;
      const unreadResult = await api.unread(token);
      setUnread(unreadResult.unread);
    } catch {
      // Non-blocking: read-state sync can fail transiently without breaking chat.
    } finally {
      if (markReadInFlightRef.current === inFlightKey) {
        markReadInFlightRef.current = null;
      }
    }
  }

  async function logout() {
    if (refreshToken) {
      try {
        await api.logout({ refreshToken });
      } catch {
        // Client cleanup should continue even if logout call fails.
      }
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken("");
    setRefreshToken("");
    setUser(null);
    setServers([]);
    setChannels([]);
    setMessages([]);
    setPendingMedia([]);
    setSelectedThreadRootId("");
    setThreadMessages([]);
    setThreadComposer("");
    setLinkPreviews({});
    setSearchQuery("");
    setSearchResults([]);
    setLibraryItems([]);
    setCollectionItems([]);
    setCollections([]);
    setCollectionName("");
    setSelectedCollectionId("");
    setSelectedLibraryItemIds([]);
    setLibraryScope("all");
    setLibraryQuery("");
    setLibraryTypeFilter("all");
    setLibraryPosterFilter("all");
    setLibraryTaxonomyFilter("all");
    setLibraryDateFrom("");
    setLibraryDateTo("");
    setLibrarySort("newest");
    setEditingLibraryItem(null);
    setMetadataTitleDraft("");
    setMetadataDescriptionDraft("");
    setMetadataTermsDraft("");
    setDraggingLibraryItemId(null);
    setDragOverLibraryItemId(null);
    setInvites([]);
    setMembers([]);
    setJoinInviteCode("");
    setInviteMaxUses("");
    setInviteExpiresHours("");
    setUserCommands([]);
    setServerCommands([]);
    setSelectedChannelId("");
    setSelectedServerId("");
  }

  async function onCreateUserCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !token ||
      !userCommandForm.command.trim() ||
      !userCommandForm.responseText.trim()
    ) {
      return;
    }

    try {
      setBusy(true);
      await api.createUserCommand(token, {
        command: userCommandForm.command.trim(),
        responseText: userCommandForm.responseText.trim(),
      });
      setUserCommandForm({ command: "", responseText: "" });
      const result = await api.userCommands(token);
      setUserCommands(result.commands);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to create user command",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onCreateServerCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !token ||
      !selectedServerId ||
      !serverCommandForm.command.trim() ||
      !serverCommandForm.responseText.trim()
    ) {
      return;
    }

    try {
      setBusy(true);
      await api.createServerCommand(token, selectedServerId, {
        command: serverCommandForm.command.trim(),
        responseText: serverCommandForm.responseText.trim(),
      });
      setServerCommandForm({ command: "", responseText: "" });
      const result = await api.serverCommands(token, selectedServerId);
      setServerCommands(result.commands);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to create server command",
      );
    } finally {
      setBusy(false);
    }
  }

  function onOpenLightbox(attachmentId: string) {
    const index = galleryImages.findIndex((image) => image.id === attachmentId);
    if (index >= 0) {
      setLightboxIndex(index);
    }
  }

  function onOpenAccountView(view: "profile" | "settings" | "accessibility") {
    setAccountView(view);
    setCenterPane("account");
    setChannelSettingsOpen(false);
    setAccountMenuOpen(false);
  }

  function updateSelectedChannelModuleConfig(
    updater: (prev: ChannelModuleConfig) => ChannelModuleConfig,
  ) {
    if (!selectedChannelId) {
      return;
    }
    setChannelModuleConfigs((prev) => {
      const current = prev[selectedChannelId] ?? defaultChannelModuleConfig();
      return {
        ...prev,
        [selectedChannelId]: updater(current),
      };
    });
  }

  function onDownloadChannelModuleConfig() {
    if (!selectedChannelId || !selectedChannel) {
      return;
    }
    const payload = {
      format: "tincan-channel-module-config-v1",
      exportedAt: new Date().toISOString(),
      channelId: selectedChannelId,
      channelName: selectedChannel.name,
      config: selectedChannelModuleConfig,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const safeName = selectedChannel.name.replace(/[^a-z0-9-_]+/gi, "-");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tincan-channel-config-${safeName || selectedChannelId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function onUploadChannelModuleConfigFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedChannelId) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { config?: unknown };
      const safeConfig = sanitizeChannelModuleConfig(parsed.config ?? parsed);
      if (!safeConfig) {
        setError("Invalid channel module config file.");
        return;
      }
      setChannelModuleConfigs((prev) => ({
        ...prev,
        [selectedChannelId]: safeConfig,
      }));
      setError("");
    } catch {
      setError("Could not read channel module config file.");
    }
  }

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      const result = await api.updateMe(token, {
        name: profileForm.name.trim(),
        handle: profileForm.handle.trim(),
        email: profileForm.email.trim().toLowerCase(),
        bio: profileForm.bio.trim() || null,
        avatarUrl: profileForm.avatarUrl.trim() || null,
        avatarThumbUrl: profileForm.avatarThumbUrl.trim() || null,
        homeServerId: profileForm.homeServerId || null,
      });
      setUser(result.user);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to save profile",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onUploadAvatarFile(file: File) {
    if (!token) {
      return;
    }
    try {
      setBusy(true);
      const uploaded = await api.uploadProfilePhoto(token, file);
      const avatarUrl = uploaded.photo.public_url;
      const result = await api.updateMe(token, {
        avatarUrl,
        avatarThumbUrl: avatarUrl,
      });
      setUser(result.user);
      setProfileForm((prev) => ({
        ...prev,
        avatarUrl,
        avatarThumbUrl: avatarUrl,
      }));
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to upload avatar",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    if (
      changePasswordForm.newPassword !== changePasswordForm.confirmNewPassword
    ) {
      setError("New passwords do not match");
      return;
    }

    try {
      setBusy(true);
      await api.changePassword(token, {
        currentPassword: changePasswordForm.currentPassword,
        newPassword: changePasswordForm.newPassword,
      });
      setChangePasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      setError("Password updated. Please log in again.");
      await logout();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to change password",
      );
    } finally {
      setBusy(false);
    }
  }

  function onRailTabChange(tab: RailTab) {
    setLeftRailTab(tab);
    if (tab === "design") {
      setCenterPane("design");
      setChannelSettingsOpen(false);
    } else if (tab === "dms") {
      setCenterPane("chat");
      setChannelSettingsOpen(false);
      setPendingMedia([]);
      if (token) {
        void loadDmConversations(token);
      }
    } else {
      setCenterPane((prev) => (prev === "design" ? "chat" : prev));
    }
  }

  function startColumnResize(
    type: "center" | "right",
    event: ReactMouseEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    const startX = event.clientX;
    const startCenter = centerColumnMinWidth;
    const startRight = rightColumnWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const staticCols = 56 + 240 + 16;
      if (type === "center") {
        const maxCenter = Math.max(
          360,
          window.innerWidth - staticCols - rightColumnWidth - 260,
        );
        setCenterColumnMinWidth(
          Math.min(maxCenter, Math.max(360, startCenter + delta)),
        );
      } else {
        const nextRight = Math.min(560, Math.max(220, startRight - delta));
        const maxCenter = Math.max(
          360,
          window.innerWidth - staticCols - nextRight - 260,
        );
        setRightColumnWidth(nextRight);
        if (centerColumnMinWidth > maxCenter) {
          setCenterColumnMinWidth(maxCenter);
        }
      }
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.classList.remove("is-col-resizing");
    };

    document.body.classList.add("is-col-resizing");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  if (!token || !user) {
    return (
      <AuthShell
        mode={mode}
        setMode={setMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        forgotEmail={forgotEmail}
        setForgotEmail={setForgotEmail}
        resetToken={resetToken}
        setResetToken={setResetToken}
        resetNewPassword={resetNewPassword}
        setResetNewPassword={setResetNewPassword}
        resetTokenPreview={resetTokenPreview}
        resetTokenExpiresAt={resetTokenExpiresAt}
        busy={busy}
        error={error}
        onAuthSubmit={onAuthSubmit}
        onRequestPasswordReset={onRequestPasswordReset}
        onResetPassword={onResetPassword}
      />
    );
  }

  return (
    <main
      className={`app-shell size-${uiPrefs.textSize} contrast-${uiPrefs.contrast}`}
      style={
        {
          ...(selectedChannelThemeStyle ?? {}),
          "--center-col-min": `${centerColumnMinWidth}px`,
          "--right-col-width": `${rightColumnWidth}px`,
        } as CSSProperties
      }
    >
      <Rail activeTab={leftRailTab} onTabChange={onRailTabChange} />

      <SidebarPanel
        activeTab={leftRailTab}
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectServer={(id) => void onSelectServer(id)}
        serverName={serverName}
        setServerName={setServerName}
        onCreateServer={onCreateServer}
        joinInviteCode={joinInviteCode}
        setJoinInviteCode={setJoinInviteCode}
        onJoinInvite={onJoinInvite}
        inviteRoleToGrant={inviteRoleToGrant}
        setInviteRoleToGrant={setInviteRoleToGrant}
        inviteMaxUses={inviteMaxUses}
        setInviteMaxUses={setInviteMaxUses}
        inviteExpiresHours={inviteExpiresHours}
        setInviteExpiresHours={setInviteExpiresHours}
        onCreateInvite={onCreateInvite}
        invites={invites}
        members={members}
        selectedServer={selectedServer}
        channels={channels}
        selectedChannelId={selectedChannelId}
        onSelectChannel={(id) => void onSelectChannel(id)}
        unreadCountByChannel={unreadCountByChannel}
        mentionCountByChannel={mentionCountByChannel}
        unreadBadgeCountByChannel={unreadBadgeCountByChannel}
        showUnreadOnly={showUnreadOnly}
        setShowUnreadOnly={setShowUnreadOnly}
        visibleChannels={visibleChannels}
        channelName={channelName}
        setChannelName={setChannelName}
        onCreateChannel={onCreateChannel}
        canCreateChannels={canCreateChannels}
        dmConversations={dmConversations}
        selectedDmId={selectedDmId}
        onSelectDm={(id) => void onSelectDm(id)}
        dmHandleInput={dmHandleInput}
        setDmHandleInput={setDmHandleInput}
        onCreateDm={onCreateDm}
      />

      <div
        className="column-resizer"
        role="separator"
        aria-label="Resize center column"
        onMouseDown={(event) => startColumnResize("center", event)}
      />

      <section className="flex flex-col overflow-hidden border-r border-border bg-background min-w-0">
        {/* ── Global toolbar: search + library toggle + account menu ── */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <form
              autoComplete="off"
              className="flex gap-1.5 flex-1 min-w-0"
              onSubmit={onSearchMessages}
            >
              <Input
                placeholder="Search messages…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-8 text-sm"
              />
              <Button
                type="submit"
                size=""
                variant="secondary"
                className="shrink-0"
              >
                Search
              </Button>
            </form>
            <Button
              type="button"
              size=""
              variant={centerPane === "library" ? "default" : "ghost"}
              onClick={() =>
                setCenterPane((prev) => {
                  const next = prev === "chat" ? "library" : "chat";
                  if (next === "library") setChannelSettingsOpen(false);
                  return next;
                })
              }
              className="shrink-0"
            >
              {centerPane === "chat" ? "Library" : "Chat"}
            </Button>
          </div>
          <AccountMenu
            user={user}
            open={accountMenuOpen}
            setOpen={setAccountMenuOpen}
            menuRef={accountMenuRef}
            onProfile={() => onOpenAccountView("profile")}
            onSettings={() => onOpenAccountView("settings")}
            onAccessibility={() => onOpenAccountView("accessibility")}
            onLogout={() => {
              setAccountMenuOpen(false);
              void logout();
            }}
          />
        </div>

        {/* ── Search results ── */}
        {searchResults.length > 0 && (
          <div className="px-3 pt-2 pb-1 border-b border-border max-h-[200px] overflow-y-auto shrink-0">
            <div className="flex flex-col gap-1.5">
              {searchResults.slice(0, 6).map((result) => (
                <article
                  key={result.id}
                  className="rounded-md border border-border bg-card px-3 py-2 flex flex-col gap-0.5"
                >
                  <div className="flex items-center gap-2">
                    <strong className="text-xs font-semibold">
                      {result.author_name}
                    </strong>
                    <span className="text-[11px] text-muted-foreground">
                      #{result.channel_name}
                    </span>
                  </div>
                  <p className="text-xs text-foreground m-0 line-clamp-2">
                    {result.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* ── Channel header ── */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold m-0">
            {centerPane === "library"
              ? "Library"
              : centerPane === "design"
                ? "Design system"
                : centerPane === "account"
                  ? accountView === "profile"
                    ? "Profile"
                  : accountView === "settings"
                      ? "Settings"
                      : "Accessibility"
                  : leftRailTab === "dms"
                    ? selectedDmConversation
                      ? `@${selectedDmConversation.other_handle}`
                      : "Direct messages"
                  : selectedChannel
                    ? `#${selectedChannel.name}`
                    : "Pick a channel"}
          </h2>
          {centerPane === "chat" && leftRailTab === "channels" && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              aria-label="Channel settings"
              title="Channel alert settings"
              disabled={!selectedChannelId}
              onClick={() => setChannelSettingsOpen((prev) => !prev)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* ── Channel settings accordion ── */}
        {centerPane === "chat" && leftRailTab === "channels" && (
          <div
            className={`channel-settings-accordion${channelSettingsOpen ? " open" : ""}`}
            aria-hidden={!channelSettingsOpen}
          >
            <div className="channel-settings-content">
              <form
                autoComplete="off"
                className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-3 px-3 py-2.5 bg-muted/50 items-end"
                onSubmit={onSaveChannelPreference}
              >
                <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                  Channel name
                  <Input
                    value={channelSettingsName}
                    onChange={(event) => setChannelSettingsName(event.target.value)}
                    className="h-8"
                    placeholder="Channel name"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                  Mode
                  <select
                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={channelMode}
                    onChange={(event) =>
                      setChannelMode(
                        event.target.value as "hidden" | "passive" | "active",
                      )
                    }
                  >
                    <option value="passive">Passive</option>
                    <option value="active">Active</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                  Snooze (hours)
                  <Input
                    type="number"
                    min="0"
                    value={channelSnoozeHours}
                    onChange={(event) =>
                      setChannelSnoozeHours(event.target.value)
                    }
                    className="h-8"
                  />
                </label>
                <Button type="submit" size="sm" disabled={!selectedChannelId}>
                  Save
                </Button>
              </form>
              <section className="px-3 py-3 border-t border-border/70 bg-muted/40 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold m-0">
                      Channel Module Config
                    </h3>
                    <p className="text-[11px] text-muted-foreground m-0.5">
                      Per-channel module behavior with JSON import/export.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onDownloadChannelModuleConfig}
                      disabled={!selectedChannelId}
                    >
                      Download
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => channelConfigUploadRef.current?.click()}
                      disabled={!selectedChannelId}
                    >
                      Upload
                    </Button>
                    <input
                      ref={channelConfigUploadRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(event) => {
                        void onUploadChannelModuleConfigFile(event);
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedChannelModuleConfig.modules.dice}
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          modules: {
                            ...prev.modules,
                            dice: event.target.checked,
                          },
                        }))
                      }
                    />
                    Dice module
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedChannelModuleConfig.modules.surveys}
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          modules: {
                            ...prev.modules,
                            surveys: event.target.checked,
                          },
                        }))
                      }
                    />
                    Survey module
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedChannelModuleConfig.modules.musicEmbeds}
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          modules: {
                            ...prev.modules,
                            musicEmbeds: event.target.checked,
                          },
                        }))
                      }
                    />
                    Music embeds
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedChannelModuleConfig.modules.linkPreviews}
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          modules: {
                            ...prev.modules,
                            linkPreviews: event.target.checked,
                          },
                        }))
                      }
                    />
                    Link previews
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedChannelModuleConfig.modules.threads}
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          modules: {
                            ...prev.modules,
                            threads: event.target.checked,
                          },
                        }))
                      }
                    />
                    Thread replies
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        selectedChannelModuleConfig.notifications
                          .autoMarkReadAtBottom
                      }
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            autoMarkReadAtBottom: event.target.checked,
                          },
                        }))
                      }
                    />
                    Auto-mark read at bottom
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedChannelModuleConfig.ui.showAvatars}
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          ui: {
                            ...prev.ui,
                            showAvatars: event.target.checked,
                          },
                        }))
                      }
                    />
                    Show avatars
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        selectedChannelModuleConfig.notifications.showUnreadBadge
                      }
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            showUnreadBadge: event.target.checked,
                          },
                        }))
                      }
                    />
                    Show unread badge
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs max-w-[280px]">
                  Message density
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    value={selectedChannelModuleConfig.ui.messageDensity}
                    onChange={(event) =>
                      updateSelectedChannelModuleConfig((prev) => ({
                        ...prev,
                        ui: {
                          ...prev.ui,
                          messageDensity:
                            event.target.value === "compact"
                              ? "compact"
                              : "comfortable",
                        },
                      }))
                    }
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-[420px]">
                  <label className="flex items-center gap-2 text-xs">
                    Corner radius
                    <Input
                      type="number"
                      min="0"
                      max="96"
                      value={selectedChannelModuleConfig.ui.cornerRadiusPx}
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          ui: {
                            ...prev.ui,
                            cornerRadiusPx: Math.min(
                              96,
                              Math.max(0, Number(event.target.value || "0")),
                            ),
                          },
                        }))
                      }
                      className="h-7 w-20"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    Border thickness
                    <Input
                      type="number"
                      min="0"
                      max="24"
                      value={selectedChannelModuleConfig.ui.borderWidthPx}
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          ui: {
                            ...prev.ui,
                            borderWidthPx: Math.min(
                              24,
                              Math.max(0, Number(event.target.value || "0")),
                            ),
                          },
                        }))
                      }
                      className="h-7 w-20"
                    />
                  </label>
                </div>
                <div className="pt-2 border-t border-border/60 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={selectedChannelModuleConfig.ui.colorTheme.enabled}
                      onChange={(event) =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          ui: {
                            ...prev.ui,
                            colorTheme: {
                              ...prev.ui.colorTheme,
                              enabled: event.target.checked,
                            },
                          },
                        }))
                      }
                    />
                    Enable channel color theme
                  </label>
                  <div className="grid grid-cols-2 gap-3 max-w-[560px]">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor="channel-color-background-1">Background 1</label>
                      <label
                        htmlFor="channel-color-background-1"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <code className="text-[10px] text-muted-foreground min-w-[62px] text-right">
                          {selectedChannelModuleConfig.ui.colorTheme.backgroundBase}
                        </code>
                        <input
                          id="channel-color-background-1"
                          type="color"
                          value={selectedChannelModuleConfig.ui.colorTheme.backgroundBase}
                          onChange={(event) =>
                            updateSelectedChannelModuleConfig((prev) => ({
                              ...prev,
                              ui: {
                                ...prev.ui,
                                colorTheme: {
                                  ...prev.ui.colorTheme,
                                  backgroundBase: event.target.value.toUpperCase(),
                                },
                              },
                            }))
                          }
                          className="h-8 w-20 p-1 rounded border border-input bg-background cursor-pointer"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor="channel-color-background-2">Background 2</label>
                      <label
                        htmlFor="channel-color-background-2"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <code className="text-[10px] text-muted-foreground min-w-[62px] text-right">
                          {selectedChannelModuleConfig.ui.colorTheme.backgroundAlt}
                        </code>
                        <input
                          id="channel-color-background-2"
                          type="color"
                          value={selectedChannelModuleConfig.ui.colorTheme.backgroundAlt}
                          onChange={(event) =>
                            updateSelectedChannelModuleConfig((prev) => ({
                              ...prev,
                              ui: {
                                ...prev.ui,
                                colorTheme: {
                                  ...prev.ui.colorTheme,
                                  backgroundAlt: event.target.value.toUpperCase(),
                                },
                              },
                            }))
                          }
                          className="h-8 w-20 p-1 rounded border border-input bg-background cursor-pointer"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor="channel-color-main">Main color</label>
                      <label
                        htmlFor="channel-color-main"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <code className="text-[10px] text-muted-foreground min-w-[62px] text-right">
                          {selectedChannelModuleConfig.ui.colorTheme.main}
                        </code>
                        <input
                          id="channel-color-main"
                          type="color"
                          value={selectedChannelModuleConfig.ui.colorTheme.main}
                          onChange={(event) =>
                            updateSelectedChannelModuleConfig((prev) => ({
                              ...prev,
                              ui: {
                                ...prev.ui,
                                colorTheme: {
                                  ...prev.ui.colorTheme,
                                  main: event.target.value.toUpperCase(),
                                },
                              },
                            }))
                          }
                          className="h-8 w-20 p-1 rounded border border-input bg-background cursor-pointer"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor="channel-color-highlight">Highlight</label>
                      <label
                        htmlFor="channel-color-highlight"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <code className="text-[10px] text-muted-foreground min-w-[62px] text-right">
                          {selectedChannelModuleConfig.ui.colorTheme.highlight}
                        </code>
                        <input
                          id="channel-color-highlight"
                          type="color"
                          value={selectedChannelModuleConfig.ui.colorTheme.highlight}
                          onChange={(event) =>
                            updateSelectedChannelModuleConfig((prev) => ({
                              ...prev,
                              ui: {
                                ...prev.ui,
                                colorTheme: {
                                  ...prev.ui.colorTheme,
                                  highlight: event.target.value.toUpperCase(),
                                },
                              },
                            }))
                          }
                          className="h-8 w-20 p-1 rounded border border-input bg-background cursor-pointer"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor="channel-color-text">Text</label>
                      <label
                        htmlFor="channel-color-text"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <code className="text-[10px] text-muted-foreground min-w-[62px] text-right">
                          {selectedChannelModuleConfig.ui.colorTheme.text}
                        </code>
                        <input
                          id="channel-color-text"
                          type="color"
                          value={selectedChannelModuleConfig.ui.colorTheme.text}
                          onChange={(event) =>
                            updateSelectedChannelModuleConfig((prev) => ({
                              ...prev,
                              ui: {
                                ...prev.ui,
                                colorTheme: {
                                  ...prev.ui.colorTheme,
                                  text: event.target.value.toUpperCase(),
                                },
                              },
                            }))
                          }
                          className="h-8 w-20 p-1 rounded border border-input bg-background cursor-pointer"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor="channel-color-border">Border</label>
                      <label
                        htmlFor="channel-color-border"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <code className="text-[10px] text-muted-foreground min-w-[62px] text-right">
                          {selectedChannelModuleConfig.ui.colorTheme.border}
                        </code>
                        <input
                          id="channel-color-border"
                          type="color"
                          value={selectedChannelModuleConfig.ui.colorTheme.border}
                          onChange={(event) =>
                            updateSelectedChannelModuleConfig((prev) => ({
                              ...prev,
                              ui: {
                                ...prev.ui,
                                colorTheme: {
                                  ...prev.ui.colorTheme,
                                  border: event.target.value.toUpperCase(),
                                },
                              },
                            }))
                          }
                          className="h-8 w-20 p-1 rounded border border-input bg-background cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateSelectedChannelModuleConfig((prev) => ({
                          ...prev,
                          ui: {
                            ...prev.ui,
                            colorTheme: defaultChannelModuleConfig().ui.colorTheme,
                          },
                        }))
                      }
                    >
                      Reset colors
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── Main content area ── */}
        {centerPane === "design" ? (
          <DesignSystemPage />
        ) : centerPane === "chat" ? (
          <MessageList
            messages={messages}
            linkPreviews={linkPreviews}
            onOpenThread={(id) => void onOpenThread(id)}
            onOpenLightbox={onOpenLightbox}
            currentUserId={user.id}
            onEditMessage={(messageId, nextBody) =>
              onEditMessage(messageId, nextBody)
            }
            showAvatars={selectedChannelModuleConfig.ui.showAvatars}
            density={selectedChannelModuleConfig.ui.messageDensity}
            cornerRadiusPx={selectedChannelModuleConfig.ui.cornerRadiusPx}
            borderWidthPx={selectedChannelModuleConfig.ui.borderWidthPx}
            enableLinkPreviews={selectedChannelModuleConfig.modules.linkPreviews}
            enableMusicEmbeds={selectedChannelModuleConfig.modules.musicEmbeds}
            enableThreads={
              leftRailTab === "channels" &&
              selectedChannelModuleConfig.modules.threads
            }
            onBottomStateChange={(atBottom) => {
              void onMessageListBottomStateChange(atBottom);
            }}
          />
        ) : centerPane === "library" ? (
          <LibraryWorkspace
            filteredLibraryItems={filteredLibraryItems}
            selectedLibraryItemIds={selectedLibraryItemIds}
            setSelectedLibraryItemIds={setSelectedLibraryItemIds}
            dragOverLibraryItemId={dragOverLibraryItemId}
            canReorderCollection={canReorderCollection}
            onLibraryItemDragStart={onLibraryItemDragStart}
            onLibraryItemDragOver={onLibraryItemDragOver}
            onLibraryItemDragEnd={onLibraryItemDragEnd}
            onLibraryItemDrop={onLibraryItemDrop}
            onSelectAllFilteredLibraryItems={onSelectAllFilteredLibraryItems}
            onClearLibrarySelection={onClearLibrarySelection}
            getLibraryThumbnail={getLibraryThumbnail}
            decodeHtmlEntities={decodeHtmlEntities}
            editingLibraryItem={editingLibraryItem}
            metadataTitleDraft={metadataTitleDraft}
            setMetadataTitleDraft={setMetadataTitleDraft}
            metadataDescriptionDraft={metadataDescriptionDraft}
            setMetadataDescriptionDraft={setMetadataDescriptionDraft}
            metadataTermsDraft={metadataTermsDraft}
            setMetadataTermsDraft={setMetadataTermsDraft}
            guessTaxonomySuggestions={guessTaxonomySuggestions}
            onApplySuggestedTerm={onApplySuggestedTerm}
            onSaveLibraryMetadata={onSaveLibraryMetadata}
            onSetMetadataDraft={onSetMetadataDraft}
            setEditingLibraryItem={setEditingLibraryItem}
            busy={busy}
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
        ) : (
          <AccountWorkspace
            accountView={accountView}
            user={{ id: user.id }}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            onSaveProfile={onSaveProfile}
            onUploadAvatarFile={onUploadAvatarFile}
            profilePhotos={profilePhotos}
            servers={servers}
            busy={busy}
            centerPane={centerPane}
            setCenterPane={setCenterPane}
            showUnreadOnly={showUnreadOnly}
            setShowUnreadOnly={setShowUnreadOnly}
            changePasswordForm={changePasswordForm}
            setChangePasswordForm={setChangePasswordForm}
            onChangePassword={onChangePassword}
            uiPrefs={uiPrefs}
            setUiPrefs={setUiPrefs}
          />
        )}

        {/* ── Composer ── */}
        {centerPane === "chat" && (
          <form
            autoComplete="off"
            className="flex items-end gap-2 px-3 py-2.5 border-t border-border shrink-0"
            onSubmit={onSendMessage}
          >
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {pendingMedia.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pendingMedia.map((media) => (
                    <span
                      key={media.id}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground"
                    >
                      {media.original_name}
                    </span>
                  ))}
                </div>
              )}
              <Input
                placeholder="Write a message…"
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                className="h-9"
              />
              {leftRailTab === "channels" ? (
                <Input
                  type="file"
                  className="text-xs text-muted-foreground file:mr-2 file:text-xs file:rounded file:border file:border-border file:bg-muted file:px-2 file:py-0.5 file:text-foreground"
                  onChange={onUploadFile}
                  disabled={!selectedChannelId || busy}
                />
              ) : null}
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={
                (leftRailTab === "channels" ? !selectedChannelId : !selectedDmId) ||
                busy ||
                (composer.trim().length === 0 && pendingMedia.length === 0)
              }
              className="shrink-0"
            >
              Send
            </Button>
          </form>
        )}
      </section>

      <div
        className="column-resizer"
        role="separator"
        aria-label="Resize right column"
        onMouseDown={(event) => startColumnResize("right", event)}
      />

      <ThreadPanel
        threadMessages={threadMessages}
        threadComposer={threadComposer}
        setThreadComposer={setThreadComposer}
        onSendThreadMessage={onSendThreadMessage}
        selectedThreadRootId={selectedThreadRootId}
        busy={busy}
        userCommands={userCommands}
        serverCommands={serverCommands}
        selectedServerId={selectedServerId}
        userCommandForm={userCommandForm}
        setUserCommandForm={setUserCommandForm}
        serverCommandForm={serverCommandForm}
        setServerCommandForm={setServerCommandForm}
        onCreateUserCommand={onCreateUserCommand}
        onCreateServerCommand={onCreateServerCommand}
      />

      {lightboxIndex !== null && galleryImages[lightboxIndex] ? (
        /* Backdrop */
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Modal */}
          <div
            className="relative flex flex-col gap-3 w-full max-w-4xl max-h-[calc(100vh-2rem)] rounded-xl border border-border bg-card shadow-2xl p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
              <div>
                <strong className="text-sm font-semibold">
                  {galleryImages[lightboxIndex].original_name}
                </strong>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {galleryImages[lightboxIndex].messageAuthor}
                  {" · "}
                  {new Date(
                    galleryImages[lightboxIndex].messageCreatedAt,
                  ).toLocaleString()}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 shrink-0 text-muted-foreground"
                onClick={() => setLightboxIndex(null)}
              >
                Close
              </Button>
            </div>

            {/* Stage */}
            <div className="flex items-center gap-2 min-h-0 flex-1">
              {galleryImages.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Previous image"
                  className="h-10 w-8 shrink-0 text-lg p-0"
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      prev === null
                        ? prev
                        : (prev - 1 + galleryImages.length) %
                          galleryImages.length,
                    )
                  }
                >
                  ‹
                </Button>
              ) : (
                <span className="w-8 shrink-0" />
              )}

              <img
                src={galleryImages[lightboxIndex].public_url}
                alt={galleryImages[lightboxIndex].original_name}
                className="flex-1 min-w-0 max-h-[calc(100vh-14rem)] w-full object-contain rounded-lg border border-border bg-muted"
              />

              {galleryImages.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Next image"
                  className="h-10 w-8 shrink-0 text-lg p-0"
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      prev === null ? prev : (prev + 1) % galleryImages.length,
                    )
                  }
                >
                  ›
                </Button>
              ) : (
                <span className="w-8 shrink-0" />
              )}
            </div>

            {/* Index */}
            {galleryImages.length > 1 && (
              <p className="text-center text-xs text-muted-foreground shrink-0">
                {lightboxIndex + 1} / {galleryImages.length}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Floating error toast */}
      {error ? (
        <pre className="fixed right-3 bottom-3 z-50 max-w-[min(520px,calc(100vw-1.5rem))] rounded-lg border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-xs whitespace-pre-wrap shadow-lg">
          {error}
        </pre>
      ) : null}
    </main>
  );
}
