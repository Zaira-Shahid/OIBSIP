const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let loading = null

function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve()
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.onload = resolve
      script.onerror = () => {
        loading = null // allow a retry
        script.remove()
        reject(new Error('Could not load the payment window. Please check your connection and try again.'))
      }
      document.body.appendChild(script)
    })
  }
  return loading
}

// Opens Razorpay Checkout and resolves once, with either:
//   { status: 'paid', response }              the three values the server must verify
//   { status: 'dismissed', failure }          the popup was closed; `failure` is the last payment error, if any
// A failed attempt keeps the popup open so the customer can try another method, so it does not resolve here.
export async function openCheckout(options) {
  await loadCheckoutScript()
  return new Promise((resolve) => {
    let failure = ''
    const checkout = new window.Razorpay({
      ...options,
      handler: (response) => resolve({ status: 'paid', response }),
      modal: { ondismiss: () => resolve({ status: 'dismissed', failure }) },
    })
    checkout.on('payment.failed', (event) => {
      failure = event?.error?.description || 'The payment did not go through.'
    })
    checkout.open()
  })
}
