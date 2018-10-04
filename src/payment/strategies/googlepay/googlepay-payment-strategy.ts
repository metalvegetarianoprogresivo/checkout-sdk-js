import CheckoutStore from '../../../checkout/checkout-store';
import InternalCheckoutSelectors from '../../../checkout/internal-checkout-selectors';
import {
    MissingDataError,
    MissingDataErrorType,
    InvalidArgumentError,
    NotInitializedError,
    NotInitializedErrorType
} from '../../../common/error/errors/index';
import {
    OrderActionCreator,
    OrderRequestBody
} from '../../../order/index';
import { bindDecorator as bind } from '../../../common/utility';
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
    GooglePayInitializer, PaymentSuccessPayload, GooglePaymentData, TokenizePayload, GooglePayAddress
} from './googlepay';
import CheckoutActionCreator from '../../../checkout/checkout-action-creator';
import GooglePayScriptLoader from './googlepay-script-loader';
import RequestSender from '../../../../node_modules/@bigcommerce/request-sender/lib/request-sender';
import toFormUrlEncoded from '../../../common/http-request/to-form-url-encoded';
import GooglePayPaymentInitializeOptions from './googlepay-initialize-options';
import RemoteCheckoutSynchronizationError from '../../../remote-checkout/errors/remote-checkout-synchronization-error';
import { BillingAddressUpdateRequestBody } from '../../../billing';
import GooglePayPaymentProcessor from './googlepay-payment-processor';

export default class GooglePayPaymentStrategy extends PaymentStrategy {
    private _methodId!: string;
    private _walletButton?: HTMLElement;
    private _options!: PaymentInitializeOptions;
    private _googlePayOptions!: GooglePayPaymentInitializeOptions;

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
        this._methodId = options.methodId;

        if (!options.googlepay) {
            throw new InvalidArgumentError('Unable to initialize payment because "options.googlepay" argument is not provided.');
        }

        this._googlePayOptions = options.googlepay;

        const walletButton = this._googlePayOptions.walletButton && document.getElementById(this._googlePayOptions.walletButton);

        if (walletButton) {
            this._walletButton = walletButton;
            this._walletButton.addEventListener('click', this._handleWalletButtonClick);
        }

        return this._googlePayPaymentProcessor.initialize(this._methodId)
            .then(() => super.initialize(options));
    }

    deinitialize(options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
       return Promise.all([
            this._googlePayInitializer.teardown(),
            this._googlePayPaymentProcessor.deinitialize(),
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

    private _setExternalCheckoutData(paymentData: GooglePaymentData): Promise<void> {
        return this._googlePayPaymentProcessor.parseResponse(paymentData)
            .then((tokenizePayload: TokenizePayload) => {
                const {
                    onError = () => {},
                    onPaymentSelect = () => {},
                } = this._googlePayOptions;

                return this._paymentInstrumentSelected(tokenizePayload, paymentData.cardInfo.billingAddress)
                    .then(() => onPaymentSelect())
                    .catch(error => onError(error));
            });
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

                return {
                    methodId: this._methodId,
                    paymentData,
                };
            });
    }

    private _paymentInstrumentSelected(tokenizePayload: TokenizePayload, billingAddress: GooglePayAddress): Promise<InternalCheckoutSelectors> {
        if (!this._methodId) {
            throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
        }

        return this._store.dispatch(this._paymentStrategyActionCreator.widgetInteraction(() => {
            return this._postForm(tokenizePayload, billingAddress);
        }, { methodId: this._methodId }), { queueId: 'widgetInteraction' });
    }

    private _postForm(postPaymentData: TokenizePayload, billingAddress: GooglePayAddress): Promise<InternalCheckoutSelectors> {
        const cardInformation = postPaymentData.details;

        return this._requestSender.post('/checkout.php', {
            headers: {
                Accept: 'text/html',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: toFormUrlEncoded({
                payment_type: postPaymentData.type,
                nonce: postPaymentData.nonce,
                provider: this._methodId,
                action: 'set_external_checkout',
                card_information: this._getCardInformation(cardInformation),
            }),
        }).then(() => {
            if (!this._methodId) {
                throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
            }

            return Promise.all([
                this._googlePayPaymentProcessor.updateBillingAddress(billingAddress),
                this._store.dispatch(this._checkoutActionCreator.loadCurrentCheckout()),
                this._store.dispatch(this._paymentMethodActionCreator.loadPaymentMethod(this._methodId)),
            ]).then(() => this._store.getState());
        });
    }

    private _getCardInformation(cardInformation: { cardType: string, lastFour: string }) {
        return {
            type: cardInformation.cardType,
            number: cardInformation.lastFour,
        };
    }

    @bind
    private _handleWalletButtonClick(event: Event): Promise<void> {
        event.preventDefault();

        return this._googlePayPaymentProcessor.displayWallet()
        .then(paymentData => {
            return this._setExternalCheckoutData(paymentData);
        });
    }
}
