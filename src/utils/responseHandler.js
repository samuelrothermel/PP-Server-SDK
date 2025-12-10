// Shared response handler for PayPal API responses
export const handleResponse = async response => {
  if (response.status === 200 || response.status === 201) {
    return response.json();
  }
  const errorText = await response.text();
  const error = new Error(errorText);
  error.status = response.status;
  throw error;
};
