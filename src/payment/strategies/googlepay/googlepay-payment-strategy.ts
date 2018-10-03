import CheckoutStore from '../../../checkout/checkout-store';
import InternalCheckoutSelectors from '../../../checkout/internal-checkout-selectors';
import {
    MissingDataError,
    MissingDataErrorType
} from '../../../common/error/errors/index';
import {
    OrderActionCreator,
    OrderRequestBody
} from '../../../order/index';
import {
    PaymentActionCreator,
    PaymentMethodActionCreator,
    PaymentStrategyActionCreator
} from '../../index';
import Payment from '../../payment';
import PaymentMethod from '../../payment-method';
import {
    PaymentInitializeOptions,
    PaymentRequestOptions
} from '../../payment-request-options';
import PaymentStrategy from '../payment-strategy';

import {
    GooglePayInitializer, PaymentSuccessPayload
} from './googlepay';
import GooglePayPaymentProcessor, { GooglePayProcessorOptions } from './googlepay-payment-processor';
import CheckoutActionCreator from '../../../checkout/checkout-action-creator';
import GooglePayScriptLoader from './googlepay-script-loader';
import RequestSender from '../../../../node_modules/@bigcommerce/request-sender/lib/request-sender';
import toFormUrlEncoded from '../../../common/http-request/to-form-url-encoded';

export default class GooglePayPaymentStrategy extends PaymentStrategy {
    private _methodId!: string;
    private _paymentMethod?: PaymentMethod;

    constructor(
        store: CheckoutStore,
        private _checkoutActionCreator: CheckoutActionCreator,
        private _paymentMethodActionCreator: PaymentMethodActionCreator,
        private _paymentStrategyActionCreator: PaymentStrategyActionCreator,
        private _paymentActionCreator: PaymentActionCreator,
        private _orderActionCreator: OrderActionCreator,
        private _googlePayInitializer: GooglePayInitializer,
        private _requestSender: RequestSender,
        private _googlePayPaymentProcessor: GooglePayPaymentProcessor
    ) {
        super(store);
    }

    initialize(options: PaymentInitializeOptions): Promise<InternalCheckoutSelectors> {
        const processorOptions: GooglePayProcessorOptions = {
            initializeOptions: options,
            onWalletSelect: this._paymentInstrumentSelected
        };
        
        return this._googlePayPaymentProcessor.initialize(processorOptions)
            .then(() => super.initialize(options));
    }

    deinitialize(options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
       return Promise.all([
            this._googlePayInitializer.teardown(),
            this._googlePayPaymentProcessor.deinitialize()
        ])
        .then(() => super.deinitialize(options));
    }

    execute(payload: OrderRequestBody, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        return this._getPayment()
            .catch((error: MissingDataError) => {
                if (error.subtype === MissingDataErrorType.MissingPayment) {
                    return this._googlePayPaymentProcessor.displayWallet()
                        .then(() => this._getPayment());
                }

                throw error;
            })
            .then(payment => {
                return this._createOrder(payment, payload.useStoreCredit, options);
            });
    }

    private _createOrder(payment: Payment, useStoreCredit?: boolean, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        return this._store.dispatch(this._orderActionCreator.submitOrder({ useStoreCredit }, options))
            .then(() => this._store.dispatch(this._paymentActionCreator.submitPayment(payment)));
    }

    private _getPayment() {
        return this._store.dispatch(this._paymentMethodActionCreator.loadPaymentMethod(this._methodId))
            .then(() => {
                const state = this._store.getState();
                const paymentMethod = state.paymentMethods.getPaymentMethod(this._methodId);

                if (!paymentMethod) {
                    throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
                }

                if (!paymentMethod.initializationData.nonce) {
                    throw new MissingDataError(MissingDataErrorType.MissingPayment);
                }

                const paymentData = {
                    method: this._methodId,
                    nonce: paymentMethod.initializationData.nonce,
                    cardInformation: paymentMethod.initializationData.card_information,
                };

                this._paymentMethod = paymentMethod;

                return {
                    methodId: this._methodId,
                    paymentData,
                };
            });
    }

    private _paymentInstrumentSelected(paymentSuccessPayload: PaymentSuccessPayload): Promise<InternalCheckoutSelectors> {
        if (!this._paymentMethod) {
            throw new Error('Payment method not initialized');
        }

        const { id: methodId } = this._paymentMethod;

        return this._store.dispatch(this._paymentStrategyActionCreator.widgetInteraction(() => {
            return this._postForm(paymentSuccessPayload)
                .then(() => Promise.all([
                    this._store.dispatch(this._checkoutActionCreator.loadCurrentCheckout()),
                    this._store.dispatch(this._paymentMethodActionCreator.loadPaymentMethod(methodId)),
                ]));
        }, { methodId }), { queueId: 'widgetInteraction' });
    }

    private _postForm(paymentData: PaymentSuccessPayload): any {
        const cardInformation = paymentData.tokenizePayload.details;

        return this._requestSender.post('/checkout.php', {
            headers: {
                Accept: 'text/html',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: toFormUrlEncoded({
                payment_type: paymentData.tokenizePayload.type,
                nonce: paymentData.tokenizePayload.nonce,
                provider: 'googlepay',
                action: 'set_external_checkout',
                card_information: this._getCardInformation(cardInformation),
            }),
        });
    }

    private _getCardInformation(cardInformation: { cardType: string, lastFour: string }) {
        return {
            type: cardInformation.cardType,
            number: cardInformation.lastFour,
        };
    }
}
