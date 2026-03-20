import { useState, useRef, useEffect, useCallback } from 'react';
import { usersApi } from '../api/client';

export interface AppUser {
  id: number;
  name: string;
  avatarColor: string;
}

interface UserSwitcherProps {
  activeUser: AppUser | null;
  users: AppUser[];
  onSwitch: (user: AppUser) => void;
  onAddUser: () => void;
  onRefresh: () => void;
}

export function UserSwitcher({ activeUser, users, onSwitch, onAddUser, onRefresh }: UserSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleRemove = useCallback(async (id: number) => {
    try {
      await usersApi.remove(id);
      onRefresh();
    } catch {
      /* ignore */
    }
  }, [onRefresh]);

  const initial = activeUser?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white/10 hover:border-accent-indigo/50 transition-all shrink-0"
        style={{ backgroundColor: activeUser?.avatarColor || '#6366f1' }}
        title={activeUser?.name || 'Select user'}
      >
        {initial}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-bg-overlay border border-border-subtle rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-border-subtle">
            <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim">Switch User</div>
          </div>

          <div className="py-1.5 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-bg-card">
            {users.map((u) => (
              <div
                key={u.id}
                className={`flex items-center gap-2.5 px-3.5 py-2 cursor-pointer transition-all group
                  ${u.id === activeUser?.id
                    ? 'bg-accent-indigo/[0.08]'
                    : 'hover:bg-white/[0.03]'
                  }`}
              >
                <button
                  onClick={() => { onSwitch(u); setOpen(false); }}
                  className="flex items-center gap-2.5 flex-1 min-w-0"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ backgroundColor: u.avatarColor }}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={`text-xs font-medium truncate ${u.id === activeUser?.id ? 'text-accent-indigo-light' : 'text-text-secondary'}`}>
                    {u.name}
                  </span>
                  {u.id === activeUser?.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-indigo ml-auto shrink-0" />
                  )}
                </button>
                {users.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(u.id); }}
                    className="text-text-dim hover:text-accent-red-light text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Remove user"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border-subtle px-3.5 py-2">
            <button
              onClick={() => { onAddUser(); setOpen(false); }}
              className="w-full text-left text-xs font-semibold text-accent-indigo-light hover:text-accent-indigo transition-colors py-1"
            >
              + Add User
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
