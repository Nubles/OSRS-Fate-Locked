
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import { StickyNote, Save, X } from 'lucide-react';

interface NoteTriggerProps {
  id: string; // The ID of the skill/region/item
  title?: string;
  className?: string;
}

export const NoteTrigger: React.FC<NoteTriggerProps> = ({ id, title, className }) => {
  const { userNotes, saveNote } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(userNotes[id] || '');

  const hasNote = !!userNotes[id] && userNotes[id].trim().length > 0;

  const handleSave = () => {
    saveNote(id, text);
    setIsOpen(false);
  };

  return (
    <>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        className={`p-1.5 rounded transition-all z-20 ${hasNote ? 'text-yellow-400 bg-yellow-900/40 hover:bg-yellow-900/60 shadow-[0_0_5px_rgba(250,204,21,0.3)]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'} ${className}`}
        title={hasNote ? "View Note" : "Add Note"}
      >
        <StickyNote size={12} fill={hasNote ? "currentColor" : "none"} />
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
          <div className="bg-[#1e1e1e] border border-yellow-600/30 w-full max-w-md rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-yellow-900/20 p-3 border-b border-yellow-600/20 flex justify-between items-center">
              <h3 className="text-yellow-500 font-bold text-sm flex items-center gap-2">
                <StickyNote size={16} /> Note: {title || id}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            
            <div className="p-4">
              <textarea 
                className="w-full h-32 bg-[#121212] border border-[#333] rounded p-3 text-sm text-gray-200 focus:border-yellow-500/50 focus:outline-none resize-none font-mono"
                placeholder="Write your plans here... (e.g. 'Farm Blue Dragons after 70 Agility')"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
            </div>

            <div className="p-3 border-t border-[#333] bg-[#151515] flex justify-end gap-2">
              <button onClick={() => setIsOpen(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button 
                onClick={handleSave} 
                className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs rounded flex items-center gap-1.5 transition-colors"
              >
                <Save size={14} /> Save Note
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
