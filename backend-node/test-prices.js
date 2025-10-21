// Test script to check if the prices API works
import fetch from 'node-fetch';

async function testPricesAPI() {
  try {
    console.log('Testing prices API...');
    const response = await fetch('http://localhost:3000/api/prices');
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPricesAPI();