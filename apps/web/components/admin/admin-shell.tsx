"use client";

import {
  BookOpen,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Shirt,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Shirt },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/catalogues", label: "Catalogues", icon: BookOpen },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2 px-3">
      <Store className="size-5 text-brand" aria-hidden />
      <span className="font-display text-xl font-semibold">Catalogue</span>
    </Link>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api("/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  }

  const logoutButton = (
    <Button variant="ghost" className="justify-start gap-3 text-muted-foreground" onClick={logout}>
      <LogOut className="size-4" aria-hidden />
      Log out
    </Button>
  );

  const storeLink = (
    <Button variant="ghost" className="justify-start gap-3 text-muted-foreground" asChild>
      <a href="/" target="_blank" rel="noreferrer">
        <ExternalLink className="size-4" aria-hidden />
        View store
      </a>
    </Button>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-sidebar py-6 md:flex">
        <Brand />
        <div className="flex-1 px-3">
          <NavLinks />
        </div>
        <div className="flex flex-col px-3">
          {storeLink}
          {logoutButton}
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col gap-6 bg-sidebar py-6">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Brand />
            <div className="flex-1 px-3">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="flex flex-col px-3">
              {storeLink}
              {logoutButton}
            </div>
          </SheetContent>
        </Sheet>
        <Brand />
      </header>

      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
