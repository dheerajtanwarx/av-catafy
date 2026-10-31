import type { PublicStore } from "@catafy/types";
import { whatsappLink } from "@/lib/whatsapp";

export function StoreFooter({ store }: { store: PublicStore }) {
  const wa = whatsappLink(store.whatsappNumber);
  const socials = Object.entries(store.socialLinks).filter(([, url]) => url);
  return (
    <footer className="mt-24 border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-sm md:grid-cols-3 md:px-6">
        <div>
          <p className="font-display text-2xl font-semibold">{store.storeName}</p>
          {store.description && (
            <p className="mt-2 max-w-xs text-muted-foreground">{store.description}</p>
          )}
        </div>
        {(wa || store.address) && (
          <div className="space-y-2">
            <p className="font-medium">Contact</p>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="block text-muted-foreground hover:text-foreground"
              >
                WhatsApp: +{wa.replace("https://wa.me/", "")}
              </a>
            )}
            {store.address && (
              <p className="whitespace-pre-line text-muted-foreground">{store.address}</p>
            )}
          </div>
        )}
        {socials.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium">Follow</p>
            {socials.map(([name, url]) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block text-muted-foreground capitalize hover:text-foreground"
              >
                {name}
              </a>
            ))}
          </div>
        )}
      </div>
      <p className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {store.storeName}
      </p>
    </footer>
  );
}
