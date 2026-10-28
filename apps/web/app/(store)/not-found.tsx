import Link from "next/link";

export default function StoreNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-display text-4xl">This piece isn’t here</p>
      <p className="mt-3 text-muted-foreground">It may have sold out or been moved.</p>
      <Link
        href="/products"
        className="mt-8 inline-block rounded-full bg-foreground px-6 py-3 text-sm text-background"
      >
        Browse the collection
      </Link>
    </div>
  );
}
