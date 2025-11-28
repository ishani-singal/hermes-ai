'use client'

import { useState, useEffect, useRef } from 'react'
import { Globe, Check } from 'lucide-react'
import { LanguageOption } from '@/lib/voice/types'
import { SUPPORTED_LANGUAGES } from '@/lib/voice/constants'

const STORAGE_KEY = 'hai-voice-language'

interface LanguageSelectorProps {
    value?: string
    onChange?: (language: LanguageOption) => void
    className?: string
}

export function LanguageSelector({ value, onChange, className = '' }: LanguageSelectorProps) {
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0])
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const found = SUPPORTED_LANGUAGES.find(lang => lang.code === stored)
            if (found) {
                setSelectedLanguage(found)
                onChange?.(found)
            }
        }
    }, [onChange])

    // Update from prop if controlled
    useEffect(() => {
        if (value) {
            const found = SUPPORTED_LANGUAGES.find(lang => lang.code === value)
            if (found) {
                setSelectedLanguage(found)
            }
        }
    }, [value])

    const handleSelect = (language: LanguageOption) => {
        setSelectedLanguage(language)
        localStorage.setItem(STORAGE_KEY, language.code)
        onChange?.(language)
        setIsOpen(false)
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Selected language button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors min-h-[48px] min-w-[140px]"
                aria-label="Select language"
                aria-expanded={isOpen}
            >
                <Globe className="h-4 w-4 text-gray-500" />
                <span className="text-lg" aria-hidden="true">{selectedLanguage.flag}</span>
                <span className="text-sm font-medium">{selectedLanguage.name}</span>
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <>
                    {/* Backdrop for mobile */}
                    <div
                        className="fixed inset-0 z-10 md:hidden"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute top-full left-0 mt-2 bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[180px] z-20 max-h-[400px] overflow-y-auto">
                        {SUPPORTED_LANGUAGES.map((language) => (
                            <button
                                key={language.code}
                                onClick={() => handleSelect(language)}
                                className={
                                    'w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors min-h-[48px] ' +
                                    (language.code === selectedLanguage.code
                                        ? 'bg-brand/10 text-brand font-medium'
                                        : 'text-gray-700 hover:bg-gray-50')
                                }
                                aria-label={`Select ${language.name}`}
                            >
                                <span className="text-xl" aria-hidden="true">{language.flag}</span>
                                <span>{language.name}</span>
                                {language.code === selectedLanguage.code && (
                                    <Check className="ml-auto h-4 w-4 text-brand" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
