
import React, { useMemo } from 'react';
import { LogEntry } from '../types';
import { generateChronicle } from '../utils/scribe';
import { X, Feather, Calendar, Crown, Skull, Sparkles, Scroll, Download } from 'lucide-react';

interface ScribeChronicleProps {
  history: LogEntry[];
  onClose: () => void;
}

export const ScribeChronicle: React.FC<ScribeChronicleProps> = ({ history, onClose }) => {
  const data = useMemo(() => generateChronicle(history), [history]);

  const downloadChronicle = () => {
    const text = `
=== THE SCRIBE'S CHRONICLE ===
Title: ${data.title}
Active Since: ${data.startDate} (${data.daysActive} days)

-- FATE ANALYSIS --
Chaos Factor: ${data.chaosFactor}
Rituals Performed: ${data.ritualsPerformed}
Pity Redemptions: ${data.pityRedemptions}
Omni-Keys Found: ${data.omniKeysFound}

-- LEGENDARY MOMENTS --
Luckiest Roll: ${data.luckiestMoment ? `${data.luckiestMoment.rollValue} on ${data.luckiestMoment.source}` : 'None'}
Most Tragic Fail: ${data.tragicMoment ? `${data.tragicMoment.rollValue} on ${data.tragicMoment.source}` : 'None'}

-- MAJOR UNLOCKS --
${data.majorUnlocks.map(u => `* ${u.message}`).join('\n')}
    `;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronicle_${Date.now()}.txt`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-300">
      <style>{`
        .custom-scrollbar-sepia::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar-sepia::-webkit-scrollbar-track {
          background: #d4c5b0;
          border-radius: 4px;
        }
        .custom-scrollbar-sepia::-webkit-scrollbar-thumb {
          background: #8b7e66;
          border-radius: 4px;
          border: 1px solid #5c4d3c;
        }
        .custom-scrollbar-sepia::-webkit-scrollbar-thumb:hover {
          background: #5c4d3c;
        }
      `}</style>
      
      {/* The Scroll Container */}
      <div className="relative w-full max-w-2xl bg-[#e3dac9] text-[#2c241b] rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Paper Texture Overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>
        
        {/* Decorative Border */}
        <div className="absolute inset-2 border-2 border-[#8b7e66] rounded-sm pointer-events-none"></div>
        <div className="absolute inset-3 border border-[#8b7e66]/50 rounded-sm pointer-events-none"></div>

        {/* Header */}
        <div className="relative z-10 p-8 pb-4 text-center border-b border-[#8b7e66]/30">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-[#2c241b] rounded-full text-[#e3dac9]">
                <Feather size={24} />
            </div>
          </div>
          <h2 className="font-serif text-3xl font-bold uppercase tracking-widest text-[#2c241b]">The Chronicle</h2>
          <p className="font-serif italic text-[#5c4d3c] mt-1">"The ink is dry, the fate is sealed."</p>
          
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-[#d4c5b0] rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 p-8 overflow-y-auto custom-scrollbar-sepia space-y-8 font-serif">
          
          {/* Identity Section */}
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b7e66]">Designation</span>
            <h1 className="text-4xl font-black text-[#8b0000] uppercase tracking-wide">{data.title}</h1>
            <div className="flex items-center justify-center gap-4 text-sm font-bold text-[#5c4d3c] mt-2">
                <span className="flex items-center gap-1"><Calendar size={14} /> Since {data.startDate}</span>
                <span>•</span>
                <span>{data.daysActive} Days Active</span>
            </div>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#d4c5b0]/50 p-4 rounded border border-[#bfaea0] text-center">
                <Crown className="w-6 h-6 mx-auto mb-2 text-[#8b0000]" />
                <div className="text-2xl font-bold">{data.omniKeysFound}</div>
                <div className="text-[10px] uppercase tracking-widest font-bold opacity-60">Omni-Keys</div>
            </div>
            <div className="bg-[#d4c5b0]/50 p-4 rounded border border-[#bfaea0] text-center">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-[#4b0082]" />
                <div className="text-2xl font-bold">{data.ritualsPerformed}</div>
                <div className="text-[10px] uppercase tracking-widest font-bold opacity-60">Rituals</div>
            </div>
            <div className="bg-[#d4c5b0]/50 p-4 rounded border border-[#bfaea0] text-center">
                <Skull className="w-6 h-6 mx-auto mb-2 text-[#2c241b]" />
                <div className="text-2xl font-bold">{data.pityRedemptions}</div>
                <div className="text-[10px] uppercase tracking-widest font-bold opacity-60">Pities</div>
            </div>
          </div>

          {/* Narrative Highlights */}
          <div className="space-y-4">
            <h3 className="text-center font-bold uppercase tracking-widest border-b border-[#8b7e66]/30 pb-2 text-[#2c241b]">Tales of Fortune</h3>
            
            {data.luckiestMoment ? (
                <div className="flex gap-4 items-start bg-green-900/10 p-4 rounded border border-green-900/20">
                    <div className="mt-1"><Sparkles size={18} className="text-green-700" /></div>
                    <div>
                        <h4 className="font-bold text-green-900 text-sm uppercase">The Miracle</h4>
                        <p className="text-sm leading-relaxed opacity-80">
                            On {new Date(data.luckiestMoment.timestamp).toLocaleDateString()}, you rolled a 
                            <span className="font-bold mx-1">{data.luckiestMoment.rollValue}</span> 
                            on <span className="italic">{data.luckiestMoment.source}</span>, defying the odds.
                        </p>
                    </div>
                </div>
            ) : <div className="text-center text-sm italic opacity-50">No miracles recorded yet...</div>}

            {data.tragicMoment ? (
                <div className="flex gap-4 items-start bg-red-900/10 p-4 rounded border border-red-900/20">
                    <div className="mt-1"><Skull size={18} className="text-red-700" /></div>
                    <div>
                        <h4 className="font-bold text-red-900 text-sm uppercase">The Tragedy</h4>
                        <p className="text-sm leading-relaxed opacity-80">
                            Fate was cruel when you rolled a 
                            <span className="font-bold mx-1">{data.tragicMoment.rollValue}</span> 
                            on <span className="italic">{data.tragicMoment.source}</span>.
                        </p>
                    </div>
                </div>
            ) : null}
          </div>

          {/* Recent History */}
          <div>
            <h3 className="text-center font-bold uppercase tracking-widest border-b border-[#8b7e66]/30 pb-2 text-[#2c241b] mb-4">Recent Inscriptions</h3>
            <div className="space-y-2 text-sm font-mono opacity-80">
                {history.slice(-5).reverse().map(entry => (
                    <div key={entry.id} className="flex justify-between border-b border-[#8b7e66]/10 pb-1">
                        <span>{entry.message}</span>
                        <span className="opacity-50 text-xs">{new Date(entry.timestamp).toLocaleDateString()}</span>
                    </div>
                ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="relative z-10 bg-[#d4c5b0] p-4 border-t border-[#8b7e66]/30 flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5c4d3c]">{data.chaosFactor}</span>
            <button 
                onClick={downloadChronicle}
                className="flex items-center gap-2 px-4 py-2 bg-[#2c241b] text-[#e3dac9] rounded text-xs font-bold uppercase tracking-widest hover:bg-[#4a3e30] transition-colors"
            >
                <Download size={14} /> Save Chronicle
            </button>
        </div>

      </div>
    </div>
  );
};
