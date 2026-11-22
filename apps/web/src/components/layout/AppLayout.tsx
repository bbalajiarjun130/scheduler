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
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth, useLogout } from "@/lib/auth";
import { useThemeStore } from "@/lib/theme";

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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-border bg-card px-3 py-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarClock size={18} />
          </div>
          <span className="font-semibold">Scheduler</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}

          {user?.role === "admin" && (
            <>
              <div className="mt-4 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Admin
              </div>
              {adminNavItems.map((item) => (
                <NavItem key={item.to} {...item} />
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

      <main className="flex-1 overflow-y-auto bg-muted/30">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
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
