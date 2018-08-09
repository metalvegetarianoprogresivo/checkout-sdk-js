import { createClient as createPaymentClient } from '@bigcommerce/bigpay-client';
import { createAction, Action } from '@bigcommerce/data-store';
import { createRequestSender } from '@bigcommerce/request-sender';
import { createScriptLoader } from '@bigcommerce/script-loader';
import { Observable } from 'rxjs';

import { PaymentActionCreator, PaymentInitializeOptions, PaymentRequestSender } from '../..';
import {
    createCheckoutClient,
    createCheckoutStore,
    CheckoutRequestSender,
    CheckoutStore,
    CheckoutValidator,
    InternalCheckoutSelectors,
} from '../../../checkout';
import CheckoutActionCreator from '../../../checkout/checkout-action-creator';
import { getCheckoutStoreState } from '../../../checkout/checkouts.mock';
import { InvalidArgumentError, MissingDataError, TimeoutError } from '../../../common/error/errors';
import { ConfigActionCreator, ConfigRequestSender } from '../../../config';
import { OrderActionCreator, OrderActionType } from '../../../order';
import { getOrderRequestBody } from '../../../order/internal-orders.mock';
import { getPaymentMethodsState, getSquare } from '../../../payment/payment-methods.mock';
import createPaymentStrategyRegistry from '../../create-payment-strategy-registry';
import { PaymentActionType} from '../../payment-actions';
import PaymentMethod from '../../payment-method';
import PaymentMethodActionCreator from '../../payment-method-action-creator';
import PaymentStrategyActionCreator from '../../payment-strategy-action-creator';
import { PaymentStrategyActionType } from '../../payment-strategy-actions';

import SquarePaymentForm, {CardBrand, CardData, DigitalWalletType, SquareFormCallbacks, SquareFormElement, SquareFormOptions } from './square-form';
import SquarePaymentStrategy, { SquarePaymentInitializeOptions } from './square-payment-strategy';
import SquareScriptLoader from './square-script-loader';
import OrderRequestBody from '../../../order/order-request-body';

describe('SquarePaymentStrategy', () => {
    let callbacks: SquareFormCallbacks;
    let checkoutActionCreator: CheckoutActionCreator;
    let orderActionCreator: OrderActionCreator;
    let paymentActionCreator: PaymentActionCreator;
    let paymentMethod: PaymentMethod;
    let paymentMethodMock: PaymentMethod;
    let paymentMethodActionCreator: PaymentMethodActionCreator;
    let paymentStrategyActionCreator: PaymentStrategyActionCreator;
    let scriptLoader: SquareScriptLoader;
    let store: CheckoutStore;
    let strategy: SquarePaymentStrategy;
    let submitOrderAction: Observable<Action>;
    let submitPaymentAction: Observable<Action>;

    const formFactory = (options: SquareFormOptions) => {
        if (options.callbacks) {
            callbacks = options.callbacks;
        }

        return squareForm;
    };

    const squareForm = {
        build: () => {
            if (callbacks.paymentFormLoaded) {
                callbacks.paymentFormLoaded({} as SquarePaymentForm);
            }
        },
        requestCardNonce: () => {},
    };

    const squareOptions = {
        cardNumber: { elementId: 'cardNumber' },
        cvv: { elementId: 'cvv' },
        expirationDate: { elementId: 'expirationDate' },
        postalCode: { elementId: 'postalCode' },
    };

    const cardData = {
        card_brand: 'MASTERCARD',
        last_4: 1234,
        exp_month: 1,
        exp_year: 2020,
        billing_postal_code: '12345',
        digital_wallet_type: 'MASTERPASS',
    };

    beforeEach(() => {
        const client = createCheckoutClient();
        const requestSender = createRequestSender();
        const paymentClient = createPaymentClient(store);
        const registry = createPaymentStrategyRegistry(store, client, paymentClient);
        const checkoutRequestSender = new CheckoutRequestSender(createRequestSender());
        const configRequestSender = new ConfigRequestSender(createRequestSender());
        const configActionCreator = new ConfigActionCreator(configRequestSender);
        const checkoutValidator = new CheckoutValidator(checkoutRequestSender);

        paymentMethodMock = { ...getSquare(), clientToken: 'clientToken' };

        store = createCheckoutStore({
            paymentMethods: getPaymentMethodsState(),
        });
        paymentMethod = getSquare();
        orderActionCreator = new OrderActionCreator(
            createCheckoutClient(),
            checkoutValidator
        );
        paymentActionCreator = new PaymentActionCreator(
            new PaymentRequestSender(createPaymentClient()),
            orderActionCreator
        );

        scriptLoader = new SquareScriptLoader(createScriptLoader());

        checkoutActionCreator = new CheckoutActionCreator(checkoutRequestSender, configActionCreator);
        paymentMethodActionCreator = new PaymentMethodActionCreator(client);
        submitOrderAction = Observable.of(createAction(OrderActionType.SubmitOrderRequested));
        submitPaymentAction = Observable.of(createAction(PaymentActionType.SubmitPaymentRequested));
        paymentStrategyActionCreator = new PaymentStrategyActionCreator(registry, orderActionCreator);
        store = createCheckoutStore(getCheckoutStoreState());

        strategy = new SquarePaymentStrategy(
            store,
            checkoutActionCreator,
            orderActionCreator,
            paymentActionCreator,
            paymentMethodActionCreator,
            paymentStrategyActionCreator,
            requestSender,
            scriptLoader
        );

        jest.spyOn(store, 'dispatch').mockReturnValue(Promise.resolve(store.getState()));
        jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(paymentMethodMock);

        jest.spyOn(orderActionCreator, 'submitOrder')
            .mockReturnValue(submitOrderAction);

        jest.spyOn(paymentActionCreator, 'submitPayment')
            .mockReturnValue(submitPaymentAction);

        jest.spyOn(requestSender, 'post')
            .mockReturnValue(Promise.resolve());

        jest.spyOn(store, 'dispatch');

        jest.spyOn(scriptLoader, 'load')
            .mockReturnValue(Promise.resolve(formFactory));

        jest.spyOn(squareForm, 'build');
        jest.spyOn(squareForm, 'requestCardNonce')
            .mockReturnValue(Promise.resolve());

        (scriptLoader.load as jest.Mock).mockClear();
        (squareForm.build as jest.Mock).mockClear();
    });

    describe('#initialize()', () => {
        // describe('when form loads successfully', () => {
        //     it('loads script when initializing strategy with required params', async () => {
        //         const initOptions = {
        //             methodId: paymentMethod.id,
        //             square: squareOptions,
        //         };

        //         await strategy.initialize(initOptions);

        //         expect(scriptLoader.load).toHaveBeenCalledTimes(1);
        //     });

        //     it('fails to initialize when widget config is missing', async () => {
        //         try {
        //             await strategy.initialize({ methodId: paymentMethod.id });
        //         } catch (error) {
        //             expect(error.type).toEqual('invalid_argument');
        //         }
        //     });
        // });

        // describe('when form fails to load', () => {
        //     beforeEach(() => {
        //         jest.spyOn(squareForm, 'build').mockImplementation(() => {
        //             if (callbacks.unsupportedBrowserDetected) {
        //                 callbacks.unsupportedBrowserDetected();
        //             }
        //         });
        //     });

        //     afterEach(() => (squareForm.build as any).mockRestore());

        //     it('rejects the promise', () => {
        //         const initOptions = {
        //             methodId: paymentMethod.id,
        //             square: squareOptions,
        //         };

        //         strategy.initialize(initOptions)
        //             .catch(e => expect(e.type).toEqual('unsupported_browser'));

        //         expect(scriptLoader.load).toHaveBeenCalledTimes(1);
        //         expect(squareForm.build).toHaveBeenCalledTimes(0);
        //     });
        //});
    });

    describe('#execute()', async () => {
        const payload = {
            payment: {
                methodId: 'squareV2',
            },
        };

        // describe('when form has not been initialized', () => {
        //     it('rejects the promise', () => {
        //         strategy.execute(payload)
        //             .catch(e => expect(e.type).toEqual('not_initialized'));

        //         expect(squareForm.requestCardNonce).toHaveBeenCalledTimes(0);
        //     });
        // });

        describe('when the form has been initialized', () => {
            beforeEach(async () => {
                const initOptions = {
                    methodId: paymentMethod.id,
                    square: squareOptions,
                };

                await strategy.initialize(initOptions);
            });

            // it('fails if payment name is not passed', () => {
            //     try {
            //         strategy.execute({});
            //     } catch (error) {
            //         expect(error).toBeInstanceOf(MissingDataError);
            //         expect(squareForm.requestCardNonce).toHaveBeenCalledTimes(0);
            //     }
            // });

            // it('requests the nonce', () => {
            //     strategy.execute(payload);
            //     expect(squareForm.requestCardNonce).toHaveBeenCalledTimes(1);
            // });

            // it('cancels the first request when a newer is made', () => {
            //     strategy.execute(payload).catch(e => expect(e).toBeInstanceOf(TimeoutError));

            //     setTimeout(() => {
            //         if (callbacks.cardNonceResponseReceived) {
            //             callbacks.cardNonceResponseReceived(null, 'nonce', cardData, undefined, undefined);
            //         }
            //     }, 0);

            //     strategy.execute(payload);
            // });
            let orderRequestBody: OrderRequestBody;

            describe('when the nonce is received', async () => {
                let promise: Promise<InternalCheckoutSelectors>;
                const options: PaymentInitializeOptions = {
                    methodId: '',
                    square:  {
                        cardNumber: {
                            elementId: '',
                        },
                        cvv: {
                            elementId: '',
                        },
                        expirationDate: {
                            elementId: '',
                        },
                        postalCode: {
                            elementId: '',
                        },
                        onPaymentSelect: () => console.log('onPaymentSelect'),
                    },

                };

                beforeEach(async () => {

                //   await strategy.execute(payload);
                //    if (callbacks.cardNonceResponseReceived) {
                //        callbacks.cardNonceResponseReceived(null, 'nonce', cardData, undefined, undefined);
                //    }
               });

                // it('places the order with the right arguments', async () => {
                //     await expect(orderActionCreator.submitOrder).toHaveBeenCalledWith({ useStoreCredit: true }, options);
                //     await expect(store.dispatch).toHaveBeenCalledWith(submitOrderAction);
                // });

                it('calls submit order with the order request information', async () => {
                    jest.spyOn(checkoutActionCreator, 'loadCurrentCheckout')
                        .mockReturnValue(Promise.resolve());
                    jest.spyOn(paymentMethodActionCreator, 'loadPaymentMethod');

                    const widgetInteractionAction = Observable.of(createAction(PaymentStrategyActionType.WidgetInteractionStarted));
                    jest.spyOn(paymentStrategyActionCreator, 'widgetInteraction').mockImplementation(() => widgetInteractionAction);
                    // expect(store.dispatch).toHaveBeenCalledWith(widgetInteractionAction, { queueId: 'widgetInteraction' });
                    // expect(paymentStrategyActionCreator.widgetInteraction)
                    //     .toHaveBeenCalledWith(expect.any(Function), { methodId: 'braintreevisacheckout' });
                    await strategy.initialize(options);
                    await strategy.execute(orderRequestBody, options);
                    //const { payment, ...order } = getOrderRequestBody();

                    // expect(orderActionCreator.submitOrder).toHaveBeenCalledWith(order, expect.any(Object));
                    // expect(store.dispatch).toHaveBeenCalledWith(submitOrderAction);
                });

                // it('resolves to what is returned by submitPayment', async () => {
                //     const value = await promise;

                //     expect(value).toEqual(store.getState());
                // });

    //             // it('submits the payment  with the right arguments', () => {
    //             //     expect(paymentActionCreator.submitPayment).toHaveBeenCalledWith({
    //             //         methodId: 'square',
    //             //         paymentData: {
    //             //             nonce: 'nonce',
    //             //         },
    //             //     });
    //             // });
    //         });

    //         describe('when a failure happens receiving the nonce', () => {
    //             let promise: Promise<InternalCheckoutSelectors>;

    //             beforeEach(() => {
    //                 promise = strategy.execute(payload);

    //                 if (callbacks.cardNonceResponseReceived) {
    //                     callbacks.cardNonceResponseReceived(null, 'nonce', cardData, undefined, undefined);
    //                 }
    //             });

    //             it('does not place the order', () => {
    //                 expect(orderActionCreator.submitOrder).toHaveBeenCalledTimes(0);
    //                 expect(store.dispatch).not.toHaveBeenCalledWith(submitOrderAction);
    //             });

    //             it('does not submit payment', () => {
    //                 expect(paymentActionCreator.submitPayment).toHaveBeenCalledTimes(0);
    //             });

    //             it('rejects the promise', async () => {
    //                 try {
    //                     await promise;
    //                 } catch (e) {
    //                     expect(e).toBeTruthy();
    //                 }
    //             });
             });
        });
    });
});
