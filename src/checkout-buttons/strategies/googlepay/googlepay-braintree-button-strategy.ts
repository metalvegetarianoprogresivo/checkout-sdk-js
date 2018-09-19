import { FormPoster } from '@bigcommerce/form-poster';

import { CheckoutStore } from '../../../checkout';
import { InvalidArgumentError, MissingDataError, MissingDataErrorType } from '../../../common/error/errors';
import { bindDecorator as bind } from '../../../common/utility';
import { PaymentInitializeOptions, PaymentMethod } from '../../../payment';
import { GooglePayBraintreeSDK, GooglePayPaymentOptions, GooglePayPaymentStrategy, GooglePayScriptLoader, GooglePaySDK } from '../../../payment/strategies/googlepay';
import GooglePayPaymentProcessor from '../../../payment/strategies/googlepay/googlepay-payment-processor';
import { CheckoutButtonInitializeOptions, CheckoutButtonOptions } from '../../checkout-button-options';
import CheckoutButtonStrategy from '../checkout-button-strategy';

import { GooglePayBraintreeButtonInitializeOptions } from './googlepay-braintree-button-options';

export default class GooglePayBraintreeButtonStrategy extends CheckoutButtonStrategy {
    private _paymentMethod?: PaymentMethod;
    private _methodId!: string;

    constructor(
        private _store: CheckoutStore,
        private _formPoster: FormPoster,
        private _googlePayScriptLoader: GooglePayScriptLoader,
        private _googlePayPaymentProcessor: GooglePayPaymentProcessor
    ) {
        super();
    }

    initialize(options: CheckoutButtonInitializeOptions): Promise<void> {
        if (this._isInitialized) {
            return super.initialize(options);
        }

        const { googlepaybraintree, methodId } = options;

        if (!googlepaybraintree || !methodId) {
            throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
        }

        this._methodId = methodId;

        return this._googlePayPaymentProcessor.initialize(this._methodId)
            .then(() => this._googlePayPaymentProcessor.createButton(this._handleWalletButtonClick))
            .then(() => super.initialize(options));
    }

    deinitialize(options: CheckoutButtonOptions): Promise<void> {
        if (!this._isInitialized) {
            return super.deinitialize(options);
        }

        this._paymentMethod = undefined;

        return this._googlePayPaymentProcessor.deinitialize()
            .then(() => super.deinitialize(options));
    }

    private _createGooglePayButton(googleClientOptions: GooglePayPaymentOptions, googlepaybraintree: GooglePayBraintreeButtonInitializeOptions): Promise<void> {
        return this._googlePayScriptLoader.load()
            .then(googleSDK => {
                const googleClient = new googleSDK.payments.api.PaymentsClient(googleClientOptions);

                const googlePayButton = googleClient.createButton({});
                const container = document.querySelector(`#${googlepaybraintree.container}`);

                if (!container) {
                    throw new InvalidArgumentError('Unable to create sign-in button without valid container ID.');
                }

                container.appendChild(googlePayButton);
            });
    }

    @bind
    private _handleWalletButtonClick(): Promise<void> {
        return this._googlePayPaymentProcessor.displayWallet()
            .then(() => this._onPaymentSelectComplete());
    }

    private _onPaymentSelectComplete(): void {
        this._formPoster.postForm('/checkout.php', {
            headers: {
                Accept: 'text/html',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            params: {
                fromGooglePay: true,
            },
        });
    }

    private _onError(error?: Error): void {
        if (error) {
            throw new Error(error.message);
        }
    }

}
