const nodemailer = require('nodemailer');

// Import PDF Generator
const { generateReceiptPdfBuffer } = require('../src/lib/pdfGenerator');

async function testOfficialReceiptEmail() {
  const pdfBuffer = generateReceiptPdfBuffer({
    receiptNo: 'CM/CTE/2026/0892',
    studentName: 'Abhigyan Mishra',
    courseName: 'Full Stack Web Development & AI',
    amountPaid: 15000,
    paymentDate: '24/07/2026',
    paymentMode: 'UPI / Online Transfer',
    referenceNo: 'UPI/998822334411',
    brandName: 'CADD MANTRA',
    brandAddress: 'G 11, Murli Bhawan, 10-A, Ashok Marg, Lucknow',
    companyName: 'M/s CT ENTERPRISES',
    totalFee: 45000,
    totalPaidToDate: 30000,
    remainingBalance: 15000
  });

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: 'cashf9027@gmail.com', pass: 'odizzvusdnpzwdfm' }
  });

  const info = await transporter.sendMail({
    from: 'CoachFlow Academics <cashf9027@gmail.com>',
    to: 'cashf9027@gmail.com',
    subject: 'Official Fee Payment Receipt - CM/CTE/2026/0892 (Abhigyan Mishra)',
    text: 'Dear Abhigyan Mishra,\n\nYour payment of ₹15,000 has been received.\nReceipt # CM/CTE/2026/0892 attached.',
    html: '<h1>COACHFLOW ACADEMICS</h1><p>Dear Abhigyan Mishra,</p><p>Payment receipt <strong>CM/CTE/2026/0892</strong> for ₹15,000.</p><p>Official PDF Fee Receipt attached.</p>',
    attachments: [
      {
        filename: 'Official_Fee_Receipt_CM_CTE_2026_0892.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });

  console.log('Official Fee Receipt Email Verification Result: MessageId:', info.messageId);
}

testOfficialReceiptEmail().catch(err => { console.error(err); process.exit(1); });
