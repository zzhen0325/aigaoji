const axios = require('axios');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://fund.eastmoney.com/'
};

async function checkFund(code) {
  try {
    console.log(`Checking fund: ${code}`);
    // Mock the API call structure based on proxy
    // Direct call to Eastmoney API
    const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition?FCODE=${code}&PLATFORM=12&DEVICEID=1`;
    const response = await axios.get(url, { headers });
    const data = response.data;
    
    if (data && data.Datas) {
      console.log('Holdings found:', data.Datas.length);
      data.Datas.forEach(item => {
        console.log(`Code: ${item.GPDM}, Name: ${item.GPJC}, Weight: ${item.JZBL}%, Market: ${item.MARKET}`);
      });
      
      const totalWeight = data.Datas.reduce((acc, cur) => acc + parseFloat(cur.JZBL), 0);
      console.log('Total Weight:', totalWeight.toFixed(2) + '%');
    } else {
      console.log('No holdings data found.');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Check both funds
(async () => {
  await checkFund('025500'); // User mentioned this
  await checkFund('002112'); // User mentioned this
})();
