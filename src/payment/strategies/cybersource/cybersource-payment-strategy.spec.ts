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
import { MissingDataError } from '../../../common/error/errors';
import { getKlarna, getCybersource } from '../../payment-methods.mock';

import CyberSourcePaymentStrategy from './cybersource-payment-strategy';
import CyberSourceScriptLoader from './cybersource-script-loader';
import CyberSourceThreeDSecurePaymentProcessor from './cybersource-threedsecure-payment-processor';
import CyberSourcePaymentProcessor from './cybersource-payment-processor';
//import { CyberSourceScriptLoader } from './index';
import PaymentActionCreator from '../../payment-action-creator';

describe('KlarnaPaymentStrategy', () => {
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

    beforeEach(() => {
        paymentMethodMock = { ...getCybersource(), clientToken: 'foo' };
        store = createCheckoutStore(getCheckoutStoreState());

        jest.spyOn(store, 'dispatch').mockReturnValue(Promise.resolve(store.getState()));
        jest.spyOn(store.getState().paymentMethods, 'getPaymentMethod').mockReturnValue(paymentMethodMock);

        orderActionCreator = new OrderActionCreator(
            new OrderRequestSender(createRequestSender()),
            new CheckoutValidator(new CheckoutRequestSender(createRequestSender()))
        );
        paymentMethodActionCreator = new PaymentMethodActionCreator(new PaymentMethodRequestSender(createRequestSender()));
        remoteCheckoutActionCreator = new RemoteCheckoutActionCreator(
            new RemoteCheckoutRequestSender(createRequestSender())
        );
        scriptLoader = new CyberSourceScriptLoader(createScriptLoader());

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

        paymentMethod = getCybersource();

        payload = merge({}, getOrderRequestBody(), {
            payment: {
                methodId: paymentMethod.id,
                gatewayId: paymentMethod.gateway,
            },
        });

        loadPaymentMethodAction = of(createAction(PaymentMethodActionType.LoadPaymentMethodSucceeded, paymentMethod, { methodId: paymentMethod.id }));
        initializePaymentAction = of(createAction(RemoteCheckoutActionType.InitializeRemotePaymentRequested));
        submitOrderAction = of(createAction(OrderActionType.SubmitOrderRequested));

        jest.spyOn(store, 'dispatch');

        jest.spyOn(orderActionCreator, 'submitOrder')
            .mockReturnValue(submitOrderAction);

        jest.spyOn(paymentMethodActionCreator, 'loadPaymentMethod')
            .mockReturnValue(loadPaymentMethodAction);

        jest.spyOn(remoteCheckoutActionCreator, 'initializePayment')
            .mockReturnValue(initializePaymentAction);

        jest.spyOn(store, 'subscribe');
    });

    describe('#initialize()', () => {
        const onLoad = jest.fn();

        beforeEach(async () => {
            await strategy.initialize(paymentInitializeOptions);
        });

        it('loads script when initializing strategy', () => {
            expect(scriptLoader.load).toHaveBeenCalledTimes(1);
        });

        it('throws error if required data is not loaded', async () => {
            store = createCheckoutStore();
            strategy = new CyberSourcePaymentStrategy(
                store,
                paymentMethodActionCreator,
                cyberSourceThreeDSecurePaymentProcessor,
                cyberSourcePaymentProcessor
            );

            try {
                await strategy.initialize({ methodId: paymentMethod.id });
            } catch (error) {
                expect(error).toBeInstanceOf(MissingDataError);
            }
        });
    });

    describe('#finalize()', () => {
        beforeEach(async () => {
            await strategy.initialize(paymentInitializeOptions);
        });

        it('throws error to inform that order finalization is not required', async () => {
            try {
                await strategy.finalize();
            } catch (error) {
                expect(error).toBeInstanceOf(OrderFinalizationNotRequiredError);
            }
        });
    });
});
