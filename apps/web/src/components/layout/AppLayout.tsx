import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarClock,
  LayoutDashboard,
  CalendarDays,
  FolderKanban,
  Inbox,
  Users,
  ShieldCheck,
  Settings,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth, useLogout } from "@/lib/auth";
import { useThemeStore } from "@/lib/theme";
import { NotificationBell } from "./NotificationBell";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/requests", label: "My Requests", icon: Inbox },
];

const adminNavItems = [
  { to: "/admin/requests", label: "Approve Requests", icon: Inbox },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/permissions", label: "Permissions", icon: ShieldCheck },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AppLayout() {
  const { user } = useAuth();
  const logout = useLogout();
  const { theme, setTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card px-3 py-4 transition-transform lg:static lg:z-auto lg:w-60 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarClock size={18} />
            </div>
            <span className="font-semibold">Scheduler</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} onNavigate={() => setSidebarOpen(false)} />
          ))}

          {user?.role === "admin" && (
            <>
              <div className="mt-4 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Admin
              </div>
              {adminNavItems.map((item) => (
                <NavItem key={item.to} {...item} onNavigate={() => setSidebarOpen(false)} />
              ))}
            </>
          )}
        </nav>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="flex items-center justify-between px-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.role}</p>
            </div>
            <button
              onClick={() => logout().then(() => window.location.assign("/login"))}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <Menu size={18} />
          </button>
          <span className="lg:hidden" />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto bg-muted/30">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );
}
