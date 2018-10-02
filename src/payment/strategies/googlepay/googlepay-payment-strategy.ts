import { RequestSender } from '@bigcommerce/request-sender';
import Response from '@bigcommerce/request-sender/lib/response';

import { BillingAddressActionCreator } from '../../../billing';
import { BillingAddressUpdateRequestBody } from '../../../billing';
import CheckoutStore from '../../../checkout/checkout-store';
import { CheckoutActionCreator } from '../../../checkout/index';
import InternalCheckoutSelectors from '../../../checkout/internal-checkout-selectors';
import {
    InvalidArgumentError,
    MissingDataError,
    MissingDataErrorType,
    NotInitializedErrorType,
    StandardError
} from '../../../common/error/errors/index';
import NotInitializedError from '../../../common/error/errors/not-initialized-error';
import { toFormUrlEncoded } from '../../../common/http-request';
import { bindDecorator as bind } from '../../../common/utility';
import {
    OrderActionCreator,
    OrderRequestBody
} from '../../../order/index';
import { RemoteCheckoutSynchronizationError } from '../../../remote-checkout/errors';
import ConsignmentActionCreator from '../../../shipping/consignment-action-creator';
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
    default as mapGooglePayAddressToRequestAddress,
    ButtonColor,
    ButtonType,
    EnvironmentType,
    GooglePaymentsError,
    GooglePaymentData,
    GooglePayAddress,
    GooglePayClient,
    GooglePayInitializer,
    GooglePayIsReadyToPayResponse,
    GooglePayPaymentDataRequestV1,
    GooglePayPaymentOptions, GooglePaySDK,
    PaymentSuccessPayload,
    TokenizePayload
} from './googlepay';
import GooglePayPaymentInitializeOptions from './googlepay-initialize-options';
import GooglePayScriptLoader from './googlepay-script-loader';
import GooglePayPaymentProcessor from './googlepay-payment-processor';

export default class GooglePayPaymentStrategy extends PaymentStrategy {
    private _googlePaymentsClient!: GooglePayClient;
    private _googlePayOptions!: GooglePayPaymentInitializeOptions;
    private _methodId!: string;
    private _paymentMethod?: PaymentMethod;
    private _walletButton?: HTMLElement;
    private _googlePaymentDataRequest!: GooglePayPaymentDataRequestV1;

    constructor(
        store: CheckoutStore,
        private _checkoutActionCreator: CheckoutActionCreator,
        private _paymentMethodActionCreator: PaymentMethodActionCreator,
        private _paymentStrategyActionCreator: PaymentStrategyActionCreator,
        private _paymentActionCreator: PaymentActionCreator,
        private _orderActionCreator: OrderActionCreator,
        private _googlePayScriptLoader: GooglePayScriptLoader,
        private _googlePayInitializer: GooglePayInitializer,
        private _requestSender: RequestSender,
        private _billingAddressActionCreator: BillingAddressActionCreator,
        private _consignmentActionCreator: ConsignmentActionCreator,
        private _googlePayPaymentProcessor: GooglePayPaymentProcessor
    ) {
        super(store);
    }

    initialize(options: PaymentInitializeOptions): Promise<InternalCheckoutSelectors> {
        return this._googlePayPaymentProcessor.initialize(options)
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
}
