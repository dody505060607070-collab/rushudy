export type SocialKey =
  | "link_youtube"
  | "link_tiktok"
  | "link_instagram"
  | "link_snapchat"
  | "link_x"
  | "link_facebook"
  | "link_tour";

export const SOCIAL_PLATFORMS: {
  key: SocialKey;
  label: string;
  color: string;
  /** لون النص/الأيقونة فوق الخلفية */
  textColor?: string;
  placeholder: string;
}[] = [
  { key: "link_tiktok", label: "تيك توك", color: "#010101", placeholder: "https://tiktok.com/@..." },
  {
    key: "link_youtube",
    label: "يوتيوب",
    color: "#FFFFFF",
    textColor: "#FF0000",
    placeholder: "https://youtube.com/...",
  },
  { key: "link_instagram", label: "إنستغرام", color: "#E1306C", placeholder: "https://instagram.com/..." },
  { key: "link_snapchat", label: "سناب شات", color: "#FFFC00", textColor: "#111111", placeholder: "https://snapchat.com/..." },
  { key: "link_x", label: "إكس (تويتر)", color: "#0F1419", placeholder: "https://x.com/..." },
  { key: "link_facebook", label: "فيسبوك", color: "#1877F2", placeholder: "https://facebook.com/..." },
  { key: "link_tour", label: "جولة افتراضية", color: "#0EA5E9", placeholder: "https://..." },
];

export function SocialGlyph({ platform, className = "size-4" }: { platform: SocialKey; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "currentColor", xmlns: "http://www.w3.org/2000/svg" };
  switch (platform) {
    case "link_youtube":
      return (
        <svg {...common}>
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
        </svg>
      );
    case "link_tiktok":
      return (
        <svg {...common}>
          <path d="M16.6 2h-3v13.1a2.9 2.9 0 1 1-2.2-2.8V9.2a6.1 6.1 0 1 0 5.2 6V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.4 4.4 0 0 1-4.3-4.4V2Z" />
        </svg>
      );
    case "link_instagram":
      return (
        <svg {...common}>
          <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.8s0 3.5-.1 4.8c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9a3.6 3.6 0 0 1-.9-1.4c-.2-.4-.4-1-.4-2.2C2.2 15.5 2.2 15.1 2.2 12s0-3.5.1-4.8c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.8-.1Zm0 3.4a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8Zm0 10.5a4.1 4.1 0 1 1 0-8.2 4.1 4.1 0 0 1 0 8.2Zm6.6-10.8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      );
    case "link_snapchat":
      return (
        <svg {...common}>
          <path d="M12 2c2.8 0 4.7 2 4.8 4.7 0 .8 0 1.6-.1 2.3.4.2.9.2 1.4 0 .6-.2 1.2.5.8 1.1-.3.5-1 .9-1.7 1.1-.4.2-.5.5-.3.9.7 1.6 2 2.8 3.4 3.2.5.1.6.7.2 1-.6.4-1.6.7-2.5.8-.2.4-.2.9-.4 1.1-.2.2-.7.1-1.2 0-1.3-.2-2.3 0-3 .6-.9.6-1.6 1.2-3.4 1.2s-2.5-.6-3.4-1.2c-.7-.6-1.7-.8-3-.6-.5.1-1 .2-1.2 0-.2-.2-.2-.7-.4-1.1-.9-.1-1.9-.4-2.5-.8-.4-.3-.3-.9.2-1 1.4-.4 2.7-1.6 3.4-3.2.2-.4.1-.7-.3-.9-.7-.2-1.4-.6-1.7-1.1-.4-.6.2-1.3.8-1.1.5.2 1 .2 1.4 0-.1-.7-.1-1.5-.1-2.3C7.3 4 9.2 2 12 2Z" />
        </svg>
      );
    case "link_x":
      return (
        <svg {...common}>
          <path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.7 21H1.5l7.5-8.6L1.2 3h6.6l4.5 5.6L17.5 3Zm-1.1 16h1.8L7.7 4.9H5.8L16.4 19Z" />
        </svg>
      );
    case "link_facebook":
      return (
        <svg {...common}>
          <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
        </svg>
      );
    case "link_tour":
      return (
        <svg {...common}>
          <path d="M12 2 2 9v13h7v-6h6v6h7V9L12 2Z" />
        </svg>
      );
  }
}
