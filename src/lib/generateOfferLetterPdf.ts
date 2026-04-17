/**
 * Generate a Blue Sparrow Digitech offer letter PDF using browser canvas + jsPDF-free approach.
 * Uses a hidden iframe to render HTML and print to PDF.
 */

interface OfferLetterData {
  fullName: string;
  city: string;
  state: string;
  joiningDate: string; // formatted date string
  monthlySalary: number;
  todayDate: string; // formatted date string
}

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  return convert(num) + ' Rupees Only';
}

export function generateOfferLetterHtml(data: OfferLetterData): string {
  const salaryWords = numberToWords(data.monthlySalary);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 20mm 20mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #000; padding: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #1a3a5c; padding-bottom: 10px; }
  .company-name { font-size: 18pt; font-weight: bold; color: #1a3a5c; }
  .company-sub { font-size: 10pt; color: #1a3a5c; letter-spacing: 3px; }
  .contact-info { text-align: right; font-size: 9pt; color: #555; }
  .address-block { margin: 20px 0; }
  h2 { font-size: 12pt; text-decoration: underline; margin: 18px 0 10px 0; }
  .subject { font-size: 12pt; font-weight: bold; text-align: center; margin: 20px 0; text-decoration: underline; }
  p { margin: 8px 0; text-align: justify; }
  .signature-block { margin-top: 40px; }
  .acceptance { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 15px; }
  .sig-line { border-bottom: 1px solid #000; width: 200px; display: inline-block; margin-left: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">BLUE SPARROW</div>
      <div class="company-sub">D I G I T E C H</div>
    </div>
    <div class="contact-info">
      Phone: +44 7411 519 184<br>
      Email: hr@bluesparrow.digital<br>
      Address: 07th Floor, Al Madina building,<br>
      Saraf DG Metro Station, Bur Dubai, Dubai.
    </div>
  </div>

  <div class="address-block">
    <p>To,</p>
    <p style="text-align:right;">Date: ${data.todayDate}</p>
    <p><strong>${data.fullName},</strong></p>
    <p>${data.city}.</p>
    ${data.state ? `<p>${data.state}.</p>` : ''}
  </div>

  <div class="subject">Subject: Offer of Employment for the Position of Tele-calling Executive (Outbound Process)</div>

  <p>Dear <strong>${data.fullName}</strong>,</p>

  <p>We are pleased to offer you the position of <strong>Tele-calling Executive – Outbound Process</strong> at <strong>Blue Sparrow Digital</strong>, effective from <strong>${data.joiningDate}</strong>, subject to the terms and conditions outlined below.</p>

  <h2>1. Job Title:</h2>
  <p>Tele-calling Executive – Outbound Process.</p>

  <h2>2. Employment Type:</h2>
  <p>Full-Time, Work from Home.</p>

  <h2>3. Work Timings:</h2>
  <p>Working Hours – 10:30 AM to 07:30 PM, includes 01 Hour break time (45 Minutes lunch, Tea breaks – 15 Minutes). You will be entitled for 01 weekly off which will be subject to monthly roster.</p>

  <h2>4. Compensation:</h2>
  <p>You will be entitled to a monthly salary of <strong>Rs.${data.monthlySalary.toLocaleString('en-IN')}/-</strong> (Rupees ${salaryWords}), which will be paid on or before the 09th of each following month via bank transfer.</p>

  <h2>5. Roles and Responsibilities:</h2>
  <p>Make outbound calls to prospective customers as per the provided leads. Explain and promote our products/services. Maintain accurate records of calls and client interactions. Meet daily/weekly/monthly targets as assigned.</p>

  <h2>6. Other Terms:</h2>
  <p>This role is entirely remote; however, you are expected to maintain punctuality and regular attendance during working hours.</p>
  <p>You must have access to a personal laptop/PC with stable internet connection and a quiet working environment. Any proprietary information and customer data must be treated as strictly confidential.</p>

  <h2>7. Absconding:</h2>
  <p>In case of any candidate getting to abscond during training or before completion of probation period (03 months), company has all the rights to either freeze or withhold F&F of the candidate.</p>

  <h2>8. Termination:</h2>
  <p>Either party may terminate this employment with 30 days' written notice, if not followed may result in penalty or non-clearance of pending dues.</p>

  <p style="margin-top: 20px;">We look forward to welcoming you to our team and believe you will make a valuable contribution to our organization.</p>

  <p>Please sign and return a copy of this letter as a token of your acceptance along with a scan copy of your ID proof and address proof.</p>

  <div class="signature-block">
    <p>Sincerely,</p>
    <p style="margin-top: 30px;"><strong>Monty S.</strong></p>
    <p>Manager-Ops.</p>
    <p>Blue Sparrow Digital.</p>
  </div>

  <div class="acceptance">
    <h2 style="text-decoration: none; font-size: 13pt;">Candidate's Acceptance:</h2>
    <p>I, <strong>${data.fullName}</strong>, accept the above offer and agree to the terms and conditions outlined in this letter.</p>
    <p style="margin-top: 20px;">Signature: <span class="sig-line"></span></p>
    <p>Date: <span class="sig-line"></span></p>
  </div>
</body>
</html>`;
}

export function downloadOfferLetterPdf(data: OfferLetterData) {
  const html = generateOfferLetterHtml(data);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to download the offer letter.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to render then trigger print (Save as PDF)
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
  
  // Fallback if onload doesn't fire
  setTimeout(() => {
    printWindow.print();
  }, 1500);
}
