import React from 'react';

export function TruthTable({ truthTable }) {
  if (truthTable.truncated) {
    return (
      <div className="p-4 bg-[#292524] rounded-2xl border border-[#44403c] text-amber-400 text-xs">
        Truth Table truncated (Circuit exceeds maximum limit of 8 primary inputs
        for exhaustive rendering).
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 bg-[#1c1917] overflow-auto text-xs">
      <div className="bg-[#292524] rounded-2xl border border-[#44403c] overflow-hidden">
        <table className="w-full text-left font-mono">
          <thead className="bg-[#1c1917] border-b border-[#44403c]">
            <tr>
              {truthTable.inputs?.map((i) => (
                <th
                  key={i}
                  className="p-2 text-[#f59e0b] border-r border-[#44403c]"
                >
                  {i}
                </th>
              ))}
              {truthTable.outputs?.map((o) => (
                <th key={o} className="p-2 text-[#10b981]">
                  {o}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {truthTable.rows?.map((row, idx) => (
              <tr
                key={idx}
                className={`border-b border-[#44403c]/40 ${row.isCurrentMatch ? 'bg-[#10b981]/20 font-bold' : ''}`}
              >
                {truthTable.inputs?.map((i) => (
                  <td key={i} className="p-2 border-r border-[#44403c]">
                    {row.inputs[i]}
                  </td>
                ))}
                {truthTable.outputs?.map((o, oIdx) => (
                  <td key={oIdx} className="p-2 text-[#10b981]">
                    {row.outputs[oIdx]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
