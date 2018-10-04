// import { createRequestSender, RequestSender } from '@bigcommerce/request-sender';
// import { getScriptLoader, ScriptLoader } from '@bigcommerce/script-loader';
//
// import BillingAddressActionCreator from '../../billing/billing-address-action-creator';
// import BillingAddressRequestSender from '../../billing/billing-address-request-sender';
// import { getCartState } from '../../cart/carts.mock';
// import {
//     createCheckoutStore,
//     CheckoutActionCreator,
//     CheckoutRequestSender,
//     CheckoutStore,
//     CheckoutValidator,
//     InternalCheckoutSelectors
// } from '../../checkout';
// import { getCheckoutState } from '../../checkout/checkouts.mock';
// import { InvalidArgumentError, MissingDataError } from '../../common/error/errors';
// import ConfigActionCreator from '../../config/config-action-creator';
// import ConfigRequestSender from '../../config/config-request-sender';
// import { getConfigState } from '../../config/configs.mock';
// import OrderActionCreator from '../../order/order-action-creator';
// import OrderRequestSender from '../../order/order-request-sender';
// import {
//         PaymentActionCreator,
//         PaymentMethod,
//         PaymentMethodActionCreator,
//         PaymentMethodRequestSender,
//         PaymentRequestSender,
//         PaymentStrategyActionCreator,
//         PaymentStrategyRegistry
// } from '../../payment';
// import createPaymentClient from '../../payment/create-payment-client';
// import { getGooglePay, getPaymentMethodsState } from '../../payment/payment-methods.mock';
// import { GooglePayPaymentStrategy } from '../../payment/strategies';
// import BraintreeScriptLoader from '../../payment/strategies/braintree/braintree-script-loader';
// import BraintreeSDKCreator from '../../payment/strategies/braintree/braintree-sdk-creator';
// import GooglePayBraintreeInitializer from '../../payment/strategies/googlepay/googlepay-braintree-initializer';
// import GooglePayScriptLoader from '../../payment/strategies/googlepay/googlepay-script-loader';
// import { Masterpass } from '../../payment/strategies/masterpass';
// import { getMasterpassScriptMock } from '../../payment/strategies/masterpass/masterpass.mock';
// import { RemoteCheckoutActionCreator, RemoteCheckoutRequestSender } from '../../remote-checkout';
// import ConsignmentActionCreator from '../../shipping/consignment-action-creator';
// import ConsignmentRequestSender from '../../shipping/consignment-request-sender';
// import { CustomerInitializeOptions } from '../customer-request-options';
// import { getCustomerState } from '../customers.mock';
//
// import { CustomerStrategy } from './';
// import GooglePayBraintreeCustomerStrategy from './googlepay-braintree-customer-strategy';
//
// describe('GooglePayBraintreeCustomerStrategy', () => {
//     let braintreeScriptLoader: BraintreeScriptLoader;
//     let braintreeSdkCreator: BraintreeSDKCreator;
//     let checkoutRequestSender: CheckoutRequestSender;
//     let checkoutValidator: CheckoutValidator;
//     let consignmentRequestSender: ConsignmentRequestSender;
//     let container: HTMLDivElement;
//     let orderActionCreator: OrderActionCreator;
//     let paymentActionCreator: PaymentActionCreator;
//     let paymentMethod: PaymentMethod;
//     let paymentMethodActionCreator: PaymentMethodActionCreator;
//     let paymentStrategy: GooglePayPaymentStrategy;
//     let registry: PaymentStrategyRegistry;
//     let remoteCheckoutActionCreator: RemoteCheckoutActionCreator;
//     let requestSender: RequestSender;
//     let scriptLoader: ScriptLoader;
//     let store: CheckoutStore;
//     let strategy: CustomerStrategy;
//
//     beforeEach(() => {
//         paymentMethod = {
//             ...getGooglePay(),
//             initializationData: {
//                 checkoutId: 'checkoutId',
//                 allowedCardTypes: ['visa', 'amex', 'mastercard'],
//             },
//         };
//
//         store = createCheckoutStore({
//             checkout: getCheckoutState(),
//             customer: getCustomerState(),
//             config: getConfigState(),
//             cart: getCartState(),
//             paymentMethods: getPaymentMethodsState(),
//         });
//
//         jest.spyOn(store, 'dispatch')
//             .mockReturnValue(Promise.resolve(store.getState()));
//
//         // jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod')
//         //     .mockReturnValue(paymentMethod);
//
//         requestSender = createRequestSender();
//
//         remoteCheckoutActionCreator = new RemoteCheckoutActionCreator(
//             new RemoteCheckoutRequestSender(requestSender)
//         );
//
//         paymentMethodActionCreator = new PaymentMethodActionCreator(
//             new PaymentMethodRequestSender(requestSender)
//         );
//
//         checkoutRequestSender = new CheckoutRequestSender(requestSender);
//         registry = new PaymentStrategyRegistry(store, { defaultToken: 'creditcard' });
//         checkoutValidator = new CheckoutValidator(checkoutRequestSender);
//         orderActionCreator = new OrderActionCreator(
//             new OrderRequestSender(requestSender),
//             checkoutValidator
//         );
//
//         scriptLoader = getScriptLoader();
//         braintreeScriptLoader = new BraintreeScriptLoader(scriptLoader);
//         braintreeSdkCreator = new BraintreeSDKCreator(braintreeScriptLoader);
//         consignmentRequestSender = new ConsignmentRequestSender(requestSender);
//         paymentActionCreator = new PaymentActionCreator(
//             new PaymentRequestSender(createPaymentClient(store)),
//             orderActionCreator
//         );
//         paymentStrategy = new GooglePayPaymentStrategy(
//             store,
//             new CheckoutActionCreator(
//                 checkoutRequestSender,
//                 new ConfigActionCreator(new ConfigRequestSender(requestSender))
//             ),
//             paymentMethodActionCreator,
//             new PaymentStrategyActionCreator(registry, orderActionCreator),
//             paymentActionCreator,
//             orderActionCreator,
//             new GooglePayScriptLoader(scriptLoader),
//             new GooglePayBraintreeInitializer(braintreeSdkCreator),
//             createRequestSender(),
//             new BillingAddressActionCreator(new BillingAddressRequestSender(requestSender)),
//             new ConsignmentActionCreator(consignmentRequestSender, checkoutRequestSender)
//         );
//
//         strategy = new GooglePayBraintreeCustomerStrategy(
//             store,
//             paymentStrategy,
//             paymentMethodActionCreator,
//             remoteCheckoutActionCreator
//         );
//
//         container = document.createElement('div');
//         container.setAttribute('id', 'googlePayCheckoutButton');
//         document.body.appendChild(container);
//     });
//
//     afterEach(() => {
//         document.body.removeChild(container);
//     });
//
//     it('creates an instance of GooglePayBraintreeCustomerStrategy', () => {
//         expect(strategy).toBeInstanceOf(GooglePayBraintreeCustomerStrategy);
//     });
//
//     describe('#initialize()', () => {
//         let customerInitializeOptions: CustomerInitializeOptions;
//
//         describe('Payment method exist', () => {
//
//             beforeEach(() => {
//                 jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod')
//                     .mockReturnValue(paymentMethod);
//
//                 customerInitializeOptions = { methodId: 'googlepay', googlepay: { container: 'googlePayCheckoutButton' } };
//             });
//
//             it('Validates if strategy is been initialized', async () => {
//                 await strategy.initialize(customerInitializeOptions);
//
//                 setTimeout(() => {
//                     strategy.initialize(customerInitializeOptions);
//                 }, 0);
//
//                 strategy.initialize(customerInitializeOptions);
//
//                 expect(store.dispatch).toHaveBeenCalledTimes(2);
//             });
//
//             it('fails to initialize the strategy if no GooglePayBraintreeCustomerInitializeOptions is provided ', async () => {
//                 customerInitializeOptions = { methodId: 'googlepay' };
//                 try {
//                     await strategy.initialize(customerInitializeOptions);
//                 } catch (e) {
//                     expect(e).toBeInstanceOf(MissingDataError);
//                 }
//             });
//
//             it('fails to initialize the strategy if no methodid is supplied', async () => {
//                 customerInitializeOptions = { methodId: undefined, googlepay: { container: 'googlePayCheckoutButton' } };
//
//                 try {
//                     await strategy.initialize(customerInitializeOptions);
//                 } catch (e) {
//                     expect(e).toBeInstanceOf(MissingDataError);
//                 }
//             });
//
//             // it('registers the error and success callbacks', async () => {
//             //     customerInitializeOptions = {
//             //         methodId: 'googlepay',
//             //         googlepay: {
//             //             container: 'googlePayCheckoutButton',
//             //             onPaymentSelect: () => {},
//             //             onError: (error: Error) => {},
//             //         },
//             //     };
//             //     customerInitializeOptions.googlepay.onPaymentSelect = jest.fn((type, callback) => callback());
//             //     customerInitializeOptions.googlepay.onError = jest.fn((type, callback) => callback());
//             //     await strategy.initialize(customerInitializeOptions);
//
//             //     expect(customerInitializeOptions.googlepay.onPaymentSelect).toHaveBeenCalledWith(expect.any(Function));
//             //     expect(customerInitializeOptions.googlepay.onError).toHaveBeenCalledWith(expect.any(Function));
//             // });
//
//             // it('onError ', async () => {
//             //     customerInitializeOptions = { methodId: 'googlepay', googlepay: { container: 'googlePayCheckoutButton', onError: (error: Error) => {}}};
//
//             //     try {
//             //         jest.spyOn(customerInitializeOptions.googlepay, 'onError');
//             //         customerInitializeOptions.googlepay.onError = jest.fn((type, Function) => Function());
//
//             //         await strategy.initialize(customerInitializeOptions);
//
//             //         if (customerInitializeOptions.googlepay && customerInitializeOptions.googlepay.onError) {
//             //             console.log('Lllamando a OnError');
//             //             customerInitializeOptions.googlepay.onError(new Error());
//             //         }
//             //     } catch (e) {
//             //         expect(e).toBeInstanceOf(Error);
//             //     }
//             // });
//
//             // it('onPaymentSelect ', async () => {
//             //     customerInitializeOptions = { methodId: 'googlepay', googlepay: { container: 'googlePayCheckoutButton', onPaymentSelect: () => {}}};
//             //     jest.spyOn(customerInitializeOptions.googlepay, 'onPaymentSelect');
//             //     customerInitializeOptions.googlepay.onPaymentSelect = jest.fn((type, callback) => Function());
//
//             //     const promise: Promise<InternalCheckoutSelectors>  = strategy.initialize(customerInitializeOptions);
//
//             //     if (customerInitializeOptions.googlepay && customerInitializeOptions.googlepay.onPaymentSelect) {
//             //         customerInitializeOptions.googlepay.onPaymentSelect();
//             //     }
//
//             //     expect(customerInitializeOptions.googlepay.onPaymentSelect).toHaveBeenCalledTimes(1);
//             // });
//
//             // it('fails to initialize the strategy if no checkoutId is supplied', async () => {
//             //     paymentMethod.initializationData.checkoutId = undefined;
//             //     try {
//             //         await strategy.initialize(customerInitializeOptions);
//             //     } catch (e) {
//             //         expect(e).toBeInstanceOf(MissingDataError);
//             //     }
//             // });
//
//             // it('proceeds to checkout if googlepay button is clicked', async () => {
//             //     jest.spyOn(masterpass, 'checkout');
//             //     await strategy.initialize(customerInitializeOptions);
//             //     if (customerInitializeOptions.googlepay) {
//             //         const button = document.getElementById(customerInitializeOptions.googlepay.container);
//             //         if (button) {
//             //             const btn = button.firstChild as HTMLElement;
//             //             if (btn) {
//             //                 btn.click();
//             //                 expect(masterpass.checkout).toHaveBeenCalled();
//             //             }
//             //         }
//             //     }
//             // });
//         });
//
//         describe('Missing data comming from payment method', () => {
//
//             it('fails to initialize the strategy if there isn\'t a client token present', async () => {
//                 paymentMethod.clientToken = undefined;
//
//                 customerInitializeOptions = { methodId: 'googlepay', googlepay: { container: 'googlePayCheckoutButton' } };
//
//                 try {
//                     await strategy.initialize(customerInitializeOptions);
//                 } catch (e) {
//                     expect(e).toBeInstanceOf(MissingDataError);
//                 }
//             });
//
//
//             it('fails to initialize the strategy if payment method dosn\'t exist', async () => {
//                 jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod')
//                     .mockReturnValue(undefined);
//
//                 customerInitializeOptions = { methodId: 'googlepay', googlepay: { container: 'googlePayCheckoutButton' } };
//
//                 try {
//                     await strategy.initialize(customerInitializeOptions);
//                 } catch (e) {
//                     expect(e).toBeInstanceOf(MissingDataError);
//                 }
//             });
//         });
//     });
//
//     describe('#deinitialize()', () => {
//         let customerInitializeOptions: CustomerInitializeOptions;
//
//         beforeEach(() => {
//             customerInitializeOptions = { methodId: 'googlepay', googlepay: { container: 'googlePayCheckoutButton' } };
//
//             jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod')
//                 .mockReturnValue(paymentMethod);
//         });
//
//         it('succesfully deinitializes the strategy', async () => {
//             await strategy.initialize(customerInitializeOptions);
//
//             strategy.deinitialize();
//
//             if (customerInitializeOptions.googlepay) {
//                 const button = document.getElementById(customerInitializeOptions.googlepay.container);
//                 if (button) {
//                     expect(button.firstChild).toBe(null);
//                 }
//             }
//
//             // Prevent "After Each" failure
//             container = document.createElement('div');
//             document.body.appendChild(container);
//         });
//
//         it('Validates if strategy is loaded before call deinitialize', async () => {
//             await strategy.deinitialize();
//
//             if (customerInitializeOptions.googlepay) {
//                 const button = document.getElementById(customerInitializeOptions.googlepay.container);
//                 if (button) {
//                     expect(button.firstChild).toBe(null);
//                 }
//             }
//
//             // Prevent "After Each" failure
//             container = document.createElement('div');
//             document.body.appendChild(container);
//         });
//     });
//
//     describe('#signIn()', () => {
//         beforeEach(async () => {
//             jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod')
//                 .mockReturnValue(paymentMethod);
//
//             await strategy.initialize({ methodId: 'googlepay', googlepay: { container: 'googlePayCheckoutButton' } });
//         });
//
//         it('throws error if trying to sign in programmatically', async () => {
//             expect(() => strategy.signIn({ email: 'foo@bar.com', password: 'foobar' })).toThrowError();
//         });
//     });
//
//     describe('#signOut()', () => {
//         beforeEach(async () => {
//             const paymentId = {
//                 providerId: 'googlepay',
//             };
//             jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod')
//                 .mockReturnValue(paymentMethod);
//
//             jest.spyOn(store.getState().payment, 'getPaymentId')
//                 .mockReturnValue(paymentId);
//
//             jest.spyOn(remoteCheckoutActionCreator, 'signOut')
//                 .mockReturnValue('data');
//
//             await strategy.initialize({ methodId: 'googlepay', googlepay: { container: 'googlePayCheckoutButton' } });
//         });
//
//         it('throws error if trying to sign out programmatically', async () => {
//             const options = {
//                 methodId: 'googlepay',
//             };
//
//             await strategy.signOut(options);
//
//             expect(remoteCheckoutActionCreator.signOut).toHaveBeenCalledWith('googlepay', options);
//             expect(store.dispatch).toHaveBeenCalled();
//         });
//
//         it('Returns state if no payment method exist', async () => {
//             const options = {
//                 methodId: 'googlepay',
//             };
//
//             await strategy.signOut(options);
//
//             // expect(remoteCheckoutActionCreator.signOut).toHaveBeenCalledWith('googlepay', options);
//             // expect(store.dispatch).toHaveBeenCalled();
//         });
//     });
// });
