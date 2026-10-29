export function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTruthTableCSV(truthTable) {
  if (!truthTable.rows || truthTable.rows.length === 0) return;
  const headers = [...truthTable.inputs, ...truthTable.outputs].join(',');
  const rowsCSV = truthTable.rows
    .map((r) => {
      const inVals = truthTable.inputs.map((i) => r.inputs[i]);
      return [...inVals, ...r.outputs].join(',');
    })
    .join('\n');

  downloadFile(`${headers}\n${rowsCSV}`, 'truth_table.csv', 'text/csv');
}
