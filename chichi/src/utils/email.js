const ADMIN_EMAIL = 'Chihuahuasouthafrica@gmail.com'
const BASE_URL = window.location.origin

async function post(fields) {
  try {
    await fetch(`https://formsubmit.co/ajax/${ADMIN_EMAIL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ _template: 'table', ...fields }),
    })
  } catch (e) {
    console.error('Email send failed:', e)
  }
}

export function sendApprovalEmail(seller) {
  const paymentLink = `${BASE_URL}/pay/membership?seller=${seller.id}`
  return post({
    _subject: `✅ Chihuahua South Africa — Your Application is Approved! Pay to Activate`,
    _cc: seller.email,
    'Dear': seller.name,
    'Kennel': seller.kennelName,
    'Registry': seller.registry,
    'Status': 'APPROVED — Payment Required',
    'Activate Your Account': paymentLink,
    'Membership Fee': 'R1,200 per year',
    'Next Step': 'Click the link above to pay and activate your Chihuahua South Africa seller portal. Once paid you can start listing your Chihuahuas immediately.',
  })
}

export function sendInactivityWarning(seller, kennelName) {
  return post({
    _subject: `⚠️ Inactivity Notice — ${kennelName} — 30 Days to Act`,
    _cc: seller.email,
    'Dear': seller.name,
    'Kennel': kennelName,
    'Status': 'Inactive for over 1 year — Action Required',
    'Notice': 'Your Chihuahua South Africa account has been inactive for over 1 year with no sales. You have 30 days to list a puppy or make a sale before your account is automatically removed.',
    'Action Required': 'Log in to your seller portal and list a puppy or contact admin to discuss your account.',
    'Portal': 'https://chihuahuasouthafrica.com/seller/login',
  })
}

export function sendAutoRemovalNotification(seller, kennelName) {
  return post({
    _subject: `🗑️ Account Auto-Removed — ${kennelName} (1 Year Inactivity)`,
    'Kennel Removed': kennelName,
    'Seller': seller.name,
    'Seller Email': seller.email,
    'Reason': 'Account automatically removed after 1 year of inactivity. A 30-day warning was sent with no response or activity.',
    'Action Taken': 'Kennel and all associated listings have been removed from the platform.',
  })
}

export function sendRenewalEmail(seller, kennelName) {
  const paymentLink = `${BASE_URL}/pay/membership?seller=${seller.id}`
  return post({
    _subject: `🔔 Chihuahua South Africa Membership Renewal — ${kennelName}`,
    _cc: seller.email,
    'Kennel': kennelName,
    'Seller': seller.name,
    'Status': 'Membership Expired — Action Required',
    'Renew Now': paymentLink,
    'Renewal Fee': 'R1,200 per year',
    'Note': 'Your Chihuahua South Africa membership has expired. Click the link above to renew and continue listing your Chihuahuas.',
  })
}
