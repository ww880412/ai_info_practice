"use client";

interface SkeletonProps {
  shape?: "line" | "circle" | "rect";
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({
  shape = "line",
  width,
  height,
  className = "",
}: SkeletonProps) {
  const baseClasses = "animate-pulse bg-gray-200 dark:bg-gray-700";

  const shapeClasses = {
    line: "h-4 rounded",
    circle: "rounded-full",
    rect: "rounded-lg",
  }[shape];

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`${baseClasses} ${shapeClasses} ${className}`}
      style={style}
    />
  );
}
