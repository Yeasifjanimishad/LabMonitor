export function escapePdfString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function generatePdfBlob(title: string, lines: string[]): Blob {
  const pdfLines = [
    `BT`,
    `/F1 16 Tf`,
    `50 740 Td`,
    `(${escapePdfString(title)}) Tj`,
    `0 -28 Td`,
    `/F1 11 Tf`
  ];

  lines.forEach((line) => {
    const cleanLine = escapePdfString(line);
    pdfLines.push(`(${cleanLine}) Tj`);
    pdfLines.push(`0 -16 Td`);
  });

  pdfLines.push(`ET`);

  const streamContent = pdfLines.join('\n');
  const streamLength = streamContent.length;

  const pdfHeader = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const pdfPages = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  const pdfPage = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  const pdfFont = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const pdfStream = `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

  const obj1Offset = pdfHeader.indexOf('1 0 obj');
  const obj2Offset = pdfHeader.length;
  const obj3Offset = obj2Offset + pdfPages.length;
  const obj4Offset = obj3Offset + pdfPage.length;
  const obj5Offset = obj4Offset + pdfFont.length;
  const xrefOffset = obj5Offset + pdfStream.length;

  const pad10 = (n: number) => n.toString().padStart(10, '0');

  const xref = `xref\n0 6\n0000000000 65535 f \n${pad10(obj1Offset)} 00000 n \n${pad10(obj2Offset)} 00000 n \n${pad10(obj3Offset)} 00000 n \n${pad10(obj4Offset)} 00000 n \n${pad10(obj5Offset)} 00000 n \n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const fullPdfString = pdfHeader + pdfPages + pdfPage + pdfFont + pdfStream + xref + trailer;

  return new Blob([fullPdfString], { type: 'application/pdf' });
}

export function triggerDocumentDownload(
  filename: string,
  title: string,
  lines: string[]
) {
  let blob: Blob;

  if (filename.toLowerCase().endsWith('.pdf')) {
    blob = generatePdfBlob(title, lines);
  } else {
    const textContent = `${title}\n${'='.repeat(title.length)}\n\n` + lines.join('\n');
    blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
