import { createRequestSender, RequestSender } from '@bigcommerce/request-sender';
import { createScriptLoader } from '@bigcommerce/script-loader';
import { of, Observable } from 'rxjs';
import { createAction, Action } from '@bigcommerce/data-store';

import { BillingAddressActionCreator, BillingAddressRequestSender } from '../../../billing';
import { getCartState } from '../../../cart/carts.mock';
import { createCheckoutStore, CheckoutRequestSender, CheckoutStore, CheckoutValidator } from '../../../checkout';
import { getCheckoutState } from '../../../checkout/checkouts.mock';
import {
    MissingDataError,
    MissingDataErrorType,
    NotInitializedError,
    NotInitializedErrorType,
    StandardError
} from '../../../common/error/errors';
import { getConfigState } from '../../../config/configs.mock';
import { getCustomerState } from '../../../customer/customers.mock';
import PaymentMethod from '../../payment-method';
import PaymentMethodActionCreator from '../../payment-method-action-creator';
import PaymentMethodRequestSender from '../../payment-method-request-sender';
import { getGooglePay, getPaymentMethodsState, getCybersource } from '../../payment-methods.mock';

import CyberSourceThreeDSecurePaymentProcessor from './cybersource-threedsecure-payment-processor';
import CyberSourceScriptLoader from './cybersource-script-loader';
import { OrderActionCreator, OrderActionType, OrderRequestSender, OrderPaymentRequestBody, OrderRequestBody } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import PaymentActionCreator from '../../payment-action-creator';
import { PaymentRequestSender } from '../../index';
import { createClient as createPaymentClient } from '@bigcommerce/bigpay-client';
import { PaymentActionType } from '../../payment-actions';
import { CreditCardInstrument } from '../../payment';
import { PaymentRequestOptions } from '../../payment-request-options';
import { CyberSourceCardinal } from './cybersource'

describe('CyberSourceThreeDSecurePaymentProcessor', () => {
    let processor: CyberSourceThreeDSecurePaymentProcessor;
    let paymentMethodActionCreator: PaymentMethodActionCreator;
    let cybersourceScriptLoader: CyberSourceScriptLoader;
    let store: CheckoutStore;
    let billingAddressActionCreator: BillingAddressActionCreator;
    let requestSender: RequestSender;
    let _paymentActionCreator: PaymentActionCreator;
    let _orderActionCreator: OrderActionCreator;
    let paymentMethodMock: PaymentMethod;
    let submitOrderAction: Observable<Action>;
    let submitPaymentAction: Observable<Action>;
    let _orderRequestSender: OrderRequestSender;
    let orderPaymentRequestBody: OrderPaymentRequestBody;
    let orderRequestBody: OrderRequestBody;
    let creditCardInstrument: CreditCardInstrument;
    let paymentRequestOptions: PaymentRequestOptions;
    let cyberSourceCardinal: CyberSourceCardinal;

    beforeEach(() => {
        paymentMethodMock = getCybersource();
        const scriptLoader = createScriptLoader();
        billingAddressActionCreator = new BillingAddressActionCreator(new BillingAddressRequestSender(requestSender));

        store = createCheckoutStore({
            checkout: getCheckoutState(),
            customer: getCustomerState(),
            config: getConfigState(),
            cart: getCartState(),
            paymentMethods: getPaymentMethodsState(),
        });
        
        requestSender = createRequestSender();

        //const paymentClient = createPaymentClient(store);
        const paymentMethodRequestSender = new PaymentMethodRequestSender(requestSender);
        //const paymentRequestSender = new PaymentRequestSender(createPaymentClient());
        _orderRequestSender = new OrderRequestSender(createRequestSender());

        _orderActionCreator = new OrderActionCreator(
            _orderRequestSender,
            new CheckoutValidator(new CheckoutRequestSender(createRequestSender()))
        );

        _paymentActionCreator = new PaymentActionCreator(
            new PaymentRequestSender(createPaymentClient()),
            _orderActionCreator
        );

        paymentMethodActionCreator = new PaymentMethodActionCreator(paymentMethodRequestSender);
        submitOrderAction = of(createAction(OrderActionType.SubmitOrderRequested));
        submitPaymentAction = of(createAction(PaymentActionType.SubmitPaymentRequested));


        jest.spyOn(_orderActionCreator, 'submitOrder')
            .mockReturnValue(submitOrderAction);
        jest.spyOn(_paymentActionCreator, 'submitPayment')
            .mockReturnValue(submitPaymentAction);
        jest.spyOn(paymentMethodActionCreator, 'loadPaymentMethod')
            .mockResolvedValue(store.getState());
        jest.spyOn(store, 'dispatch')
            .mockResolvedValue(store.getState());
        jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod')
            .mockReturnValue(paymentMethodMock);


        paymentMethodActionCreator = new PaymentMethodActionCreator(new PaymentMethodRequestSender(requestSender));
        cybersourceScriptLoader = new CyberSourceScriptLoader(scriptLoader);
        requestSender = createRequestSender();

        processor =  new CyberSourceThreeDSecurePaymentProcessor(
            store,
            _orderActionCreator,
            _paymentActionCreator,
            cybersourceScriptLoader
        );
    });

    it('creates an instance of CyberSourceThreeDSecurePaymentProcessor', () => {
        expect(processor).toBeInstanceOf(CyberSourceThreeDSecurePaymentProcessor);
    });

    describe('#initialize', () => {
        it('initializes processor successfully', async () => {
            beforeEach
            const _isSetupCompleted = true;
            expect(await processor.initialize(paymentMethodMock)).toEqual(store.getState());
            // jest.spyOn(store, 'dispatch').mockReturnValue(Promise.resolve(store.getState()));
            // jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(getCybersource());
            // jest.spyOn(paymentMethodActionCreator, 'loadPaymentMethod').mockReturnValue(Promise.resolve(store.getState()));

            //await processor.initialize('cybersource');

            expect(cybersourceScriptLoader.load).toHaveBeenCalled();
        });
    });

    describe('#execute', () => {
        it('executes the processor successfully', async () => {

        });
    });

    describe('#deinitialize()', () => {
        it('deinitializes strategy', async () => {
            expect(await processor.deinitialize()).toEqual(store.getState());
        });
    });

    describe('#finalize()', () => {
        it('throws error to inform that order finalization is not required', async () => {
            try {
                await processor.finalize();
            } catch (error) {
                expect(error).toBeInstanceOf(OrderFinalizationNotRequiredError);
            }
        });
    });

});
