const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { format, differenceInDays } = require('date-fns');

const prisma = new PrismaClient();

const STATUS_LABELS = {
  ACTIVE: 'Active',
  NOTICE_DUE: 'Notice Due',
  NOTICE_SENT: 'Notice Sent',
  EXPIRED: 'Expired',
};

async function fetchAllCerts() {
  return prisma.certification.findMany({
    include: {
      scanner: true,
      notifications: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { expiryDate: 'asc' },
  });
}

// ─── PDF helpers ────────────────────────────────────────────────────────────

function drawTableRow(doc, cols, values, { bg, bold } = {}) {
  const rowH = 22;
  const startX = 40;
  const startY = doc.y;

  if (bg) {
    doc.rect(startX, startY, cols.reduce((s, c) => s + c.width, 0), rowH).fill(bg).fillColor('black');
  }

  let x = startX;
  values.forEach((val, i) => {
    doc.fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(String(val ?? '—'), x + 3, startY + 6, { width: cols[i].width - 6, lineBreak: false });
    x += cols[i].width;
  });
  doc.y = startY + rowH;
}

function addPdfHeader(doc, title) {
  doc.fontSize(16).font('Helvetica-Bold').text('ScanPort – Port Scanner System', 40, 40);
  doc.fontSize(11).font('Helvetica').text(title, 40, 62);
  doc.fontSize(9).text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 40, 78);
  doc.moveDown(2);
}

// ─── Expiry Report ──────────────────────────────────────────────────────────

async function expiryReportPdf(req, res, next) {
  try {
    const certs = await fetchAllCerts();
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="expiry-report.pdf"');
    doc.pipe(res);

    addPdfHeader(doc, 'Certification Expiry Report');

    const cols = [
      { header: 'Scanner Serial', width: 120 },
      { header: 'Accelerator Serial', width: 120 },
      { header: 'Location', width: 110 },
      { header: 'Inspection Date', width: 90 },
      { header: 'Expiry Date', width: 90 },
      { header: 'Days to Expiry', width: 80 },
      { header: 'Status', width: 80 },
    ];

    drawTableRow(doc, cols, cols.map((c) => c.header), { bg: '#1e3a5f', bold: true });
    doc.fillColor('white');
    doc.y -= 22;
    drawTableRow(doc, cols, cols.map((c) => c.header), { bg: '#1e3a5f', bold: true });
    doc.fillColor('black');

    certs.forEach((cert, i) => {
      const days = differenceInDays(new Date(cert.expiryDate), new Date());
      const bg = i % 2 === 0 ? '#f9fafb' : 'white';
      drawTableRow(doc, cols, [
        cert.scanner.serialNumber,
        cert.scanner.acceleratorSerial,
        cert.scanner.location || '—',
        format(new Date(cert.inspectionDate), 'dd/MM/yyyy'),
        format(new Date(cert.expiryDate), 'dd/MM/yyyy'),
        days < 0 ? 'EXPIRED' : String(days),
        STATUS_LABELS[cert.status] || cert.status,
      ], { bg });
    });

    doc.end();
  } catch (err) { next(err); }
}

async function expiryReportExcel(req, res, next) {
  try {
    const certs = await fetchAllCerts();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ScanPort';
    const ws = wb.addWorksheet('Expiry Report');

    ws.columns = [
      { header: 'Scanner Serial', key: 'serial', width: 20 },
      { header: 'Accelerator Serial', key: 'accSerial', width: 22 },
      { header: 'Location', key: 'location', width: 22 },
      { header: 'Manufacturer', key: 'manufacturer', width: 15 },
      { header: 'Inspection Date', key: 'inspDate', width: 18 },
      { header: 'Expiry Date', key: 'expDate', width: 18 },
      { header: 'Notice Date', key: 'noticeDate', width: 18 },
      { header: 'Days to Expiry', key: 'days', width: 15 },
      { header: 'Cert Status', key: 'certStatus', width: 14 },
      { header: 'Operational Status', key: 'status', width: 18 },
    ];

    // Header styling
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });

    const STATUS_COLORS = { ACTIVE: 'FF16a34a', NOTICE_DUE: 'FFd97706', NOTICE_SENT: 'FF2563eb', EXPIRED: 'FFdc2626' };

    certs.forEach((cert, i) => {
      const days = differenceInDays(new Date(cert.expiryDate), new Date());
      const row = ws.addRow({
        serial: cert.scanner.serialNumber,
        accSerial: cert.scanner.acceleratorSerial,
        location: cert.scanner.location || '',
        manufacturer: cert.scanner.manufacturer,
        inspDate: format(new Date(cert.inspectionDate), 'dd/MM/yyyy'),
        expDate: format(new Date(cert.expiryDate), 'dd/MM/yyyy'),
        noticeDate: format(new Date(cert.noticeDate), 'dd/MM/yyyy'),
        days: days < 0 ? 'EXPIRED' : days,
        certStatus: cert.certificateStatus,
        status: STATUS_LABELS[cert.status] || cert.status,
      });
      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }
      const statusCell = row.getCell('status');
      const color = STATUS_COLORS[cert.status];
      if (color) statusCell.font = { bold: true, color: { argb: color } };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="expiry-report.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
}

// ─── Notice Tracking Report ──────────────────────────────────────────────────

async function noticeReportPdf(req, res, next) {
  try {
    const certs = await fetchAllCerts();
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="notice-tracking-report.pdf"');
    doc.pipe(res);

    addPdfHeader(doc, 'NRA Notice Tracking Report');

    const cols = [
      { header: 'Scanner Serial', width: 110 },
      { header: 'Expiry Date', width: 80 },
      { header: 'Notice Date', width: 80 },
      { header: 'Status', width: 80 },
      { header: 'Notice Status', width: 80 },
      { header: 'Date Sent', width: 80 },
      { header: 'Method', width: 65 },
      { header: 'Reference #', width: 100 },
    ];

    drawTableRow(doc, cols, cols.map((c) => c.header), { bg: '#1e3a5f', bold: true });
    doc.fillColor('black');

    certs.forEach((cert, i) => {
      const n = cert.notifications[0];
      const bg = i % 2 === 0 ? '#f9fafb' : 'white';
      drawTableRow(doc, cols, [
        cert.scanner.serialNumber,
        format(new Date(cert.expiryDate), 'dd/MM/yyyy'),
        format(new Date(cert.noticeDate), 'dd/MM/yyyy'),
        STATUS_LABELS[cert.status] || cert.status,
        n?.noticeStatus === 'SENT' ? 'Sent' : 'Not Sent',
        n?.dateSent ? format(new Date(n.dateSent), 'dd/MM/yyyy') : '—',
        n?.method || '—',
        n?.referenceNumber || '—',
      ], { bg });
    });

    doc.end();
  } catch (err) { next(err); }
}

async function noticeReportExcel(req, res, next) {
  try {
    const certs = await fetchAllCerts();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ScanPort';
    const ws = wb.addWorksheet('Notice Tracking');

    ws.columns = [
      { header: 'Scanner Serial', key: 'serial', width: 20 },
      { header: 'Expiry Date', key: 'expDate', width: 18 },
      { header: 'Notice Date (4 months before)', key: 'noticeDate', width: 28 },
      { header: 'Operational Status', key: 'status', width: 20 },
      { header: 'Notice Status', key: 'noticeStatus', width: 16 },
      { header: 'Date Sent', key: 'dateSent', width: 18 },
      { header: 'Method', key: 'method', width: 12 },
      { header: 'Reference #', key: 'refNum', width: 22 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    certs.forEach((cert, i) => {
      const n = cert.notifications[0];
      const row = ws.addRow({
        serial: cert.scanner.serialNumber,
        expDate: format(new Date(cert.expiryDate), 'dd/MM/yyyy'),
        noticeDate: format(new Date(cert.noticeDate), 'dd/MM/yyyy'),
        status: STATUS_LABELS[cert.status] || cert.status,
        noticeStatus: n?.noticeStatus === 'SENT' ? 'Sent' : 'Not Sent',
        dateSent: n?.dateSent ? format(new Date(n.dateSent), 'dd/MM/yyyy') : '',
        method: n?.method || '',
        refNum: n?.referenceNumber || '',
        notes: n?.notes || '',
      });
      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="notice-tracking.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
}

// ─── NRA Renewal Notice Letter ───────────────────────────────────────────────

async function nraLetter(req, res, next) {
  try {
    const { certificationId } = req.params;

    const cert = await prisma.certification.findUniqueOrThrow({
      where: { id: certificationId },
      include: { scanner: true, notifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const pa      = process.env.PORT_AUTHORITY_NAME    || 'Port Authority';
    const paAddr  = process.env.PORT_AUTHORITY_ADDRESS || '';
    const paTel   = process.env.PORT_AUTHORITY_TEL     || '';
    const paEmail = process.env.PORT_AUTHORITY_EMAIL   || '';
    const nraAddr = (process.env.NRA_ADDRESS || 'Nuclear Regulatory Authority\nAccra, Ghana')
                      .replace(/\\n/g, '\n');
    const refNum  = cert.notifications[0]?.referenceNumber || `NRA-${format(new Date(), 'yyyy')}-REF-${cert.scanner.serialNumber}`;

    const doc = new PDFDocument({ margin: 72, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="NRA-Letter-${cert.scanner.serialNumber}-${format(new Date(), 'yyyyMMdd')}.pdf"`);
    doc.pipe(res);

    const L = 72, W = doc.page.width - 144;

    // ── Header bar ──
    doc.rect(0, 0, doc.page.width, 80).fill('#1e3a5f');
    doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
       .text(pa, L, 22, { width: W });
    doc.fontSize(9).font('Helvetica')
       .text(`${paAddr}   |   Tel: ${paTel}   |   ${paEmail}`, L, 44, { width: W });
    doc.fillColor('black');

    let y = 100;

    // ── Date + Ref ──
    doc.fontSize(10).font('Helvetica')
       .text(`Date: ${format(new Date(), 'dd MMMM yyyy')}`, L, y)
       .text(`Ref:  ${refNum}`, L, y + 16);
    y += 50;

    // ── Addressee ──
    doc.font('Helvetica-Bold').text('TO:', L, y);
    doc.font('Helvetica').text(nraAddr, L + 30, y);
    y += (nraAddr.split('\n').length * 14) + 28;

    // ── Salutation ──
    doc.font('Helvetica').text('Dear Sir / Madam,', L, y);
    y += 28;

    // ── Subject ──
    doc.font('Helvetica-Bold')
       .text(`RE: NOTIFICATION OF UPCOMING RADIATION CERTIFICATE EXPIRY – SCANNER ${cert.scanner.serialNumber}`, L, y, { width: W });
    y += 40;

    // ── Body ──
    doc.font('Helvetica').fontSize(10).text(
      `In accordance with the requirements of the Nuclear Regulatory Authority Act, ` +
      `we hereby formally notify the Authority of the upcoming expiry of the radiation ` +
      `certificate for the following scanner equipment operated by ${pa}:`,
      L, y, { width: W, lineGap: 4 }
    );
    y = doc.y + 20;

    // ── Details table ──
    const rows = [
      ['Equipment Type',        `${cert.scanner.type} (${cert.scanner.manufacturer})`],
      ['Scanner Serial Number', cert.scanner.serialNumber],
      ['Accelerator Serial No.', cert.scanner.acceleratorSerial],
      ['Location',              cert.scanner.location || 'Not specified'],
      ['Last Inspection Date',  format(new Date(cert.inspectionDate), 'dd MMMM yyyy')],
      ['Certificate Expiry Date', format(new Date(cert.expiryDate), 'dd MMMM yyyy')],
      ['Current Certificate Status', cert.certificateStatus],
    ];

    const col1 = 200, col2 = W - col1, rowH = 22;
    rows.forEach(([label, value], i) => {
      const bg = i % 2 === 0 ? '#f3f4f6' : '#ffffff';
      doc.rect(L, y, col1, rowH).fill(bg);
      doc.rect(L + col1, y, col2, rowH).fill(bg);
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9)
         .text(label, L + 6, y + 6, { width: col1 - 10, lineBreak: false });
      doc.fillColor('#111827').font('Helvetica').fontSize(9)
         .text(value, L + col1 + 6, y + 6, { width: col2 - 10, lineBreak: false });
      doc.fillColor('black');
      y += rowH;
    });

    y += 24;

    // ── Second paragraph ──
    doc.font('Helvetica').fontSize(10).text(
      `We respectfully request that the Authority schedules the necessary inspection and ` +
      `renewal of the radiation certificate at the earliest possible date to ensure ` +
      `continued compliance and uninterrupted port operations.`,
      L, y, { width: W, lineGap: 4 }
    );
    y = doc.y + 16;

    doc.text(
      `Please acknowledge receipt of this notification and advise on the scheduled ` +
      `inspection date at your earliest convenience.`,
      L, y, { width: W, lineGap: 4 }
    );
    y = doc.y + 28;

    // ── Closing ──
    doc.text('Yours faithfully,', L, y);
    y += 60;
    doc.font('Helvetica-Bold').text('_______________________________', L, y);
    y += 16;
    doc.text('Authorised Signatory', L, y);
    y += 14;
    doc.font('Helvetica').text(pa, L, y);

    // ── Footer ──
    doc.rect(0, doc.page.height - 36, doc.page.width, 36).fill('#1e3a5f');
    doc.fillColor('white').fontSize(8)
       .text(
         `Generated by ScanPort Certification Management System on ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
         L, doc.page.height - 24, { width: W, align: 'center' }
       );

    doc.end();
  } catch (err) { next(err); }
}

module.exports = { expiryReportPdf, expiryReportExcel, noticeReportPdf, noticeReportExcel, nraLetter };
