const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  try {
    const form = new FormData();
    const fileStream = fs.createReadStream('./attached_assets/new_FZ604.json');
    form.append('jsonFile', fileStream);

    const response = await fetch('http://localhost:3001/api/upload/json', {
      method: 'POST',
      body: form
    });

    const result = await response.json();
    console.log('Upload result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Upload error:', error);
  }
}

testUpload();
