import React, { useState } from 'react';
import { Copy, Download, Check, FileCode } from 'lucide-react';
import { downloadFile } from '../utils/exportUtils.js';

export function VerilogViewer({ verilog = '', testbench = '', circuitName = 'Circuit' }) {
  const [activeTab, setActiveTab] = useState('module'); // 'module' or 'testbench'
  const [copied, setCopied] = useState(false);

  const activeContent = activeTab === 'module' ? verilog : testbench;
  const fileName = activeTab === 'module' ? `${circuitName}.v` : `${circuitName}_tb.v`;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadFile(activeContent, fileName, 'text/plain');
  };

  return (
    <div className="flex flex-col h-full bg-[#181615] text-[#d6d3d1]">
      {/* Top Header */}
      <div className="h-10 bg-[#22201e] px-4 border-b border-[#3b3836] flex items-center justify-between text-xs select-none">
        <div className="flex space-x-1 bg-[#181615] p-1 rounded-lg border border-[#44403c]">
          <button
            onClick={() => setActiveTab('module')}
            className={`px-3 py-1 font-semibold rounded transition-colors ${
              activeTab === 'module'
                ? 'bg-amber-600 text-white'
                : 'text-[#a8a29e] hover:text-white'
            }`}
          >
            Verilog Module (.v)
          </button>
          <button
            onClick={() => setActiveTab('testbench')}
            className={`px-3 py-1 font-semibold rounded transition-colors ${
              activeTab === 'testbench'
                ? 'bg-amber-600 text-white'
                : 'text-[#a8a29e] hover:text-white'
            }`}
          >
            Self-Checking Testbench (.v)
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2e2a28] hover:bg-[#3d3835] text-[#e7e5e4] rounded font-medium transition-colors border border-[#44403c]"
            title="Copy to clipboard"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2e2a28] hover:bg-[#3d3835] text-[#e7e5e4] rounded font-medium transition-colors border border-[#44403c]"
            title={`Download ${fileName}`}
          >
            <Download size={13} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Code Viewer: Selectable text */}
      <div className="flex-1 overflow-auto p-4 select-text">
        <pre className="font-mono text-xs text-[#d6d3d1] leading-relaxed whitespace-pre font-normal">
          {activeContent}
        </pre>
      </div>
    </div>
  );
}
