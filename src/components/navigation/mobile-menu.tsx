'use client'

import Link from 'next/link'
import { Linkedin, Mail, Calendar } from 'lucide-react'

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (options: { url: string }) => void
    }
  }
}

interface MobileMenuProps {
  activeTab: 'about' | 'experience' | 'projects'
  onTabChange: (tab: 'about' | 'experience' | 'projects') => void
  onClose: () => void
}

const navLinks = [
  { label: 'About', tab: 'about' as const },
  { label: 'Experience', tab: 'experience' as const },
  { label: 'Projects', tab: 'projects' as const },
]

const contactLinks = [
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/pavan-dongare/',
    icon: Linkedin,
  },
  {
    label: 'Email',
    href: 'mailto:dongare.pavan25@gmail.com',
    icon: Mail,
  },
]

export function MobileMenu({ activeTab, onTabChange, onClose }: MobileMenuProps) {
  const openCalendly = () => {
    if (!document.querySelector('link[href*="calendly"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://assets.calendly.com/assets/external/widget.css'
      document.head.appendChild(link)
    }
    if (window.Calendly) {
      window.Calendly.initPopupWidget({
        url: 'https://calendly.com/pavan-dongare/intro'
      })
    }
    onClose()
  }

  return (
    <div className="fixed top-16 left-0 right-0 bottom-0 bg-white border-b border-zinc-100 lg:hidden z-40">
      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Navigation Links */}
        <nav className="mb-8 flex flex-col gap-4">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => {
                onTabChange(link.tab)
                onClose()
              }}
              className={`text-left text-sm transition-colors px-4 py-2 rounded-lg ${
                activeTab === link.tab
                  ? 'text-zinc-900 font-medium bg-zinc-50'
                  : 'text-zinc-600'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Resume Link */}
        <div className="mb-6 pb-6 border-b border-zinc-100">
          <a
            href="/pavandongare.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-900 border border-zinc-200 rounded-lg hover:border-zinc-300 hover:bg-zinc-50 transition-colors w-full justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Resume
          </a>
        </div>

        {/* Contact Links */}
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-widest text-zinc-400 px-4">Contact</p>
          {contactLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
              onClick={onClose}
            >
              <link.icon className="w-4 h-4 text-zinc-400" />
              <span>{link.label}</span>
            </a>
          ))}
          <button
            onClick={openCalendly}
            className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors text-left"
          >
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span>Schedule a call</span>
          </button>
        </div>
      </div>
    </div>
  )
}
