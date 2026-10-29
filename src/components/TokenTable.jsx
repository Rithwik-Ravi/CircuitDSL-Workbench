export function TokenTable({ tokens = [] }) {
  return (
    <div className="w-full h-full overflow-auto rounded-xl border border-stone-700 bg-[#171717] p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Tokenization</h2>
        <span className="text-sm text-stone-400">
          Total Tokens: {tokens.length}
        </span>
      </div>
      {tokens.length === 0 ? (
        <p className="text-sm text-stone-400">
          No tokens found. Enter valid CircuitDSL code in the editor.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#262626] text-stone-300">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Token</th>
              <th className="p-3">Type</th>
              <th className="p-3">Line</th>
              <th className="p-3">Column</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token, index) => (
              <tr
                key={index}
                className="border-t border-stone-800 hover:bg-stone-800/50"
              >
                <td className="p-3 text-stone-500">{index + 1}</td>
                <td className="p-3 font-mono text-amber-300">
                  {String(token.value ?? token.lexeme ?? token.type ?? '')}
                </td>
                <td className="p-3 text-sky-300">
                  {String(token.type ?? token.kind ?? 'UNKNOWN')}
                </td>
                <td className="p-3 text-stone-300">
                  {token.line ?? token.loc?.line ?? '—'}
                </td>
                <td className="p-3 text-stone-300">
                  {token.column ?? token.col ?? token.loc?.column ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
