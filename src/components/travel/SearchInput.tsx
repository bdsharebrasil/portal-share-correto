import React, { useState } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...' }: SearchInputProps) {
  return (
    <div className="search-container">
      <div className="flex items-center justify-center fill-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          id="Isolation_Mode"
          data-name="Isolation Mode"
          viewBox="0 0 24 24"
          width="22"
          height="22"
        >
          <path d="M18.9,16.776A10.539,10.539,0,1,0,16.776,18.9l5.1,5.1L24,21.88ZM10.5,18A7.5,7.5,0,1,1,18,10.5,7.507,7.507,0,0,1,10.5,18Z" />
        </svg>
      </div>
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <style>{`
        .search-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px 20px;
          overflow: hidden;
          width: 60px;
          height: 60px;
          background: hsl(var(--primary));
          box-shadow: 2px 2px 20px rgba(0, 0, 0, 0.08);
          border-radius: 9999px;
          transition: width 0.3s ease;
          gap: 12px;
          flex-shrink: 0;
        }

        .search-container:hover {
          width: 270px;
          transition-duration: 0.3s;
        }

        .search-input {
          outline: none;
          font-size: 16px;
          background: transparent;
          width: 100%;
          color: white;
          font-weight: 500;
          border: none;
          font-family: inherit;
        }

        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.7);
        }

        .search-input::-webkit-outer-spin-button,
        .search-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  );
}