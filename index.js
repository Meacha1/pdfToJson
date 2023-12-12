const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const pdf = require('pdf-parse');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'upload.html'));
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const dataBuffer = await fs.readFile(req.file.path);
    const pdfData = await pdf(dataBuffer);

    // Extract text content from the PDF
    const pdfText = pdfData.text;

    // Split the text into rows using "NEFT" as the delimiter
    let rows = pdfText.split('NEFT').map(row => 'NEFT' + row.trim().replace(/\s+/g, ''));
    // Remove the first row as it is not required
    rows.shift();

    // Headers for the result
    const headers = [
      'Pymt_Mode',
      'File_Sequence_Num',
      'Debit_Acct_no',
      'Beneficiary_Name',
      'Beneficiary_Account_No',
      'Bene_IFSC_Code',
      'Amount',
      'Remark',
      'Pymt_Date',
      'STATUS',
      'Customer_Ref_No',
      'UTR_NO'
    ];

    // Split each row into a list of columns
    rows = rows.map(row => {
        const beneficiaryNameEnd = row.slice(24).search(/\d/); // Find the position of the next number
        const beneficiaryNameLength =
          beneficiaryNameEnd > 0 ? beneficiaryNameEnd : row.slice(24).length;
      
        // Extract numeric characters after "Beneficiary_Name" as "Beneficiary_Account_No"
        const beneficiaryAccountNo = row
          .slice(24 + beneficiaryNameLength)
          .match(/\d+/)[0];
      
        // Extract the amount from the remaining part after "Bene_IFSC_Code"
        const remainingPart = row.slice(24 + beneficiaryNameLength + beneficiaryAccountNo.length + 11);
        const amountMatch = remainingPart.match(/^\d+\.\d+/); // Match numeric and dot characters at the start
        const amount = amountMatch ? amountMatch[0] : '';
      
        return [
          row.slice(0, 4), // Pymt_Mode: 'NEFT'
          row.slice(4, 12), // File_Sequence_Num: '29113650'
          row.slice(12, 24), // Debit_Acct_no: '064005000078'
          row.slice(24, 24 + beneficiaryNameLength), // Beneficiary_Name
          beneficiaryAccountNo, // Beneficiary_Account_No
          row.slice(24 + beneficiaryNameLength + beneficiaryAccountNo.length, 24 + beneficiaryNameLength + beneficiaryAccountNo.length + 11), // Bene_IFSC_Code
          amount, // Amount
          row.slice(-37 - beneficiaryNameLength, -37), // Remark
          row.slice(-37, -27), // Pymt_Date
          row.slice(-27, -20),
          row.slice(-20, -10), // Customer_Ref_No
          row.slice(-10), // UTR_NO
        ];
      });
      
    
    // Create a list of objects with the data
    const result = rows.map(row => Object.fromEntries(headers.map((header, i) => [header, row[i]])));

    // Return the data as JSON
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3000, () => console.log('Server started on port 3000'));
