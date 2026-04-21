import { Folder as FolderIcon } from 'lucide-react';
import { Frame } from 'lucide-react';
interface FolderProps {
  name: string;
  itemCount: number;
}

export default function Folder({ name, itemCount }: FolderProps) {
  return (
    <div className="flex flex-col items-center gap-3 w-[200px]">
      <div className="relative w-full aspect-[4/3] flex items-center justify-center">
        <div className="absolute inset-0 opacity-20">
          <Vector />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center gap-2 w-full h-full p-6">
          <div className="w-20 h-16">
            <Frame />
          </div>
          <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-1">
            <span className="text-xs font-medium text-gray-700">{itemCount}</span>
          </div>
        </div>

        <div className="absolute bottom-2 left-2">
          <FolderIcon className="w-16 h-16 text-[#5b7fc7] fill-[#dfe5f0]" />
        </div>
      </div>

      <div className="text-center w-full">
        <p className="text-sm font-medium text-gray-900 truncate px-2">{name}</p>
      </div>
    </div>
  );
}
