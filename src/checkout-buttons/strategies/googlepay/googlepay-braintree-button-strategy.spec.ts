import { createAction } from '@bigcommerce/data-store';
import { createFormPoster, FormPoster } from '@bigcommerce/form-poster';
import { createRequestSender, RequestSender } from '@bigcommerce/request-sender';
import { getScriptLoader } from '@bigcommerce/script-loader';
import { EventEmitter } from 'events';
import { merge } from 'lodash';
import { Observable } from 'rxjs';

import { BillingAddressActionCreator, BillingAddressRequestSender } from '../../../billing';
import { createCheckoutStore, CheckoutActionCreator, CheckoutActionType, CheckoutRequestSender, CheckoutStore, CheckoutValidator } from '../../../checkout';
import { getCheckout, getCheckoutStoreState } from '../../../checkout/checkouts.mock';
import { MissingDataError } from '../../../common/error/errors';
import { ConfigActionCreator, ConfigRequestSender } from '../../../config';
import { OrderActionCreator, OrderRequestSender } from '../../../order';
import { createPaymentClient, PaymentActionCreator, PaymentMethodActionCreator, PaymentMethodRequestSender, PaymentRequestSender, PaymentStrategyActionCreator, PaymentStrategyRegistry } from '../../../payment';
import { getBraintreePaypal } from '../../../payment/payment-methods.mock';
import { GooglePayPaymentStrategy } from '../../../payment/strategies';
import { BraintreeDataCollector, BraintreePaypalCheckout, BraintreeScriptLoader, BraintreeSDKCreator } from '../../../payment/strategies/braintree';
import { getDataCollectorMock, getPaypalCheckoutMock } from '../../../payment/strategies/braintree/braintree.mock';
import { GooglePayBraintreeInitializer, GooglePayPaymentOptions, GooglePayScriptLoader, GooglePaySDK } from '../../../payment/strategies/googlepay';
import GooglePayPaymentProcessor from '../../../payment/strategies/googlepay/googlepay-payment-processor';
import { PaypalButtonOptions, PaypalScriptLoader, PaypalSDK } from '../../../payment/strategies/paypal';
import { getPaypalMock } from '../../../payment/strategies/paypal/paypal.mock';
import { RemoteCheckoutActionCreator, RemoteCheckoutRequestSender } from '../../../remote-checkout';
import { createShippingStrategyRegistry, ConsignmentActionCreator, ConsignmentRequestSender, ShippingStrategyActionCreator } from '../../../shipping';
import { CheckoutButtonInitializeOptions } from '../../checkout-button-options';

import { GooglePayBraintreeButtonInitializeOptions } from './googlepay-braintree-button-options';
import GooglePayBraintreeButtonStrategy from './googlepay-braintree-button-strategy';

describe('GooglePayBraintreeButtonStrategy', () => {
    let braintreeSDKCreator: BraintreeSDKCreator;
    let checkoutActionCreator: CheckoutActionCreator;
    let dataCollector: BraintreeDataCollector;
    let eventEmitter: EventEmitter;
    let formPoster: FormPoster;
    let options: CheckoutButtonInitializeOptions;
    let googlePayOptions: GooglePayBraintreeButtonInitializeOptions;
    let paypal: PaypalSDK;
    let paypalCheckout: BraintreePaypalCheckout;
    let paypalScriptLoader: PaypalScriptLoader;
    let googlepayScriptLoader: GooglePayScriptLoader;
    let store: CheckoutStore;
    let strategy: GooglePayBraintreeButtonStrategy;
    let requestSender: RequestSender;
    let paymentRequestSender: PaymentRequestSender;
    let orderActionCreator: OrderActionCreator;
    let paymentStrategyActionCreator: PaymentStrategyActionCreator;
    let paymentActionCreator: PaymentActionCreator;
    let paymentMethodActionCreator: PaymentMethodActionCreator;
    let googlePaySDK: GooglePaySDK;

    beforeEach(() => {
        requestSender = createRequestSender();
        const paymentClient = createPaymentClient(store);
        checkoutActionCreator = new CheckoutActionCreator(
            new CheckoutRequestSender(requestSender),
            new ConfigActionCreator(new ConfigRequestSender(requestSender))
        );
        paymentRequestSender = new PaymentRequestSender(paymentClient);
        orderActionCreator = new OrderActionCreator(
            new OrderRequestSender(requestSender),
            new CheckoutValidator(new CheckoutRequestSender(requestSender)));
        paymentStrategyActionCreator = new PaymentStrategyActionCreator(
            new PaymentStrategyRegistry(store),
            orderActionCreator
        );
        paymentActionCreator = new PaymentActionCreator(
            paymentRequestSender,
            orderActionCreator
        );
        paymentMethodActionCreator = new PaymentMethodActionCreator(new PaymentMethodRequestSender(requestSender));

        store = createCheckoutStore(getCheckoutStoreState());
        braintreeSDKCreator = new BraintreeSDKCreator(new BraintreeScriptLoader(getScriptLoader()));
        formPoster = createFormPoster();
        googlepayScriptLoader = new GooglePayScriptLoader(getScriptLoader());
        paypalScriptLoader = new PaypalScriptLoader(getScriptLoader());

        googlePayOptions = {
            container: 'googlepay-container',
            environment: 'TEST',
            onAuthorizeError: jest.fn(),
            onPaymentError: jest.fn(),
        };

        options = {
            methodId: 'googlepay',
            googlepaybraintree: googlePayOptions,
        };

        eventEmitter = new EventEmitter();
        dataCollector = getDataCollectorMock();
        paypal = getPaypalMock();
        paypalCheckout = getPaypalCheckoutMock();

        jest.spyOn(paypal.Button, 'render')
            .mockImplementation((options: PaypalButtonOptions) => {
                eventEmitter.on('payment', () => {
                    options.payment().catch(() => { });
                });

                eventEmitter.on('authorize', () => {
                    options.onAuthorize({ payerId: 'PAYER_ID' }).catch(() => { });
                });
            });

        jest.spyOn(checkoutActionCreator, 'loadDefaultCheckout')
            .mockReturnValue(() => Observable.from([
                createAction(CheckoutActionType.LoadCheckoutRequested),
                createAction(CheckoutActionType.LoadCheckoutSucceeded, getCheckout()),
            ]));

        jest.spyOn(braintreeSDKCreator, 'getPaypalCheckout')
            .mockReturnValue(Promise.resolve(paypalCheckout));

        jest.spyOn(braintreeSDKCreator, 'getDataCollector')
            .mockReturnValue(Promise.resolve(dataCollector));

        jest.spyOn(paypalScriptLoader, 'loadPaypal')
            .mockReturnValue(Promise.resolve(paypal));

        jest.spyOn(formPoster, 'postForm')
            .mockImplementation(() => { });

        jest.spyOn(googlepayScriptLoader, 'load')
            .mockReturnValue(Promise.resolve(googlePaySDK));

        let googlepayApi: any;
        let googlepayClient: any;

        jest.spyOn(googlePaySDK, 'payments')
            .mockReturnValue(googlepayClient);
        jest.spyOn(googlepayClient, 'api')
            .mockReturnValue(googlepayApi);
        jest.spyOn(googlepayApi, 'PaymentsClient')
            .mockReturnValue(jest.fn());
        jest.spyOn(document, 'getElementById');

        strategy = new GooglePayBraintreeButtonStrategy(
            store,
            new FormPoster(),
            googlepayScriptLoader,
            new GooglePayPaymentProcessor(
                store,
                paymentMethodActionCreator,
                new GooglePayScriptLoader(getScriptLoader()),
                new GooglePayBraintreeInitializer(braintreeSDKCreator),
                new BillingAddressActionCreator(new BillingAddressRequestSender(requestSender))
            )
        );
    });

    it('throws error if required data is not loaded', async () => {
        try {
            store = createCheckoutStore();
            strategy = new GooglePayBraintreeButtonStrategy(
                store,
                new FormPoster(),
                googlepayScriptLoader,
                new GooglePayPaymentProcessor(
                    store,
                    paymentMethodActionCreator,
                    new GooglePayScriptLoader(getScriptLoader()),
                    new GooglePayBraintreeInitializer(braintreeSDKCreator),
                    new BillingAddressActionCreator(new BillingAddressRequestSender(requestSender))
                )
            );

            await strategy.initialize(options);
        } catch (error) {
            expect(error).toBeInstanceOf(MissingDataError);
        }
    });

    it('initializes Braintree and PayPal JS clients', async () => {
        await strategy.initialize(options);

        expect(braintreeSDKCreator.getPaypalCheckout).toHaveBeenCalled();
        expect(paypalScriptLoader.loadPaypal).toHaveBeenCalled();
    });

    it('throws error if unable to initialize Braintree or PayPal JS client', async () => {
        const expectedError = new Error('Unable to load JS client');

        jest.spyOn(paypalScriptLoader, 'loadPaypal')
            .mockReturnValue(Promise.reject(expectedError));

        try {
            await strategy.initialize(options);
        } catch (error) {
            expect(error).toEqual(expectedError);
        }
    });

    it('renders PayPal checkout button', async () => {
        await strategy.initialize(options);

        expect(paypal.Button.render).toHaveBeenCalledWith({
            commit: false,
            env: 'production',
            onAuthorize: expect.any(Function),
            payment: expect.any(Function),
            style: {
                label: undefined,
                shape: 'rect',
            },
        }, 'checkout-button');
    });

    it('customizes style of PayPal checkout button', async () => {
        options = {
            ...options,
            googlepaybraintree: {
                ...googlePayOptions,
                buttonColor: 'black',
                buttonType: 'short',
            },
        };

        await strategy.initialize(options);

        expect(paypal.Button.render).toHaveBeenCalledWith(expect.objectContaining({
            style: {
                color: 'blue',
                shape: 'pill',
                size: 'responsive',
                layout: 'horizontal',
                label: 'paypal',
                tagline: true,
                fundingicons: false,
            },
        }), 'checkout-button');
    });

    it('throws error if unable to render PayPal button', async () => {
        const expectedError = new Error('Unable to render PayPal button');

        jest.spyOn(paypal.Button, 'render')
            .mockImplementation(() => {
                throw expectedError;
            });

        try {
            await strategy.initialize(options);
        } catch (error) {
            expect(error).toEqual(expectedError);
        }
    });

    it('renders PayPal checkout button in sandbox environment if payment method is in test mode', async () => {
        store = createCheckoutStore(merge({}, getCheckoutStoreState(), {
            paymentMethods: {
                data: [
                    merge({}, getBraintreePaypal(), { config: { testMode: true } }),
                ],
            },
        }));

        await strategy.initialize(options);

        expect(paypal.Button.render)
            .toHaveBeenCalledWith(expect.objectContaining({ env: 'sandbox' }), 'checkout-button');
    });

    it('loads checkout details when customer is ready to pay', async () => {
        jest.spyOn(store, 'dispatch');

        await strategy.initialize(options);

        eventEmitter.emit('payment');

        await new Promise(resolve => process.nextTick(resolve));

        expect(checkoutActionCreator.loadDefaultCheckout).toHaveBeenCalled();
        expect(store.dispatch).toHaveBeenCalledWith(checkoutActionCreator.loadDefaultCheckout());
    });

    it('sets up PayPal payment flow with current checkout details when customer is ready to pay', async () => {
        await strategy.initialize(options);

        eventEmitter.emit('payment');

        await new Promise(resolve => process.nextTick(resolve));

        expect(paypalCheckout.createPayment).toHaveBeenCalledWith({
            amount: 190,
            currency: 'USD',
            enableShippingAddress: true,
            flow: 'checkout',
            offerCredit: false,
            shippingAddressEditable: false,
            shippingAddressOverride: {
                city: 'Some City',
                countryCode: 'US',
                line1: '12345 Testing Way',
                line2: '',
                phone: '555-555-5555',
                postalCode: '95555',
                recipientName: 'Test Tester',
                state: 'CA',
            },
        });
    });

    it('tokenizes PayPal payment details when authorization event is triggered', async () => {
        await strategy.initialize(options);

        eventEmitter.emit('authorize');

        expect(paypalCheckout.tokenizePayment).toHaveBeenCalledWith({ payerId: 'PAYER_ID' });
    });

    it('posts payment details to server to set checkout data when PayPal payment details are tokenized', async () => {
        await strategy.initialize(options);

        eventEmitter.emit('authorize');

        await new Promise(resolve => process.nextTick(resolve));

        expect(formPoster.postForm).toHaveBeenCalledWith('/checkout.php', expect.objectContaining({
            payment_type: 'paypal',
            provider: 'braintreepaypal',
            action: 'set_external_checkout',
            device_data: dataCollector.deviceData,
            nonce: 'NONCE',
            billing_address: JSON.stringify({
                email: 'foo@bar.com',
                first_name: 'Foo',
                last_name: 'Bar',
                phone_number: '123456789',
                address_line_1: '56789 Testing Way',
                address_line_2: 'Level 2',
                city: 'Some Other City',
                state: 'Arizona',
                country_code: 'US',
                postal_code: '96666',
            }),
            shipping_address: JSON.stringify({
                email: 'foo@bar.com',
                first_name: 'Hello',
                last_name: 'World',
                phone_number: '987654321',
                address_line_1: '12345 Testing Way',
                address_line_2: 'Level 1',
                city: 'Some City',
                state: 'California',
                country_code: 'US',
                postal_code: '95555',
            }),
        }));
    });

    it('posts payment details to server to process payment if `shouldProcessPayment` is passed when PayPal payment details are tokenized', async () => {
        await strategy.initialize(options);

        eventEmitter.emit('authorize');

        await new Promise(resolve => process.nextTick(resolve));

        expect(formPoster.postForm).toHaveBeenCalledWith('/checkout.php', expect.objectContaining({
            payment_type: 'paypal',
            provider: 'braintreepaypal',
            action: 'process_payment',
            device_data: dataCollector.deviceData,
            nonce: 'NONCE',
            billing_address: JSON.stringify({
                email: 'foo@bar.com',
                first_name: 'Foo',
                last_name: 'Bar',
                phone_number: '123456789',
                address_line_1: '56789 Testing Way',
                address_line_2: 'Level 2',
                city: 'Some Other City',
                state: 'Arizona',
                country_code: 'US',
                postal_code: '96666',
            }),
            shipping_address: JSON.stringify({
                email: 'foo@bar.com',
                first_name: 'Hello',
                last_name: 'World',
                phone_number: '987654321',
                address_line_1: '12345 Testing Way',
                address_line_2: 'Level 1',
                city: 'Some City',
                state: 'California',
                country_code: 'US',
                postal_code: '95555',
            }),
        }));
    });

    it('triggers error callback if unable to set up payment flow', async () => {
        const expectedError = new Error('Unable to set up payment flow');

        jest.spyOn(paypalCheckout, 'createPayment')
            .mockReturnValue(Promise.reject(expectedError));

        await strategy.initialize(options);

        eventEmitter.emit('payment');

        await new Promise(resolve => process.nextTick(resolve));

        // expect(options.onPaymentError).toHaveBeenCalledWith(expectedError);
    });

    it('triggers error callback if unable to tokenize payment', async () => {
        const expectedError = new Error('Unable to tokenize');

        jest.spyOn(paypalCheckout, 'tokenizePayment')
            .mockReturnValue(Promise.reject(expectedError));

        await strategy.initialize(options);

        eventEmitter.emit('authorize');

        await new Promise(resolve => process.nextTick(resolve));

        // expect(options.onAuthorizeError).toHaveBeenCalledWith(expectedError);
    });

    it('tears down Braintree setup when button is deinitialized', async () => {
        jest.spyOn(braintreeSDKCreator, 'teardown');

        await strategy.initialize(options);
        await strategy.deinitialize({ methodId: 'braintreepaypal' });

        expect(braintreeSDKCreator.teardown).toHaveBeenCalled();
    });

    describe('if PayPal Credit is offered', () => {
        beforeEach(() => {
            options = {
                methodId: 'braintreepaypalcredit',
                braintreepaypalcredit: {
                    container: 'checkout-button',
                },
            };

            strategy = new GooglePayBraintreeButtonStrategy(
                store,
                new FormPoster(),
                googlepayScriptLoader,
                new GooglePayPaymentProcessor(
                    store,
                    paymentMethodActionCreator,
                    new GooglePayScriptLoader(getScriptLoader()),
                    new GooglePayBraintreeInitializer(braintreeSDKCreator),
                    new BillingAddressActionCreator(new BillingAddressRequestSender(requestSender))
                )
            );
        });

        it('renders PayPal Credit checkout button', async () => {
            await strategy.initialize(options);

            expect(paypal.Button.render).toHaveBeenCalledWith({
                commit: false,
                env: 'production',
                onAuthorize: expect.any(Function),
                payment: expect.any(Function),
                style: {
                    label: 'credit',
                    shape: 'rect',
                },
            }, 'checkout-button');
        });

        it('sets up PayPal Credit payment flow with current checkout details when customer is ready to pay', async () => {
            await strategy.initialize(options);

            eventEmitter.emit('payment');

            await new Promise(resolve => process.nextTick(resolve));

            expect(paypalCheckout.createPayment).toHaveBeenCalledWith({
                amount: 190,
                currency: 'USD',
                enableShippingAddress: true,
                flow: 'checkout',
                offerCredit: true,
                shippingAddressEditable: false,
                shippingAddressOverride: {
                    city: 'Some City',
                    countryCode: 'US',
                    line1: '12345 Testing Way',
                    line2: '',
                    phone: '555-555-5555',
                    postalCode: '95555',
                    recipientName: 'Test Tester',
                    state: 'CA',
                },
            });
        });
    });
});
