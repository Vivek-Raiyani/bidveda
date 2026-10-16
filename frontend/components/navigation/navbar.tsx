"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { UserRole } from "@/types/permissions";
import {
  ShieldCheck,
  FileText,
  PlusCircle,
  Briefcase,
  FolderArchive,
  LayoutDashboard,
  LogOut,
  LogIn,
  UserPlus,
  Menu,
  X,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isBuyerOrAdmin =
    user?.role === UserRole.BUYER || user?.role === UserRole.ADMIN;
  const isVendorOrAdmin =
    user?.role === UserRole.VENDOR || user?.role === UserRole.ADMIN;
  const isAdmin = user?.role === UserRole.ADMIN;

  const navLinks = [
    {
      name: "Marketplace",
      href: "/rfqs",
      icon: Briefcase,
      show: true,
    },
    {
      name: "My RFQs",
      href: "/rfqs?tab=my",
      icon: FileText,
      show: isBuyerOrAdmin,
    },
    {
      name: "My Quotes",
      href: "/quotes/my",
      icon: Briefcase,
      show: isVendorOrAdmin,
    },
    {
      name: "Assets",
      href: "/assets",
      icon: FolderArchive,
      show: isAuthenticated,
    },
    {
      name: "Admin Hub",
      href: "/admin",
      icon: LayoutDashboard,
      show: isAdmin,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30 transition-all group-hover:bg-indigo-600/30 group-hover:scale-105">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">
                  BidVeda
                </span>
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-indigo-300">
                  Procure
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks
              .filter((l) => l.show)
              .map((link) => {
                const Icon = link.icon;
                const isActive =
                  pathname === link.href ||
                  (link.href.includes("?") &&
                    pathname === link.href.split("?")[0]);

                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* Right Section: Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* Quick Create RFQ for Buyers */}
          {isAuthenticated && isBuyerOrAdmin && (
            <Link
              href="/rfqs/create"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create RFQ</span>
            </Link>
          )}

          {isLoading ? (
            <div className="h-9 w-28 animate-pulse rounded-xl bg-zinc-800" />
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 py-1.5 px-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-xs font-bold text-indigo-300">
                  {user.first_name?.[0] || user.email[0].toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-medium text-white truncate max-w-[120px]">
                    {user.first_name || user.email.split("@")[0]}
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                    {user.role}
                  </div>
                </div>
              </div>

              <button
                onClick={() => logout()}
                className="rounded-xl border border-zinc-800 p-2 text-zinc-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign in</span>
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Register</span>
              </Link>
            </div>
          )}

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-4 space-y-2">
          {navLinks
            .filter((l) => l.show)
            .map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
                >
                  <Icon className="h-4 w-4 text-indigo-400" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          {isAuthenticated && isBuyerOrAdmin && (
            <Link
              href="/rfqs/create"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-lg bg-indigo-600/20 px-3 py-2.5 text-sm font-semibold text-indigo-300 hover:bg-indigo-600/30"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create RFQ</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
