import { createRequestSender } from '@bigcommerce/request-sender';
import { getScriptLoader } from '@bigcommerce/script-loader';

import { PaymentMethodActionCreator, PaymentMethodRequestSender } from '../..';
import { BillingAddressActionCreator, BillingAddressRequestSender } from '../../../billing';
import { CheckoutRequestSender, CheckoutStore } from '../../../checkout';
import { ConsignmentActionCreator, ConsignmentRequestSender } from '../../../shipping';

import GooglePayPaymentProcessor from './googlepay-payment-processor';
import GooglePayScriptLoader from './googlepay-script-loader';
import GooglePayStripeInitializer from './googlepay-stripe-initializer';

export default function createGooglePayStripePaymentProcessor(store: CheckoutStore): GooglePayPaymentProcessor {
    const requestSender = createRequestSender();

    return new GooglePayPaymentProcessor(
        store,
        new PaymentMethodActionCreator(
            new PaymentMethodRequestSender(requestSender)
        ),
        new GooglePayScriptLoader(getScriptLoader()),
        new GooglePayStripeInitializer(),
        new BillingAddressActionCreator(
            new BillingAddressRequestSender(requestSender)
        ),
        new ConsignmentActionCreator(
            new ConsignmentRequestSender(requestSender),
            new CheckoutRequestSender(requestSender)
        ),
        requestSender
    );
}
