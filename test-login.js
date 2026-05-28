
const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:3001/auth/login', {
      email: 'admin@universidad.edu.pe',
      password: 'ThesisReview2025!'
    });
    console.log('Login successful:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Login failed with status:', error.response.status);
      console.error('Message:', error.response.data.message);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testLogin();
