import React, { useState } from 'react';
import { X, Columns, Eye, Sliders, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

interface ImageComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalUrl: string;
  derivedUrl: string;
  title: string;
  subtitle?: string;
}

export const ImageComparisonModal: React.FC<ImageComparisonModalProps> = ({
  isOpen,
  onClose,
  originalUrl,
  derivedUrl,
  title,
  subtitle,
}) => {
  const [mode, setMode] = useState<'sideBySide' | 'slider' | 'toggle'>('sideBySide');
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [toggleActive, setToggleActive] = useState<'original' | 'derived'>('derived');
  const [zoom, setZoom] = useState<number>(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0B0F17] border border-[#273549] w-full max-w-6xl max-h-[92vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#1E293B] flex items-center justify-between bg-[#0F172A]">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <span>{title}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                Comparative Forensics
              </span>
            </h2>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center space-x-2 bg-[#131C2E] p-1 rounded-lg border border-[#273549]">
            <button
              onClick={() => setMode('sideBySide')}
              className={`flex items-center space-x-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                mode === 'sideBySide' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
            <button
              onClick={() => setMode('slider')}
              className={`flex items-center space-x-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                mode === 'slider' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Split Slider</span>
            </button>
            <button
              onClick={() => setMode('toggle')}
              className={`flex items-center space-x-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                mode === 'toggle' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Blink Toggle</span>
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1E293B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Controls Bar */}
        <div className="px-6 py-2 bg-[#0C121E] border-b border-[#1E293B] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-3">
            <span className="text-[11px] font-medium text-slate-300">Magnification: {Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
              className="p-1 rounded bg-[#162032] hover:bg-[#202E46] text-slate-300"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
              className="p-1 rounded bg-[#162032] hover:bg-[#202E46] text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1 rounded bg-[#162032] hover:bg-[#202E46] text-slate-300"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={derivedUrl}
              download="forensic_analysis_output.png"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#131C2E] hover:bg-[#1B273E] text-slate-300 border border-[#273549]"
            >
              <Download className="w-3 h-3 text-cyan-400" />
              <span>Export Derived Image</span>
            </a>
          </div>
        </div>

        {/* Interactive Comparison Viewport */}
        <div className="flex-1 p-6 overflow-auto bg-[#080B12] flex items-center justify-center min-h-[460px]">
          {/* 1. Side by Side Mode */}
          {mode === 'sideBySide' && (
            <div className="grid grid-cols-2 gap-6 w-full h-full items-center justify-center">
              <div className="flex flex-col items-center bg-[#0F172A] p-3 rounded-lg border border-[#1E293B]">
                <span className="text-xs font-semibold text-slate-300 mb-2">Original Evidence</span>
                <div className="overflow-hidden max-h-[460px] flex items-center justify-center">
                  <img
                    src={originalUrl}
                    alt="Original Evidence"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                    className="max-h-[420px] max-w-full object-contain rounded transition-transform"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center bg-[#0F172A] p-3 rounded-lg border border-[#1E293B]">
                <span className="text-xs font-semibold text-cyan-400 mb-2">Forensic Derived Output</span>
                <div className="overflow-hidden max-h-[460px] flex items-center justify-center">
                  <img
                    src={derivedUrl}
                    alt="Derived Forensic Output"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                    className="max-h-[420px] max-w-full object-contain rounded transition-transform"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. Split Slider Mode */}
          {mode === 'slider' && (
            <div className="relative max-h-[500px] flex flex-col items-center select-none">
              <div
                className="relative overflow-hidden rounded-lg border border-[#273549] max-h-[460px] max-w-[700px]"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              >
                {/* Background: Derived */}
                <img
                  src={derivedUrl}
                  alt="Derived"
                  className="max-h-[460px] max-w-full object-contain block"
                />
                {/* Overlay: Original clipped to slider position */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="max-h-[460px] max-w-none object-contain block"
                    style={{ width: '700px', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                {/* Split line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-md cursor-ew-resize"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-cyan-500 text-black flex items-center justify-center text-[10px] font-bold shadow-lg">
                    ⇄
                  </div>
                </div>
              </div>

              {/* Slider Controller */}
              <div className="w-80 mt-4 flex items-center space-x-3">
                <span className="text-[11px] text-slate-400">Original</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPosition}
                  onChange={(e) => setSliderPosition(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="text-[11px] text-cyan-400">Derived</span>
              </div>
            </div>
          )}

          {/* 3. Blink Toggle Mode */}
          {mode === 'toggle' && (
            <div className="flex flex-col items-center">
              <div className="relative rounded-lg border border-[#273549] overflow-hidden max-h-[460px]">
                <img
                  src={toggleActive === 'original' ? originalUrl : derivedUrl}
                  alt={toggleActive}
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                  className="max-h-[460px] max-w-full object-contain rounded transition-transform"
                />
                <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/70 backdrop-blur-sm border border-slate-700 text-xs font-mono">
                  Active View:{' '}
                  <strong className={toggleActive === 'original' ? 'text-amber-400' : 'text-cyan-400'}>
                    {toggleActive.toUpperCase()}
                  </strong>
                </div>
              </div>

              <div className="mt-4 flex items-center space-x-4">
                <button
                  onClick={() => setToggleActive('original')}
                  className={`px-4 py-1.5 text-xs rounded-md transition-all ${
                    toggleActive === 'original'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'bg-[#131C2E] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Show Original Evidence
                </button>
                <button
                  onClick={() => setToggleActive('derived')}
                  className={`px-4 py-1.5 text-xs rounded-md transition-all ${
                    toggleActive === 'derived'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'bg-[#131C2E] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Show Forensic Visualization
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
