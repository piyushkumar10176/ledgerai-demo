"use client";

// Opens the Copilot panel (handled in Chrome via a window event).
export default function CopilotButton({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("ledgerai:copilot"))}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
