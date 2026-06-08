// helper/serviceability.js
const axios = require('axios');

const checkShadowfaxServiceability = async (pickupLat, pickupLon, dropLat, dropLon) => {
  
    console.log(pickupLat, pickupLon, dropLat, dropLon)
  // ============================================
  // VALIDATIONS - Added without changing old response
  // ============================================
  
  // Check for null, undefined, or empty values
  if (!pickupLat || pickupLat == 0) {
    return {
      success: false,
      serviceable: false,
      message: 'Pickup location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Pickup latitude is missing'
    };
  }
  
  if (!pickupLon || pickupLon == 0) {
    return {
      success: false,
      serviceable: false,
      message: 'Pickup location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Pickup longitude is missing'
    };
  }
  
  if (!dropLat || dropLat == 0) {
    return {
      success: false,
      serviceable: false,
      message: 'Drop location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Drop latitude is missing'
    };
  }
  
  if (!dropLon || dropLon == 0) {
    return {
      success: false,
      serviceable: false,
      message: 'Drop location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Drop longitude is missing'
    };
  }
  
  // Convert to numbers for validation
  const pickupLatNum = parseFloat(pickupLat);
  const pickupLonNum = parseFloat(pickupLon);
  const dropLatNum = parseFloat(dropLat);
  const dropLonNum = parseFloat(dropLon);
  
  // Check if values are valid numbers
  if (isNaN(pickupLatNum)) {
    return {
      success: false,
      serviceable: false,
      message: ' Pickup  location coordinates are missing..',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Pickup latitude is not a valid number'
    };
  }
  
  if (isNaN(pickupLonNum)) {
    return {
      success: false,
      serviceable: false,
      message: ' Pickup location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Pickup longitude is not a valid number'
    };
  }
  
  if (isNaN(dropLatNum)) {
    return {
      success: false,
      serviceable: false,
      message: 'Empty drop Lat/Long.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Drop latitude is not a valid number'
    };
  }
  
  if (isNaN(dropLonNum)) {
    return {
      success: false,
      serviceable: false,
      message: 'Drop location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Drop longitude is not a valid number'
    };
  }
  
  // Validate latitude range (-90 to 90)
  if (pickupLatNum < -90 || pickupLatNum > 90) {
    return {
      success: false,
      serviceable: false,
      message: 'Pickup location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Pickup latitude must be between -90 and 90'
    };
  }
  
  // Validate longitude range (-180 to 180)
  if (pickupLonNum < -180 || pickupLonNum > 180) {
    return {
      success: false,
      serviceable: false,
      message: 'Pickup location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Pickup longitude must be between -180 and 180'
    };
  }
  
  // Validate drop latitude range (-90 to 90)
  if (dropLatNum < -90 || dropLatNum > 90) {
    return {
      success: false,
      serviceable: false,
      message: 'Drop location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Drop latitude must be between -90 and 90'
    };
  }
  
  // Validate drop longitude range (-180 to 180)
  if (dropLonNum < -180 || dropLonNum > 180) {
    return {
      success: false,
      serviceable: false,
      message: 'Drop location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Drop longitude must be between -180 and 180'
    };
  }
  
  // Check for zero coordinates (0,0 is invalid location)
  if (pickupLatNum === 0 && pickupLonNum === 0) {
    return {
      success: false,
      serviceable: false,
      message: 'Pickup location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Pickup coordinates cannot be (0, 0)'
    };
  }
  
  if (dropLatNum === 0 && dropLonNum === 0) {
    return {
      success: false,
      serviceable: false,
      message: 'Drop location coordinates are missing.',
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0,
      error: 'Drop coordinates cannot be (0, 0)'
    };
  }
  
  // ============================================
  // ORIGINAL API CALL (unchanged)
  // ============================================
  try {
    const response = await axios.put(
      'https://hlbackend.staging.shadowfax.in/api/v1/order-serviceability/',
      {
        pickup_longitude: pickupLon.toString(),
        pickup_latitude: pickupLat.toString(),
        drop_longitude: dropLon.toString(),
        drop_latitude: dropLat.toString()
        
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Token 437220fb96af5e9f0fce7d370d3f37ad9f7c017a'
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      data: response.data,
      serviceable: response.data.serviceable === true,
      message: response.data.serviceable ? 'Serviceable' : (response.data.message || 'Not serviceable'),
      deliveryCost: response.data.delivery_cost || 0,
      approxDistance: response.data.approx_distance || 0,
      pickupEta: response.data.pickup_eta || 0,
      dropEta: response.data.drop_eta || 0
    };
  } catch (error) {
    console.error('Shadowfax API Error:', error.response?.data || error.message);
    
    let errorMessage = 'Serviceability check failed';
    let serviceable = false;
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
      if (errorMessage.includes('Outside Shadowfax serviceability area') ||
          errorMessage.includes('Order in non-serviceable area')) {
        serviceable = false;
      }
    }
    
    return {
      success: false,
      serviceable: serviceable,
      message: errorMessage,
      error: error.response?.data || error.message,
      deliveryCost: 0,
      approxDistance: 0,
      pickupEta: 0,
      dropEta: 0
    };
  }
};

module.exports = checkShadowfaxServiceability;