import React, { useState } from 'react';

const SearchInput = () => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="flex items-center justify-center gap-4 relative">
      <div className={`relative flex items-center justify-center transition-all duration-500 ${
        isFocused ? 'w-64' : 'w-12'
      }`}>
        <input
          type="text"
          placeholder="search.."
          className={`h-12 px-4 outline-none rounded-full transition-all duration-500 ${
            isFocused
              ? 'w-full bg-transparent border-b-4 border-blue-500 rounded-none pl-12'
              : 'w-12 bg-blue-600 shadow-lg shadow-blue-600'
          } text-white placeholder-gray-400 font-trebuchet text-base`}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <button
          className="absolute right-0 flex items-center justify-center w-12 h-12 rounded-full cursor-pointer outline-none border-none bg-transparent transition-all duration-200 hover:scale-110"
          aria-label="Search"
        >
          <svg
            width="25px"
            height="25px"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M22 22L20 20"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default SearchInput;
