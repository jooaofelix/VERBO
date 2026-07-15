import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/", label: "Início", icon: "📚" },
  { to: "/nova", label: "Nova análise", icon: "✦" },
  { to: "/sobre", label: "Sobre", icon: "ℹ" },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-ink-800/10 bg-parchment-50/95 backdrop-blur dark:border-parchment-50/10 dark:bg-ink-950/95">
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                  isActive
                    ? "text-verse-600 dark:text-verse-400"
                    : "text-ink-700/60 dark:text-parchment-100/50"
                }`
              }
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
