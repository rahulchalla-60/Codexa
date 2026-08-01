// Mock Frontend Dashboard invoking an API Endpoint

function checkoutButtonHandler() {
  console.log("User clicked checkout button");
  
  // API call consumer
  fetch('/v1/charge', {
    method: 'POST',
    body: JSON.stringify({ amount: 50 })
  });
}

function handleCartSubmit() {
  checkoutButtonHandler();
}
