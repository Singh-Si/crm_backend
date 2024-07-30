function generateOTP() {
    const digits = '0123456789';
    let OTP = '';
    
    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * 10);
      OTP += digits[randomIndex];
    }
    
    return OTP;
  }
  
 module.exports ={
    generateOTP
 } 