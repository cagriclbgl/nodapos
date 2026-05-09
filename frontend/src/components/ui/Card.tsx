import { HTMLAttributes } from "react";

export function Card({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      {...rest}
    />
  );
}

export function CardHeader({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 ${className}`}
      {...rest}
    />
  );
}

export function CardBody({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-5 ${className}`} {...rest} />;
}
