import Image from "next/image";

const marks = {
  "white-lockup": {
    src: "/brand/swr_header_logo_white.png",
    width: 3057,
    height: 673,
    alt: "Stay with Rain, Ocean Springs, MS",
  },
  "white-wordmark": {
    src: "/brand/swr_header_logo_white_wordmark.png",
    width: 3057,
    height: 276,
    alt: "Stay with Rain",
  },
  "navy-lockup": {
    src: "/brand/swr_header_logo_navy.png",
    width: 3057,
    height: 673,
    alt: "Stay with Rain, Ocean Springs, MS",
  },
  "navy-wordmark": {
    src: "/brand/swr_header_logo_navy_wordmark.png",
    width: 3057,
    height: 276,
    alt: "Stay with Rain",
  },
} as const;

export function BrandMark({
  variant,
  className,
  priority = false,
}: {
  variant: keyof typeof marks;
  className?: string;
  priority?: boolean;
}) {
  const mark = marks[variant];
  return (
    <Image
      src={mark.src}
      alt={mark.alt}
      width={mark.width}
      height={mark.height}
      priority={priority}
      className={className}
    />
  );
}
