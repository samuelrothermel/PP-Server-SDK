import { handleError } from '../config/errorHandler.js';

/**
 * Handle shipping callback from PayPal
 * Updates shipping costs based on selected address and options
 */
const SHIPPING_DECLINE_EVENTS = {
  ADDRESS_ERROR: 'SHIPPING_ADDRESS',
  COUNTRY_ERROR: 'SHIPPING_ADDRESS',
  STATE_ERROR: 'SHIPPING_ADDRESS',
  ZIP_ERROR: 'SHIPPING_ADDRESS',
  METHOD_UNAVAILABLE: 'SHIPPING_OPTION',
  STORE_UNAVAILABLE: 'SHIPPING_OPTION',
};

export const handleShippingCallback = async (req, res) => {
  const { id, shipping_address, shipping_option, purchase_units } = req.body;
  const { declineType } = req.query;

  try {
    // Log the shipping callback data
    console.log('Shipping Callback from PayPal:');
    console.log('Order ID:', id);
    console.log('Shipping Address:', shipping_address);
    console.log('Shipping Option:', shipping_option);
    console.log('Purchase Units:', purchase_units);
    if (declineType) console.log('Decline type override:', declineType);

    // Return a merchant decline 422 if a declineType was requested
    if (declineType && SHIPPING_DECLINE_EVENTS[declineType]) {
      return res.status(422).json({
        name: 'UNPROCESSABLE_ENTITY',
        details: [{ issue: declineType }],
      });
    }

    // Default: decline non-US countries
    if (shipping_address?.country_code !== 'US') {
      return res.status(422).json({
        name: 'UNPROCESSABLE_ENTITY',
        details: [{ issue: 'COUNTRY_ERROR' }],
      });
    }

    // Log breakdown and shipping details
    if (purchase_units && purchase_units.length > 0) {
      const breakdown = purchase_units[0].amount.breakdown;
      const shipping = purchase_units[0].shipping;
      console.log('Breakdown:', JSON.stringify(breakdown, null, 2));
      console.log('Shipping:', JSON.stringify(shipping, null, 2));
    }

    // Calculate the total amount
    let itemTotal = parseFloat(
      purchase_units[0].amount.breakdown.item_total.value
    );

    // Define shipping amounts for both options
    const freeShippingAmount = 0;
    const expressShippingAmount = 10; // Express shipping is $10.00

    // Determine which shipping option is selected
    let selectedShippingAmount = expressShippingAmount; // default to express
    let selectedShippingId = '2';
    if (shipping_option?.id === '1') {
      selectedShippingAmount = freeShippingAmount;
      selectedShippingId = '1';
    }

    // Update shippingAmount and totalAmount based on selected option
    const shippingAmount = selectedShippingAmount;
    const totalAmount = (itemTotal + shippingAmount).toFixed(2);

    // Construct the response
    const response = {
      id: id,
      purchase_units: [
        {
          reference_id: 'default',
          amount: {
            currency_code: 'USD',
            value: totalAmount,
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: itemTotal.toFixed(2),
              },
              shipping: {
                currency_code: 'USD',
                value: shippingAmount.toFixed(2),
              },
            },
          },
          shipping_options: [
            {
              id: '1',
              amount: {
                currency_code: 'USD',
                value: freeShippingAmount.toFixed(2),
              },
              type: 'SHIPPING',
              label: 'Free Shipping',
              selected: selectedShippingId === '1',
            },
            {
              id: '2',
              amount: {
                currency_code: 'USD',
                value: expressShippingAmount.toFixed(2),
              },
              type: 'SHIPPING',
              label: 'Express Shipping',
              selected: selectedShippingId === '2',
            },
          ],
        },
      ],
    };

    console.log(
      'Server Callback Response: ',
      JSON.stringify(response, null, 2)
    );

    // Respond with the constructed response
    res.json(response);
  } catch (err) {
    handleError(res, err);
  }
};
