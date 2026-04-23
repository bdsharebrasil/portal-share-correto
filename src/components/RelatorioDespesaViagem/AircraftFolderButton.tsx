import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface AircraftFolderButtonProps {
  label: string;
  count: number;
  isOpen: boolean;
  onClick: () => void;
}

export function AircraftFolderButton({ label, count, isOpen, onClick }: AircraftFolderButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="documents-btn group w-full"
      title={label}
    >
      <div className="folderContainer">
        {/* fileBack */}
        <svg className="fileBack" viewBox="0 0 146 113" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0 4C0 1.79086 1.79086 0 4 0H50.3802C51.8285 0 53.2056 0.62459 54.1586 1.71467L64.5238 13.5653C65.4769 14.6554 66.854 15.28 68.3022 15.28H141.726C143.945 15.28 145.742 17.0863 145.726 19.3052L145.045 113H0V4Z"
            fill="url(#paint0_linear_117_4)"
          />
          <defs>
            <linearGradient id="paint0_linear_117_4" x1="0" y1="0" x2="72.93" y2="95.4804" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--primary))" />
              <stop offset="1" stopColor="hsl(var(--primary) / 0.6)" />
            </linearGradient>
          </defs>
        </svg>

        {/* filePage */}
        <svg className="filePage" viewBox="0 0 88 99" xmlns="http://www.w3.org/2000/svg">
          <rect width="88" height="99" fill="url(#paint0_linear_117_6)" />
          <defs>
            <linearGradient id="paint0_linear_117_6" x1="0" y1="0" x2="81" y2="160.5" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" />
              <stop offset="1" stopColor="#f1f5f9" />
            </linearGradient>
          </defs>
        </svg>

        {/* fileFront */}
        <svg className="fileFront" viewBox="0 0 160 79" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0.29306 12.2478C0.133905 9.38186 2.41499 6.97059 5.28537 6.97059H30.419C31.4595 6.97059 32.4815 6.69569 33.3805 6.17446L42.0078 1.17613C42.9068 0.654915 43.9288 0.38 44.9694 0.38H149.391C152.397 0.38 154.741 2.99427 154.418 5.98246L150.21 67.5023C149.927 69.6217 148.27 70.9799 146.273 71.0991H6.86381C4.86687 71.0991 3.21075 69.74 3.07183 67.7474L0.29306 12.2478Z"
            fill="url(#paint0_linear_117_5)"
          />
          <defs>
            <linearGradient id="paint0_linear_117_5" x1="38.7619" y1="8.71323" x2="66.9106" y2="82.8317" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--primary))" />
              <stop offset="1" stopColor="hsl(var(--primary) / 0.85)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="text-block">
        <span className="text-name font-mono">{label}</span>
        <span className="text-meta">{count} {count === 1 ? 'relatório' : 'relatórios'}</span>
      </div>

      <div className="ml-auto">
        {isOpen
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform" />}
      </div>

      <style>{`
        .documents-btn {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          width: 100%;
          height: 70px;
          border: 1px solid hsl(var(--border) / 0.6);
          padding: 0 16px;
          border-radius: 12px;
          background: hsl(var(--card));
          gap: 14px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .documents-btn:hover {
          background: hsl(var(--muted) / 0.6);
          border-color: hsl(var(--primary) / 0.4);
          transform: translateY(-1px);
          box-shadow: 0 4px 18px hsl(var(--primary) / 0.12);
        }
        .documents-btn:active { transform: scale(0.98); }

        .folderContainer {
          width: 46px;
          height: 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          position: relative;
          flex-shrink: 0;
        }
        .fileBack { z-index: 1; width: 100%; height: auto; }
        .filePage {
          width: 55%;
          height: auto;
          position: absolute;
          z-index: 2;
          transition: all 0.3s ease-out;
          top: 14%;
        }
        .fileFront {
          width: 92%;
          height: auto;
          position: absolute;
          z-index: 3;
          opacity: 0.95;
          bottom: 0;
          transform-origin: bottom;
          transition: all 0.3s ease-out;
        }
        .documents-btn:hover .filePage { transform: translateY(-4px); }
        .documents-btn:hover .fileFront { transform: rotateX(28deg); }

        .text-block {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-width: 0;
          flex: 1;
        }
        .text-name {
          color: hsl(var(--foreground));
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.2px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .text-meta {
          color: hsl(var(--muted-foreground));
          font-size: 11px;
          margin-top: 2px;
        }
      `}</style>
    </button>
  );
}
