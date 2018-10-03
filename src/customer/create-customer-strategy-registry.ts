import { createFormPoster } from '@bigcommerce/form-poster';
import { RequestSender } from '@bigcommerce/request-sender';
import { getScriptLoader } from '@bigcommerce/script-loader';

import BillingAddressActionCreator from '../billing/billing-address-action-creator';
import BillingAddressRequestSender from '../billing/billing-address-request-sender';
import { CheckoutActionCreator, CheckoutRequestSender, CheckoutStore, CheckoutValidator } from '../checkout';
import { Registry } from '../common/registry';
import { ConfigActionCreator, ConfigRequestSender } from '../config';
import { OrderActionCreator, OrderRequestSender } from '../order';
import { createPaymentClient, PaymentActionCreator, PaymentMethodActionCreator, PaymentMethodRequestSender, PaymentRequestSender, PaymentStrategyActionCreator, PaymentStrategyRegistry } from '../payment';
import { AmazonPayScriptLoader } from '../payment/strategies/amazon-pay';
import { createBraintreeVisaCheckoutPaymentProcessor, BraintreeScriptLoader, BraintreeSDKCreator, VisaCheckoutScriptLoader } from '../payment/strategies/braintree';
import { ChasePayScriptLoader } from '../payment/strategies/chasepay';
import GooglePayBraintreeInitializer from '../payment/strategies/googlepay/googlepay-braintree-initializer';
import GooglePayScriptLoader from '../payment/strategies/googlepay/googlepay-script-loader';
import { MasterpassScriptLoader } from '../payment/strategies/masterpass';
import { RemoteCheckoutActionCreator, RemoteCheckoutRequestSender } from '../remote-checkout';
import ConsignmentActionCreator from '../shipping/consignment-action-creator';
import ConsignmentRequestSender from '../shipping/consignment-request-sender';

import CustomerActionCreator from './customer-action-creator';
import CustomerRequestSender from './customer-request-sender';
import CustomerStrategyActionCreator from './customer-strategy-action-creator';
import {
    AmazonPayCustomerStrategy,
    BraintreeVisaCheckoutCustomerStrategy,
    ChasePayCustomerStrategy,
    CustomerStrategy,
    DefaultCustomerStrategy,
    MasterpassCustomerStrategy,
} from './strategies';
import GooglePayBraintreeCustomerStrategy from './strategies/googlepay-braintree-customer-strategy';
import SquareCustomerStrategy from './strategies/square-customer-strategy';
import GooglePayPaymentProcessor from '../payment/strategies/googlepay/googlepay-payment-processor';
import ShippingStrategyActionCreator from '../shipping/shipping-strategy-action-creator';
import createShippingStrategyRegistry from '../shipping/create-shipping-strategy-registry';

export default function createCustomerStrategyRegistry(
    store: CheckoutStore,
    requestSender: RequestSender
): Registry<CustomerStrategy> {
    const registry = new Registry<CustomerStrategy>();
    const scriptLoader = getScriptLoader();
    const braintreeScriptLoader = new BraintreeScriptLoader(scriptLoader);
    const braintreeSdkCreator = new BraintreeSDKCreator(braintreeScriptLoader);
    const checkoutActionCreator = new CheckoutActionCreator(
        new CheckoutRequestSender(requestSender),
        new ConfigActionCreator(new ConfigRequestSender(requestSender))
    );
    const checkoutRequestSender = new CheckoutRequestSender(requestSender);
    const checkoutValidator = new CheckoutValidator(checkoutRequestSender);
    const consignmentRequestSender = new ConsignmentRequestSender(requestSender);
    const orderActionCreator = new OrderActionCreator(
        new OrderRequestSender(requestSender),
        checkoutValidator
    );
    const paymentActionCreator = new PaymentActionCreator(
        new PaymentRequestSender(createPaymentClient(store)),
        orderActionCreator
    );
    const paymentMethodActionCreator = new PaymentMethodActionCreator(new PaymentMethodRequestSender(requestSender));
    const remoteCheckoutRequestSender = new RemoteCheckoutRequestSender(requestSender);
    const remoteCheckoutActionCreator = new RemoteCheckoutActionCreator(remoteCheckoutRequestSender);

    registry.register('amazon', () =>
        new AmazonPayCustomerStrategy(
            store,
            paymentMethodActionCreator,
            remoteCheckoutActionCreator,
            remoteCheckoutRequestSender,
            new AmazonPayScriptLoader(scriptLoader)
        )
    );

    registry.register('braintreevisacheckout', () =>
        new BraintreeVisaCheckoutCustomerStrategy(
            store,
            checkoutActionCreator,
            paymentMethodActionCreator,
            new CustomerStrategyActionCreator(registry),
            remoteCheckoutActionCreator,
            createBraintreeVisaCheckoutPaymentProcessor(scriptLoader, requestSender),
            new VisaCheckoutScriptLoader(scriptLoader)
        )
    );

    registry.register('chasepay', () =>
        new ChasePayCustomerStrategy(
            store,
            paymentMethodActionCreator,
            remoteCheckoutActionCreator,
            new ChasePayScriptLoader(scriptLoader),
            requestSender,
            createFormPoster()
        )
    );

    registry.register('squarev2', () =>
        new SquareCustomerStrategy(
            store,
            new RemoteCheckoutActionCreator(remoteCheckoutRequestSender)
        )
    );

    registry.register('masterpass', () =>
        new MasterpassCustomerStrategy(
            store,
            paymentMethodActionCreator,
            remoteCheckoutActionCreator,
            new MasterpassScriptLoader(scriptLoader)
        )
    );

    registry.register('googlepay-braintree', () =>
        new GooglePayBraintreeCustomerStrategy(
            store,
            remoteCheckoutActionCreator,
            new GooglePayPaymentProcessor(
                store,
                paymentMethodActionCreator,
                new GooglePayScriptLoader(scriptLoader),
                new GooglePayBraintreeInitializer(braintreeSdkCreator),
                new BillingAddressActionCreator(new BillingAddressRequestSender(requestSender)),
                new ShippingStrategyActionCreator(createShippingStrategyRegistry(store, requestSender))
            )
        )
    );

    registry.register('default', () =>
        new DefaultCustomerStrategy(
            store,
            new CustomerActionCreator(
                new CustomerRequestSender(requestSender),
                checkoutActionCreator
            )
        )
    );

    return registry;
}
