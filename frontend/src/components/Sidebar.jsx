import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/utils'
import {
  LayoutDashboard, Users, GraduationCap, ClipboardList,
  LogOut, BookOpen, ChevronRight, FileText, History, Menu, X,
  Book,
} from 'lucide-react'

const NAV = {
  ADMIN: [
    { href: '/admin/dashboard', label: 'Dashboard',     icon: LayoutDashboard },
    { href: '/admin/teachers',  label: "O'qituvchilar", icon: Users },
    { href: '/admin/students',  label: 'Talabalar',     icon: GraduationCap },
  ],
  TEACHER: [
    { href: '/teacher/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
    { href: '/teacher/students',  label: 'Talabalarim', icon: GraduationCap },
    { href: '/teacher/groups',    label: 'Guruhlar',     icon: BookOpen },
  ],
  STUDENT: [
    { href: '/student/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
    { href: '/student/upload',      label: 'Ish Yuklash', icon: FileText },
    { href: '/student/history',     label: 'Tarix',       icon: History },
  ],
}

const ROLE_LABELS = { ADMIN: 'Administrator', TEACHER: "O'qituvchi", STUDENT: 'Talaba' }
const ROLE_COLORS = {
  ADMIN:   'bg-purple-500/20 text-purple-300 border-purple-500/30',
  TEACHER: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  STUDENT: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

function NavContent({ user, logout, pathname, onClose }) {
  const links = NAV[user?.role] || []
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-500/20 rounded-xl flex items-center justify-center border border-primary-500/30">
            <BookOpen className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <div className="font-bold text-white text-base">EduTest</div>
            <div className="text-slate-400 text-xs">Mustaqil Ta'lim Tizimi</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1 touch-manipulation">
            <X size={20} />
          </button>
        )}
      </div>

      {/* User info */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="bg-slate-800/80 rounded-xl p-3">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm truncate">{user?.name}</p>
              <p className="text-slate-400 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium border', ROLE_COLORS[user?.role])}>
              {ROLE_LABELS[user?.role]}
            </span>
            {user?.subject && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 max-w-[120px] truncate">
                {user.subject}
              </span>
            )}
          </div>
          {/* Teacher guruhlar */}
          {user?.role === 'TEACHER' && user?.groups?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {user.groups.map(g => (
                <span key={g} className="text-xs px-1.5 py-0.5 rounded-md font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {g}
                </span>
              ))}
            </div>
          )}
          {/* Student guruhi */}
          {user?.role === 'STUDENT' && user?.group && (
            <div className="mt-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {user.group}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} to={href} onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 touch-manipulation',
                active
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700'
              )}>
              <Icon size={18} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-primary-400" />}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-700/50">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 transition-all touch-manipulation">
          <LogOut size={18} />
          <span>Chiqish</span>
        </button>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { pathname }     = useLocation()
  const [open, setOpen]  = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-700/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary-500/20 rounded-lg flex items-center justify-center border border-primary-500/30">
            <BookOpen className="w-4 h-4 text-primary-400" />
          </div>
          <span className="font-bold text-white text-sm">EduTest</span>
        </div>
        <div className="flex items-center gap-2">
          {user?.group && (
            <span className="hidden xs:block text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {user.group}
            </span>
          )}
          <button onClick={() => setOpen(true)} className="text-slate-300 hover:text-white p-1 touch-manipulation">
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-slate-900 h-full shadow-2xl">
            <NavContent user={user} logout={logout} pathname={pathname} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen bg-slate-900 fixed left-0 top-0 z-40 shadow-2xl">
        <NavContent user={user} logout={logout} pathname={pathname} onClose={null} />
      </aside>
    </>
  )
}