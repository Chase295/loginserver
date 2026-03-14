import { useState, useRef } from 'react'
import { HiMagnifyingGlass, HiXMark } from 'react-icons/hi2'

export default function SearchBar({ value, onChange, placeholder = 'Suchen...' }) {
  const inputRef = useRef(null)

  return (
    <div className="relative">
      <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="glass-input pl-10 pr-10"
      />
      {value && (
        <button
          onClick={() => { onChange(''); inputRef.current?.focus() }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
        >
          <HiXMark className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
