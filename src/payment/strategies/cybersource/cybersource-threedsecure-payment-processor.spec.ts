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
import { getCybersource, getPaymentMethodsState } from '../../payment-methods.mock';

import CyberSourceThreeDSecurePaymentProcessor from './cybersource-threedsecure-payment-processor';
import CyberSourceScriptLoader from './cybersource-script-loader';
import { OrderActionCreator, OrderActionType, OrderPaymentRequestBody, OrderRequestBody, OrderRequestSender } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import PaymentActionCreator from '../../payment-action-creator';
import { PaymentRequestSender } from '../../index';
import { createClient as createPaymentClient } from '@bigcommerce/bigpay-client';
import { PaymentActionType } from '../../payment-actions';
import { CreditCardInstrument } from '../../payment';
import {PaymentInitializeOptions, PaymentRequestOptions} from '../../payment-request-options';
import {CardinalEventType, CardinalValidatedAction, CyberSourceCardinal, CardinalEventResponse} from './cybersource';
import {getCyberSourceScriptMock} from './cybersource.mock';
import { Subject } from 'rxjs';
import {ChasePayEventType} from "../chasepay/chasepay";

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
    let JPMC: CyberSourceCardinal;

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

        const paymentMethodRequestSender = new PaymentMethodRequestSender(requestSender);
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

        JPMC = getCyberSourceScriptMock();
        cybersourceScriptLoader = new CyberSourceScriptLoader(createScriptLoader());

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
        jest.spyOn(cybersourceScriptLoader, 'load')
            .mockReturnValue(Promise.resolve(JPMC));


        paymentMethodActionCreator = new PaymentMethodActionCreator(new PaymentMethodRequestSender(requestSender));
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
        beforeEach(() => {
            jest.spyOn(store, 'dispatch').mockReturnValue(Promise.resolve(store.getState()));
            jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(getCybersource());
            jest.spyOn(paymentMethodActionCreator, 'loadPaymentMethod').mockReturnValue(Promise.resolve(store.getState()));
        });

        it('loads cybersource in test mode if enabled', async () => {
            processor.initialize(paymentMethodMock);
            paymentMethodMock.config.testMode = true;

            expect(cybersourceScriptLoader.load).toHaveBeenLastCalledWith(false);
        });

        it('loads cybersource without test mode if disabled', () => {
            processor.initialize(paymentMethodMock);
            paymentMethodMock.config.testMode = false;

            expect(cybersourceScriptLoader.load).toHaveBeenLastCalledWith(false);
        });

        it('CardinalEvent CardinalValidation failure', () => {
            processor.initialize(paymentMethodMock);

            JPMC.on = jest.fn((type, callback) => callback({ActionCode: 'FAILURE', ErrorDescription: ''}));
            expect(new Subject().next()).toHaveBeenCalledWith( new Subject<{ type: CardinalEventResponse }>());
        });

        it('CardinalEvent CardinalValidateAction No action', () => {
            processor.initialize(paymentMethodMock);

            JPMC.on = jest.fn((type, callback) => callback({ActionCode: 'NOACTION', ErrorNumber: 1}));
        });
    });

    describe('#execute', () => {
        it('executes the processor successfully', async () => {
            try {
                await processor.execute(orderPaymentRequestBody, orderRequestBody, creditCardInstrument);
                expect(_orderActionCreator.submitOrder).toHaveBeenCalledWith(orderRequestBody, paymentRequestOptions);
                expect(_orderActionCreator.submitOrder).toHaveBeenCalledWith(orderRequestBody, paymentRequestOptions);
            } catch (error) {
                expect(error).toBeInstanceOf(NotInitializedError);
            }
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
