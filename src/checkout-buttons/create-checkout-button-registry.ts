import { createFormPoster, FormPoster } from '@bigcommerce/form-poster';
import { RequestSender } from '@bigcommerce/request-sender';
import { getScriptLoader } from '@bigcommerce/script-loader';

import { BillingAddressActionCreator, BillingAddressRequestSender } from '../billing';
import { CheckoutActionCreator, CheckoutRequestSender, CheckoutStore } from '../checkout';
import CheckoutValidator from '../checkout/checkout-validator';
import { Registry } from '../common/registry';
import { ConfigActionCreator, ConfigRequestSender } from '../config';
import { OrderActionCreator, OrderRequestSender } from '../order';
import { createPaymentClient, PaymentActionCreator, PaymentMethodActionCreator, PaymentMethodRequestSender, PaymentRequestSender, PaymentStrategyActionCreator, PaymentStrategyRegistry } from '../payment';
import { BraintreeScriptLoader, BraintreeSDKCreator } from '../payment/strategies/braintree';
import { GooglePayBraintreeInitializer, GooglePayPaymentStrategy, GooglePayScriptLoader } from '../payment/strategies/googlepay';
import GooglePayPaymentProcessor from '../payment/strategies/googlepay/googlepay-payment-processor';
import { PaypalScriptLoader } from '../payment/strategies/paypal';
import { RemoteCheckoutActionCreator, RemoteCheckoutRequestSender } from '../remote-checkout';
import { createShippingStrategyRegistry, ConsignmentActionCreator, ConsignmentRequestSender, ShippingStrategyActionCreator } from '../shipping';

import { BraintreePaypalButtonStrategy, CheckoutButtonStrategy, GooglePayBraintreeButtonStrategy } from './strategies';

export default function createCheckoutButtonRegistry(
    store: CheckoutStore,
    requestSender: RequestSender
): Registry<CheckoutButtonStrategy> {
    const registry = new Registry<CheckoutButtonStrategy>();
    const scriptLoader = getScriptLoader();
    const paymentClient = createPaymentClient(store);
    const checkoutActionCreator = new CheckoutActionCreator(
        new CheckoutRequestSender(requestSender),
        new ConfigActionCreator(new ConfigRequestSender(requestSender))
    );
    const paymentRequestSender = new PaymentRequestSender(paymentClient);
    const orderActionCreator = new OrderActionCreator(
        new OrderRequestSender(requestSender),
        new CheckoutValidator(new CheckoutRequestSender(requestSender)));
    const paymentStrategyActionCreator = new PaymentStrategyActionCreator(
        new PaymentStrategyRegistry(store),
        orderActionCreator
    );
    const paymentActionCreator = new PaymentActionCreator(
        paymentRequestSender,
        orderActionCreator
    );
    const googlepayScriptLoader = new GooglePayScriptLoader(scriptLoader);
    const braintreeSDKCreator = new BraintreeSDKCreator(new BraintreeScriptLoader(scriptLoader));
    const paymentMethodActionCreator = new PaymentMethodActionCreator(new PaymentMethodRequestSender(requestSender));

    registry.register('braintreepaypal', () =>
        new BraintreePaypalButtonStrategy(
            store,
            checkoutActionCreator,
            new BraintreeSDKCreator(new BraintreeScriptLoader(scriptLoader)),
            new PaypalScriptLoader(scriptLoader),
            createFormPoster()
        )
    );

    registry.register('braintreepaypalcredit', () =>
        new BraintreePaypalButtonStrategy(
            store,
            checkoutActionCreator,
            new BraintreeSDKCreator(new BraintreeScriptLoader(scriptLoader)),
            new PaypalScriptLoader(scriptLoader),
            createFormPoster(),
            true
        )
    );

    registry.register('googlepaybraintree', () =>
        new GooglePayBraintreeButtonStrategy(
            store,
            new FormPoster(),
            googlepayScriptLoader,
            new GooglePayPaymentProcessor(
                store,
                paymentMethodActionCreator,
                new GooglePayScriptLoader(scriptLoader),
                new GooglePayBraintreeInitializer(braintreeSDKCreator),
                new BillingAddressActionCreator(new BillingAddressRequestSender(requestSender))
            )
        )
    );

    return registry;
}
