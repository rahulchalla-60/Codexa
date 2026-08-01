// Mock Backend Service exposing an API Endpoint

function processCharge(amount: number) {
  console.log("Processing payment charge of $", amount);
  return { status: "success", transactionId: "tx_12345" };
}

// Express route definition
app.post('/v1/charge', processCharge);
