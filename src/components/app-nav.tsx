"use client";

import { Dumbbell, LogOut, Menu } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean };

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function CoachShell({
  items,
  orgName,
  userName,
  children,
}: {
  items: NavItem[];
  orgName: string;
  userName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const footer = (
    <div className="space-y-2 border-t pt-4">
      <p className="truncate px-3 text-sm text-muted-foreground">{userName}</p>
      <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => signOut({ callbackUrl: "/login" })}>
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </div>
  );
  return (
    <div className="flex min-h-svh flex-1">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Link href="/coach" className="flex items-center gap-2 px-3 font-semibold">
          <Dumbbell className="size-5" />
          <span className="truncate">{orgName}</span>
        </Link>
        <div className="flex-1">
          <NavLinks items={items} />
        </div>
        {footer}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menú">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col gap-6 p-4">
              <SheetHeader className="p-0">
                <SheetTitle className="flex items-center gap-2">
                  <Dumbbell className="size-5" /> {orgName}
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1">
                <NavLinks items={items} onNavigate={() => setOpen(false)} />
              </div>
              {footer}
            </SheetContent>
          </Sheet>
          <span className="font-semibold">{orgName}</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
