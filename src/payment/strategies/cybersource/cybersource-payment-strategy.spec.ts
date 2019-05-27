import { createAction, Action } from '@bigcommerce/data-store';
import { createRequestSender } from '@bigcommerce/request-sender';
import { createScriptLoader } from '@bigcommerce/script-loader';
import { merge, omit } from 'lodash';
import { of, Observable } from 'rxjs';

import {
    createCheckoutStore,
    CheckoutRequestSender,
    CheckoutStore,
    CheckoutValidator,
    InternalCheckoutSelectors
} from '../../../checkout';
import { OrderActionCreator, OrderActionType, OrderRequestBody, OrderRequestSender } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import { getOrderRequestBody } from '../../../order/internal-orders.mock';
import { RemoteCheckoutActionCreator, RemoteCheckoutActionType, RemoteCheckoutRequestSender } from '../../../remote-checkout';
import { PaymentMethodCancelledError, PaymentMethodInvalidError } from '../../errors';
import PaymentMethod from '../../payment-method';
import PaymentMethodActionCreator from '../../payment-method-action-creator';
import { PaymentMethodActionType } from '../../payment-method-actions';
import PaymentMethodRequestSender from '../../payment-method-request-sender';
import { PaymentInitializeOptions, PaymentRequestOptions } from '../../payment-request-options';

import { getCheckoutStoreState } from '../../../checkout/checkouts.mock';
import { NotInitializedError, MissingDataError } from '../../../common/error/errors';
import { getCybersource } from '../../payment-methods.mock';

import CyberSourcePaymentStrategy from './cybersource-payment-strategy';
import CyberSourceScriptLoader from './cybersource-script-loader';
import CyberSourceThreeDSecurePaymentProcessor from './cybersource-threedsecure-payment-processor';
import CyberSourcePaymentProcessor from './cybersource-payment-processor';
import PaymentActionCreator from '../../payment-action-creator';
import { async } from 'rxjs/internal/scheduler/async';
import { PaymentActionType } from '../../payment-actions';
import { CreditCardInstrument } from '../../payment';

describe('CyberSourcePaymentStrategy', () => {
    let initializePaymentAction: Observable<Action>;
    let loadPaymentMethodAction: Observable<Action>;
    let payload: OrderRequestBody;
    let paymentMethod: PaymentMethod;
    let orderActionCreator: OrderActionCreator;
    let paymentMethodActionCreator: PaymentMethodActionCreator;
    let remoteCheckoutActionCreator: RemoteCheckoutActionCreator;
    let scriptLoader: CyberSourceScriptLoader;
    let submitOrderAction: Observable<Action>;
    let store: CheckoutStore;
    let strategy: CyberSourcePaymentStrategy;
    let paymentMethodMock: PaymentMethod;
    let cyberSourceThreeDSecurePaymentProcessor: CyberSourceThreeDSecurePaymentProcessor;
    let paymentActionCreator: PaymentActionCreator;
    let cyberSourcePaymentProcessor: CyberSourcePaymentProcessor;
    let paymentInitializeOptions: PaymentInitializeOptions;
    let creditCardInstrument: CreditCardInstrument;

    beforeEach(() => {
        paymentMethodMock = { ...getCybersource(), clientToken: 'foo' };
        store = createCheckoutStore(getCheckoutStoreState());

        jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(paymentMethodMock);

        paymentMethodActionCreator = new PaymentMethodActionCreator(new PaymentMethodRequestSender(createRequestSender()));
        remoteCheckoutActionCreator = new RemoteCheckoutActionCreator(
            new RemoteCheckoutRequestSender(createRequestSender())
        );
        scriptLoader = new CyberSourceScriptLoader(createScriptLoader());

        orderActionCreator = new OrderActionCreator(
            new OrderRequestSender(createRequestSender()),
            new CheckoutValidator(new CheckoutRequestSender(createRequestSender()))
        );

        cyberSourceThreeDSecurePaymentProcessor = new CyberSourceThreeDSecurePaymentProcessor(
            store,
            orderActionCreator,
            paymentActionCreator,
            scriptLoader
        );

        cyberSourcePaymentProcessor = new CyberSourcePaymentProcessor(
            store,
            orderActionCreator,
            paymentActionCreator
        );

        strategy = new CyberSourcePaymentStrategy(
            store,
            paymentMethodActionCreator,
            cyberSourceThreeDSecurePaymentProcessor,
            cyberSourcePaymentProcessor
        );

        payload = merge({}, getOrderRequestBody(), {
            payment: {
                methodId: paymentMethodMock.id,
                gatewayId: paymentMethodMock.gateway,
            },
        });

        loadPaymentMethodAction = of(createAction(PaymentMethodActionType.LoadPaymentMethodSucceeded, paymentMethodMock, { methodId: paymentMethodMock.id }));
        initializePaymentAction = of(createAction(RemoteCheckoutActionType.InitializeRemotePaymentRequested));
        //submitPaymentAction = of(createAction(PaymentActionType.SubmitPaymentRequested));
        submitOrderAction = of(createAction(OrderActionType.SubmitOrderRequested));

        jest.spyOn(store, 'dispatch');

        jest.spyOn(paymentMethodActionCreator, 'loadPaymentMethod')
            .mockReturnValue(loadPaymentMethodAction);

        jest.spyOn(remoteCheckoutActionCreator, 'initializePayment')
            .mockReturnValue(initializePaymentAction);

        jest.spyOn(orderActionCreator, 'submitOrder')
            .mockReturnValue(submitOrderAction);

        jest.spyOn(cyberSourcePaymentProcessor, 'execute').mockReturnValue(orderActionCreator.submitOrder(payload));
        
        jest.spyOn(cyberSourceThreeDSecurePaymentProcessor, 'initialize').mockReturnValue(store.getState());

        //paymentActionCreator.submitPayment = jest.fn(() => submitPaymentAction);
        //orderActionCreator.submitOrder = jest.fn(() => submitOrderAction);
    });

    describe('#initialize', () => {
        beforeEach(async () => {
            await strategy.initialize({ methodId: paymentMethodMock.id });
        });

        it('initializes strategy successfully', () => {
            expect(cyberSourceThreeDSecurePaymentProcessor.initialize).toHaveBeenCalledTimes(1);
        });

        it('initializes strategy with is3dsEnabled in false successfully', async () => {
            jest.spyOn(cyberSourcePaymentProcessor, 'initialize').mockReturnValue(store.getState());
            paymentMethod = { ...getCybersource() };
            paymentMethod.config.is3dsEnabled = false;
            jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(paymentMethod);
            await strategy.initialize({ methodId: paymentMethodMock.id });

            expect(cyberSourcePaymentProcessor.initialize).toHaveBeenCalledTimes(1);
        });

        it('throws data missing error', async() => {
            jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(undefined);

            try {
                await strategy.initialize({ methodId: paymentMethodMock.id });
            } catch (error) {
                expect(error).toBeInstanceOf(MissingDataError);
            }
        });
    });

    describe('#execute', () => {
        it('throws error to inform that order finalization is not required and cannot be execute', async () => {
            try {
                await strategy.execute(payload);
            } catch (error) {
                expect(error).toBeInstanceOf(NotInitializedError);
            }
        });
        // 49,53,64,72
        // 52,53,56,64,72
    });

    describe('#finalize()', () => {
        it('throws error to inform that order finalization is not required', async () => {
            try {
                await strategy.finalize();
            } catch (error) {
                expect(error).toBeInstanceOf(NotInitializedError);
            }
        });

        // it('calling finalize method of processor', () => {
        //     jest.spyOn(cyberSourceThreeDSecurePaymentProcessor, 'finalize').mockReturnValue(store.getState());

        //     expect(cyberSourceThreeDSecurePaymentProcessor.finalize).toHaveBeenCalledTimes(1);
        // });
    });

    describe('#deinitialize()', () => {
        it('throws error to inform that order finalization is not required', async () => {
            try {
                await strategy.deinitialize();
            } catch (error) {
                expect(error).toBeInstanceOf(NotInitializedError);
            }
        });

        // it('calling finalize method of processor when deinitializing', async () => {
        //     jest.spyOn(cyberSourcePaymentProcessor, 'deinitialize').mockReturnValue(store.getState());
        //     expect(cyberSourcePaymentProcessor.deinitialize).toHaveBeenCalledTimes(1);
        // });
    });
});
