'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Linkedin, Mail, Calendar } from 'lucide-react'

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (options: { url: string }) => void
    }
  }
}

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

export function ContactDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const openCalendly = () => {
    // Load Calendly CSS on-demand if not already loaded
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
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
        aria-label="Contact options"
      >
        Contact
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Mobile Contact Button (only visible on mobile) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden inline-flex items-center justify-center w-10 h-10 text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
        aria-label="Contact options"
      >
        <Mail className="w-5 h-5" />
      </button>

      {/* Dropdown panel */}
      <div
        className={`absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-zinc-200 overflow-hidden transition-all duration-200 min-w-max ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="p-2">
          {contactLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <link.icon className="w-4 h-4 text-zinc-400" />
              <span>{link.label}</span>
            </a>
          ))}
        </div>

        <div className="border-t border-zinc-100 p-2">
          <button
            onClick={() => {
              openCalendly()
              setIsOpen(false)
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4 text-zinc-600" />
            <span>Schedule a call</span>
          </button>
        </div>
      </div>
    </div>
  )
}
