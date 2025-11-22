// public/js/payments.js

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-planid]');
  if (!btn) return;

  btn.disabled = true;
  const planId = btn.dataset.planid;

  try {
    const createResp = await fetch('/api/purchases/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ planId })
    });

    const createJson = await createResp.json();
    if (!createResp.ok) throw new Error(createJson.message || 'Create order failed');

    const { key, amount, orderId } = createJson;

    const options = {
      key,
      amount,
      currency: 'INR',
      name: 'Plan Purchase',
      description: 'Buying your plan',
      order_id: orderId,
      handler: async function (response) {
        const verifyResp = await fetch('/api/purchases/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature
          })
        });

        const verifyJson = await verifyResp.json();
        if (!verifyResp.ok) {
          alert(verifyJson.message || 'Verification failed');
          return;
        }

        alert('Payment Successful!');
        window.location.reload();
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});
