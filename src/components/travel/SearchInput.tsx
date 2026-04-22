import React from 'react'; 
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...' }: SearchInputProps) {
  return (
    <div className="search-input-container">
      {/* ✅ Fix 4: input vem ANTES do ícone para o seletor CSS adjacente (+) funcionar */}
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <svg
        className="icon"
        xmlns="http://www.w3.org/2000/svg"
        id="Isolation_Mode"
        data-name="Isolation Mode"
        viewBox="0 0 24 24"
        width="22"
        height="22"
      >
        <path d="M18.9,16.776A10.539,10.539,0,1,0,16.776,18.9l5.1,5.1L24,21.88ZM10.5,18A7.5,7.5,0,1,1,18,10.5,7.507,7.507,0,0,1,10.5,18Z" fill="currentColor" />
      </svg>

      <style>{`
        .search-input-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-input {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid rgb(98, 0, 255);
          outline: none;
          padding: 18px 16px;
          background-color: #fff;
          cursor: pointer;
          transition: all .5s ease-in-out;
        }

        .search-input::placeholder {
          color: transparent;
        }

        .search-input:focus,
        .search-input:not(:placeholder-shown) {
          background-color: #fff;
          border: 1px solid rgb(98, 0, 255);
          width: 290px;
          cursor: text;
          padding: 18px 16px 18px 50px;
        }

        .icon {
          position: absolute;
          left: 0;
          top: 0;
          height: 40px;
          width: 40px;
          background-color: transparent;
          border-radius: 10px;
          z-index: 1;
          color: rgb(98, 0, 255);
          border: none;
          padding: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .search-input:hover + .icon {
          transform: rotate(360deg);
          transition: .2s ease-in-out;
        }

        .search-input:focus + .icon,
        .search-input:not(:placeholder-shown) + .icon {
          background-color: transparent;
          border: none;
        }
      `}</style>
    </div>
  );
}
